/**
 * Grading Engine V2 — Arm B: grouped fan-out + synthesis.
 *
 * The main contender. Instead of one LLM call scoring all six dimensions
 * and writing every piece of feedback (the control shape), Arm B splits the
 * work across two dimension-specialized calls that run in parallel, then a
 * cheap synthesis call:
 *
 *   1. CONTENT      — clarity / structure / conciseness / thinking_quality,
 *                     judged from the transcript (+ SIGNALS / RAG).
 *   2. DELIVERY+TONE — delivery + tone, judged ONLY from prosody + rate.
 *   3. SYNTHESIS    — sees all six finalized scores + both feedback sets and
 *                     writes the post-rep envelope (headline / the single
 *                     coachFocus / strongerVersion / headlineTone / nextRepHint).
 *
 * Why this can match or beat control on latency despite three calls: output
 * DECODE dominates latency, and calls 1+2 split the decode budget and run
 * concurrently. Why it improves feedback: each dimension gets a real token
 * budget and a focused reasoning frame instead of one call split six ways;
 * tone especially gets a call that reasons only about voice.
 *
 * Cache discipline (a hard requirement): both scoring calls reuse the EXACT
 * same cached system blocks as control (`buildSystemBlocks`), so the shared
 * prompt prefix stays a cache hit across all calls — the per-call
 * specialization lives entirely in the (uncached) user message. Splitting
 * the cached prefix would double-pay the cache write.
 *
 * Determinism config: `FF_ARM_B_DELIVERY_MODE` runs the arm WITH the
 * deterministic delivery override + thinking blend (default, matches
 * control's stability) or ALL-LLM (keeps the model's raw delivery/thinking
 * numbers). This is how the bench answers Max's "can we drop determinism
 * and stay fast/accurate?" with data.
 *
 * Graceful degradation, never mock-fallback the whole rep:
 *   - a scoring call (content OR delivery) failing → fall back to the shared
 *     single-call scorer, so the user still gets a real, complete score;
 *   - the synthesis call failing → derive the envelope deterministically
 *     from the six scores (weakest-dimension coachFocus, band headline).
 */

import { z } from "zod";
import { anthropic, MODELS } from "./claude";
import {
  buildUserPrompt,
  buildSystemBlocks,
  computeScoringPromptBytes,
  parseAndValidate,
  applyHybridLayer,
  assembleRepScore,
  runSingleCallScore,
  type HybridConfig,
} from "./score-shared";
import type { ScoreRepInput, ScoreRepResult } from "./score";
import type { SkillDimension } from "@/types/domain";
import {
  rollupTone,
  coerceToneObservation,
  PROSODY_TONE_SUBSKILLS,
  type ToneObservation,
  type ToneRollupResult,
} from "@/lib/scoring/rollup";
import { extractAllTextSignals } from "@/lib/scoring/signals";
import {
  mapSignalsToSubSkillScores,
  toScoresOnly,
} from "@/lib/scoring/signals";
import { hasWorkerProsody } from "@/lib/audio/prosody";
import { SUB_SKILLS, type ToneSubSkill } from "@/types/sub-skills";

// ── Dimension partition ────────────────────────────────────────────────
const CONTENT_DIMS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
];
const DELIVERY_DIMS: SkillDimension[] = ["delivery", "tone"];
const ALL_SIX: SkillDimension[] = [...CONTENT_DIMS, ...DELIVERY_DIMS];

const DIM_ENUM = z.enum([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
]);

/** Lenient per-call dimension schema — mirrors the fields the full
 *  scoringResponseSchema keeps, but nothing else (each scoring call returns
 *  ONLY dimensions). signals/feedback tolerated absent. */
const armDimensionSchema = z.object({
  dimension: DIM_ENUM,
  score: z.number().min(0).max(100),
  signals: z.array(z.string()).optional(),
  feedback: z.string().optional(),
  subSkill: z.string().nullable().optional().catch(null),
});
const scoringPassSchema = z.object({
  dimensions: z.array(armDimensionSchema),
});
type ArmDimension = z.infer<typeof armDimensionSchema>;

/** Synthesis pass — the post-rep envelope only. Lenient so a stray extra
 *  field never fails the parse; parseAndValidate re-validates the merged
 *  object against the real schema + sanitizers downstream. */
const synthesisPassSchema = z.object({
  headline: z.string().min(1),
  coachFocus: z.object({
    dimension: DIM_ENUM,
    subSkill: z.string().nullable().optional().catch(null),
    behavior: z.string().min(1),
    why: z.string().min(1),
    action: z.string().min(1),
  }),
  strongerVersion: z
    .object({ quote: z.string(), rewrite: z.string() })
    .nullable()
    .optional()
    .catch(null),
  headlineTone: z.enum(["blunt", "directive", "praise", "celebratory"]),
  nextRepHint: z.string().min(1),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  implementationReview: z
    .object({
      verdict: z.enum(["nailed", "partial", "missed"]),
      note: z.string().optional(),
      technique: z.string().optional(),
    })
    .nullable()
    .optional()
    .catch(null),
});
type SynthesisEnvelope = z.infer<typeof synthesisPassSchema>;

// ── Scope instructions (uncached user-message prefixes) ─────────────────
const CONTENT_SCOPE = [
  "ARM SCOPE — CONTENT PASS.",
  "Score ONLY these four dimensions: clarity, structure, conciseness, thinking_quality.",
  "Judge them from the transcript (and any SIGNALS / RAG CONTEXT). IGNORE delivery and tone entirely — a separate pass grades voice.",
  "Spend your full token budget on rich, specific per-skill feedback for these four.",
  'Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"clarity"|"structure"|"conciseness"|"thinking_quality","score":0-100,"signals":["..."],"feedback":"1-2 sentences per the PER-SKILL FEEDBACK RULES","subSkill":"snake_case id from the SUB-SKILL REFERENCE"|null}]}',
  "Include exactly one entry for each of the four dimensions. Do NOT include delivery, tone, a headline, coachFocus, or strongerVersion.",
].join("\n");

const DELIVERY_SCOPE = [
  "ARM SCOPE — DELIVERY & TONE PASS.",
  "Score ONLY delivery and tone. Ground them in the PROSODY EVIDENCE and MEASURED RATE lines; reason ONLY about voice and pacing, never the argument's content (mediocre content delivered with expressive prosody is still HIGH tone).",
  "Apply the PROSODY EVIDENCE SCOPE and the delivery/tone edge rules from the system prompt.",
  'Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"delivery"|"tone","score":0-100,"signals":["..."],"feedback":"1-2 sentences","subSkill":"snake_case id"|null}]}',
  "Include exactly one entry for delivery and one for tone. Do NOT include content dimensions, a headline, or coachFocus.",
].join("\n");

// ── holistic-split scopes (PIVOT 2026-07-22 — the fan-out CALIBRATION fix) ──
// grouped-fanout and per-skill-fanout both regressed tone/thinking because
// they ISOLATED each pass from its sibling dims: the base DELIVERY_SCOPE says
// "reason ONLY about voice and pacing, never the argument's content." That is
// defensible WITH prosody, but on text reps (no audio) it STARVES tone — the
// control single call scores tone in the same breath as content, so it reads
// tone off the transcript's phrasing/assertiveness/word-choice, which the
// isolation forbids. Result: control tone MAE 2.6 vs grouped-fanout 5.6.
//
// The fix (Max's "give each voice call its sibling dim's context"): split only
// the OUTPUT decode — the actual latency lever — while BOTH passes keep the
// full rep context and full reasoning latitude, exactly as control reasons.
// Each pass still emits only its dimension subset (so the 2500-tok decode
// splits across two concurrent calls), but neither is told to ignore the other
// half of the rep. The cached system prefix is identical to control, so the
// only change vs grouped-fanout is these scope prose blocks.
const CONTENT_SCOPE_HOLISTIC = [
  "ARM SCOPE — CONTENT PASS (holistic context).",
  "Score ONLY these four dimensions: clarity, structure, conciseness, thinking_quality.",
  "Reason over the WHOLE rep for calibration — transcript, any SIGNALS / RAG CONTEXT, and how it is delivered — but EMIT only these four. (Delivery and tone are finalized by a separate pass; do not output them.)",
  "Apply the SCORE CALIBRATION + ANTI-COMPRESSION + EDGE-CASE rules from the system prompt EXACTLY. Write 1-2 tight sentences of feedback per dimension. Do NOT hunt for nitpicks to fill space: if you cannot name a real deficiency, the score is high (per the calibration rules), not a hedged middle.",
  'Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"clarity"|"structure"|"conciseness"|"thinking_quality","score":0-100,"signals":["..."],"feedback":"1-2 sentences per the PER-SKILL FEEDBACK RULES","subSkill":"snake_case id from the SUB-SKILL REFERENCE"|null}]}',
  "Include exactly one entry for each of the four dimensions. Do NOT include delivery, tone, a headline, coachFocus, or strongerVersion.",
].join("\n");

const DELIVERY_SCOPE_HOLISTIC = [
  "ARM SCOPE — DELIVERY & TONE PASS (holistic context).",
  "Score ONLY delivery and tone, using ALL available evidence exactly as the system prompt's rubric directs: any PROSODY EVIDENCE and MEASURED RATE lines FIRST, and — when prosody is thin or absent — the transcript's phrasing, word-choice, directness, and fluency. Do NOT refuse to read the transcript for tone: how someone phrases a point is tone evidence, and it is how tone is graded when there is no audio.",
  "Apply the PROSODY EVIDENCE SCOPE and the delivery/tone edge rules from the system prompt. Judge voice and manner, not the argument's substance — but the transcript is legitimate evidence for voice and manner.",
  'Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"delivery"|"tone","score":0-100,"signals":["..."],"feedback":"1-2 sentences","subSkill":"snake_case id"|null}]}',
  "Include exactly one entry for delivery and one for tone. Do NOT include content dimensions, a headline, or coachFocus.",
].join("\n");

// ── lean-split scopes (lever a × b — lean output ON the parallel decode) ──
// Same partition as grouped-fanout, but each scoring pass emits the LEAN
// output contract (no `signals`, one-sentence feedback). Two deliberate
// differences from the base scopes fix the clarity regression the lean sweep
// found in grouped-fanout: (1) the base CONTENT scope told the model to "spend
// your full token budget on RICH feedback" for only four dims — that flaw-
// hunting pressure drove clarity DOWN (the model manufactured nitpicks to fill
// the budget, violating anti-compression); the lean scope removes it, and
// (2) adds an explicit anti-compression guard so short feedback never drags a
// score. The pair is why lean-split can keep the parallel-decode latency win
// without the 1.4→5.6 clarity MAE blowup.
const CONTENT_SCOPE_LEAN = [
  "ARM SCOPE — CONTENT PASS.",
  "Score ONLY these four dimensions: clarity, structure, conciseness, thinking_quality.",
  "Judge them from the transcript (and any SIGNALS / RAG CONTEXT). IGNORE delivery and tone entirely — a separate pass grades voice.",
  "Apply the SCORE CALIBRATION + ANTI-COMPRESSION + EDGE-CASE rules from the system prompt EXACTLY. Write ONE tight sentence of feedback per dimension — do not pad, do not hunt for nitpicks to fill space. The feedback being short must NEVER pull a score down: if you cannot name a real deficiency, the score is ≥80 (per the calibration rules), not a hedged middle.",
  'Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"clarity"|"structure"|"conciseness"|"thinking_quality","score":0-100,"feedback":"1 sentence per the PER-SKILL FEEDBACK RULES","subSkill":"snake_case id from the SUB-SKILL REFERENCE"|null}]}',
  "Include exactly one entry for each of the four dimensions. Do NOT include delivery, tone, a headline, coachFocus, or strongerVersion.",
].join("\n");

const DELIVERY_SCOPE_LEAN = [
  "ARM SCOPE — DELIVERY & TONE PASS.",
  "Score ONLY delivery and tone. Ground them in the PROSODY EVIDENCE and MEASURED RATE lines; reason ONLY about voice and pacing, never the argument's content (mediocre content delivered with expressive prosody is still HIGH tone).",
  "Apply the PROSODY EVIDENCE SCOPE and the delivery/tone edge rules from the system prompt.",
  'Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"delivery"|"tone","score":0-100,"feedback":"1 sentence","subSkill":"snake_case id"|null}]}',
  "Include exactly one entry for delivery and one for tone. Do NOT include content dimensions, a headline, or coachFocus.",
].join("\n");

/** Arm C — the Delivery+Tone pass, but tone is DECOMPOSED into ordinal
 *  observations (rolled up deterministically downstream) instead of a raw
 *  0-100 tone number. Delivery still scores directly. */
const DELIVERY_TONE_DECOMP_SCOPE = [
  "ARM SCOPE — DELIVERY & TONE PASS (tone decomposed).",
  "Score DELIVERY directly (0-100), grounded in the MEASURED RATE + PROSODY EVIDENCE.",
  "For TONE, do NOT emit a 0-100 number. Instead, judge each of these transcript-observable tone sub-skills and rate it ordinally: directness, authority, assertiveness. Levels: \"strong\" (clearly present and effective), \"present\" (there but unremarkable), \"weak\" (attempted but undercut), \"absent\" (missing or contradicted). Give ≤120 chars of evidence each. Reason only about voice/manner, never the argument's content.",
  'Return ONLY this JSON, no prose or fences: {"delivery":{"score":0-100,"signals":["..."],"feedback":"1-2 sentences","subSkill":"snake_case id"|null},"toneObservations":[{"subSkill":"directness"|"authority"|"assertiveness","level":"strong"|"present"|"weak"|"absent","evidence":"..."}],"toneFeedback":"1-2 sentences on the voice/tone"}',
  "Include exactly one observation per the three tone sub-skills. Do NOT include content dimensions, a headline, or coachFocus.",
].join("\n");

const TONE_SUBSKILL_SET: ReadonlySet<string> = new Set(SUB_SKILLS.tone);

type DeliveryToneDecomp = {
  deliveryScore: number;
  deliverySignals: string[];
  deliveryFeedback?: string;
  observations: ToneObservation[];
  toneFeedback?: string;
};

/** Parse the tone-decomposition delivery pass. Returns null (→ fall back)
 *  when delivery is missing or no usable tone observations survived. */
function parseDeliveryToneDecomp(text: string): DeliveryToneDecomp | null {
  let obj: Record<string, unknown>;
  try {
    const parsed = extractJson(text);
    if (!parsed || typeof parsed !== "object") return null;
    obj = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const delivery = obj.delivery as Record<string, unknown> | undefined;
  const deliveryScore =
    delivery && typeof delivery.score === "number" ? delivery.score : null;
  if (deliveryScore == null || deliveryScore < 0 || deliveryScore > 100) {
    return null;
  }
  const rawObs = Array.isArray(obj.toneObservations) ? obj.toneObservations : [];
  const observations = rawObs
    .map((o) => coerceToneObservation(o, TONE_SUBSKILL_SET))
    .filter((o): o is ToneObservation => o != null);
  if (observations.length === 0) return null;
  return {
    deliveryScore,
    deliverySignals: Array.isArray(delivery?.signals)
      ? (delivery!.signals as unknown[]).filter(
          (s): s is string => typeof s === "string",
        )
      : [],
    deliveryFeedback:
      typeof delivery?.feedback === "string" ? delivery!.feedback : undefined,
    observations,
    toneFeedback:
      typeof obj.toneFeedback === "string" ? obj.toneFeedback : undefined,
  };
}

/** Prosody-measured tone sub-skill scores (0-100) from the signal mapper.
 *  Independent of the FF_DETERMINISTIC_SIGNALS gate — Arm C always wants
 *  the voice component when audio is present. */
function measuredToneScores(
  input: ScoreRepInput,
  prosody: Parameters<typeof mapSignalsToSubSkillScores>[1],
): Partial<Record<ToneSubSkill, number>> {
  const signals = extractAllTextSignals({
    transcript: input.transcript,
    durationMs: input.durationMs,
    words: input.words,
  });
  const all = toScoresOnly(mapSignalsToSubSkillScores(signals, prosody));
  const out: Partial<Record<ToneSubSkill, number>> = {};
  for (const sk of PROSODY_TONE_SUBSKILLS) {
    const v = all[sk];
    if (v != null) out[sk] = v;
  }
  return out;
}

function renderSynthesisScope(dims: ArmDimension[]): string {
  const scoreLines = ALL_SIX.map((d) => {
    const found = dims.find((x) => x.dimension === d);
    const fb = found?.feedback ? ` — ${found.feedback}` : "";
    return `- ${d}: ${found?.score ?? "?"}${fb}`;
  }).join("\n");
  return [
    "ARM SCOPE — SYNTHESIS PASS.",
    "The six dimension scores and per-skill feedback below are ALREADY DECIDED. Do NOT re-score them and do NOT emit a dimensions array.",
    "Using these scores plus the transcript, write ONLY the post-rep feedback envelope, following the HEADLINE RULES, COACH'S FOCUS RULES, and STRONGER VERSION RULES from the system prompt.",
    "coachFocus must be the single highest-leverage change (usually the weakest / most limiting dimension). strongerVersion.quote must be copied verbatim from the transcript, or null.",
    "",
    "DECIDED SCORES:",
    scoreLines,
    "",
    'Return ONLY this JSON, no prose or fences: {"headline":"...","coachFocus":{"dimension":"...","subSkill":"snake_case id"|null,"behavior":"...","why":"...","action":"..."},"strongerVersion":{"quote":"verbatim transcript phrase","rewrite":"..."}|null,"headlineTone":"blunt"|"directive"|"praise"|"celebratory","nextRepHint":"3-8 words"}',
    "If a RETRY EVALUATION block is present in the context below, ALSO include the required implementationReview object.",
  ].join("\n");
}

// ── Robust JSON extraction (mirrors parseAndValidate's front half) ──────
function extractJson(text: string): unknown {
  const MAX = 64 * 1024;
  if (text.length > MAX) {
    throw new Error(`Arm B response exceeded ${MAX}B size cap`);
  }
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  const cleaned =
    first !== -1 && last > first ? stripped.slice(first, last + 1) : stripped;
  return JSON.parse(cleaned);
}

/** Parse a scoring pass and return the expected dimensions (filtered +
 *  coverage-checked). Returns null when the pass didn't cover every
 *  expected dimension, so the caller can fall back. */
function parseScoringPass(
  text: string,
  expected: SkillDimension[],
): ArmDimension[] | null {
  let parsed: z.infer<typeof scoringPassSchema>;
  try {
    parsed = scoringPassSchema.parse(extractJson(text));
  } catch {
    return null;
  }
  const byDim = new Map<SkillDimension, ArmDimension>(
    parsed.dimensions.map((d) => [d.dimension, d] as const),
  );
  const out: ArmDimension[] = [];
  for (const dim of expected) {
    const entry = byDim.get(dim);
    if (!entry) return null; // incomplete coverage → fall back
    out.push({ ...entry, dimension: dim });
  }
  return out;
}

// ── Config ──────────────────────────────────────────────────────────────
function resolveArmBConfig(): HybridConfig {
  const mode = (process.env.FF_ARM_B_DELIVERY_MODE ?? "deterministic")
    .trim()
    .toLowerCase();
  return mode === "llm"
    ? { deliveryMode: "llm", thinkingMode: "llm" }
    : { deliveryMode: "deterministic", thinkingMode: "blend" };
}

// ── One scoped model call ────────────────────────────────────────────────
type ArmCall = { text: string; metrics: ScoreRepResult["metrics"] };

async function callScoped(
  system: ReturnType<typeof buildSystemBlocks>,
  userText: string,
  promptSizeBytes: number,
): Promise<ArmCall> {
  const { response, metrics } = await anthropic.messages.createWithMetrics(
    {
      model: MODELS.scoring,
      max_tokens: 2500,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
    },
    promptSizeBytes,
  );
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Arm B: model returned no text content");
  }
  return {
    text: textBlock.text,
    metrics: metrics as ScoreRepResult["metrics"],
  };
}

// ── Synthesis-failure fallback (deterministic envelope) ──────────────────
function deriveSynthesisFallback(dims: ArmDimension[]): SynthesisEnvelope {
  // Weakest scored dimension drives the coachFocus; a bare-but-honest
  // envelope so the rep still renders. strongerVersion stays null — never
  // fabricate a quote on a degraded path.
  const sorted = [...dims].sort((a, b) => a.score - b.score);
  const weakest = sorted[0] ?? { dimension: "clarity" as SkillDimension, score: 60, feedback: undefined };
  const label = weakest.dimension.replace(/_/g, " ");
  const avg = dims.reduce((s, d) => s + d.score, 0) / (dims.length || 1);
  const tone: SynthesisEnvelope["headlineTone"] =
    avg < 50 ? "blunt" : avg < 75 ? "directive" : avg < 90 ? "praise" : "celebratory";
  return {
    headline: `Your ${label} is the limiting factor this rep — tighten it on the next attempt.`,
    coachFocus: {
      dimension: weakest.dimension,
      subSkill: null,
      behavior:
        weakest.feedback ??
        `Your ${label} scored lowest, so it capped the rep.`,
      why: `${label} is the weakest dimension here, so it holds the whole rep back.`,
      action: `On your retry, put your attention on ${label}.`,
    },
    strongerVersion: null,
    headlineTone: tone,
    nextRepHint: `lift your ${label}`.slice(0, 60),
    implementationReview: null,
  };
}

// ── Metrics merge (tokens SUM across calls, wall-clock MAX) ───────────────
function mergeArmMetrics(
  base: ScoreRepResult["metrics"],
  calls: ScoreRepResult["metrics"][],
  extra: {
    validationDurationMs: number;
    scoreRepTotalMs: number;
    ragDurationMs: number;
    ragChunkCount: number;
    fallbackFired: boolean;
    llmCallCount: number;
  },
): ScoreRepResult["metrics"] {
  const sum = (pick: (m: ScoreRepResult["metrics"]) => number | null | undefined) =>
    calls.reduce((acc, m) => acc + (pick(m) ?? 0), 0);
  const max = (pick: (m: ScoreRepResult["metrics"]) => number | null | undefined) =>
    calls.reduce((acc, m) => Math.max(acc, pick(m) ?? 0), 0);
  return {
    ...base,
    inputTokens: sum((m) => m.inputTokens),
    outputTokens: sum((m) => m.outputTokens),
    cacheReadTokens: sum((m) => m.cacheReadTokens),
    cacheCreationTokens: sum((m) => m.cacheCreationTokens),
    modelDurationMs: max((m) => m.modelDurationMs),
    ...extra,
  };
}

/**
 * Arm B entry point. Contract-identical to control: returns `{score,
 * metrics}` with all six dimensions + composite; the fan-out is invisible
 * to downstream consumers.
 */
export async function runGroupedFanout(
  input: ScoreRepInput,
  opts?: { toneDecomposition?: boolean; lean?: boolean; holistic?: boolean },
): Promise<ScoreRepResult> {
  const config = resolveArmBConfig();
  const toneDecomposition = opts?.toneDecomposition ?? false;
  const lean = opts?.lean ?? false;
  // holistic-split: split only the output decode; both passes keep full rep
  // context (the fan-out calibration fix). Mutually exclusive with lean/decomp.
  const holistic = opts?.holistic ?? false;
  const scoreRepStart = Date.now();

  const prep = await buildUserPrompt(input);
  const system = buildSystemBlocks({
    rubricBlock: prep.rubricBlock,
    userCalibration: input.userCalibration,
    coachingMemory: input.coachingMemory,
    lean,
  });
  const bytesFor = (userText: string) =>
    computeScoringPromptBytes({
      rubricBlock: prep.rubricBlock,
      userCalibration: input.userCalibration,
      coachingMemory: input.coachingMemory,
      userPrompt: userText,
      lean,
    });

  const contentScope = holistic
    ? CONTENT_SCOPE_HOLISTIC
    : lean
      ? CONTENT_SCOPE_LEAN
      : CONTENT_SCOPE;
  const contentUser = `${contentScope}\n\n${prep.userPrompt}`;
  // Tone-decomposition, holistic, and lean are independent levers, but the
  // decomp scope has its own bespoke JSON shape; holistic keeps full-context
  // reasoning; lean only slims the plain delivery scope.
  const deliveryScope = toneDecomposition
    ? DELIVERY_TONE_DECOMP_SCOPE
    : holistic
      ? DELIVERY_SCOPE_HOLISTIC
      : lean
        ? DELIVERY_SCOPE_LEAN
        : DELIVERY_SCOPE;
  const deliveryUser = `${deliveryScope}\n\n${prep.userPrompt}`;

  // Calls 1 + 2 concurrently. allSettled so one failure degrades to the
  // single-call scorer rather than collapsing to mock-fallback.
  const [contentSettled, deliverySettled] = await Promise.allSettled([
    callScoped(system, contentUser, bytesFor(contentUser)),
    callScoped(system, deliveryUser, bytesFor(deliveryUser)),
  ]);

  const contentDims =
    contentSettled.status === "fulfilled"
      ? parseScoringPass(contentSettled.value.text, CONTENT_DIMS)
      : null;

  // Delivery leg: either a direct delivery+tone pass, or (Arm C) a
  // delivery-direct + tone-decomposed pass rolled up deterministically.
  let deliveryDims: ArmDimension[] | null = null;
  let toneRollup: ToneRollupResult | null = null;
  if (deliverySettled.status === "fulfilled") {
    if (toneDecomposition) {
      const decomp = parseDeliveryToneDecomp(deliverySettled.value.text);
      if (decomp) {
        const hasProsody = hasWorkerProsody(prep.prosodyFeatures);
        toneRollup = rollupTone({
          observations: decomp.observations,
          prosodyScores: hasProsody
            ? measuredToneScores(input, prep.prosodyFeatures)
            : undefined,
          hasProsody,
        });
        deliveryDims = [
          {
            dimension: "delivery",
            score: decomp.deliveryScore,
            signals: decomp.deliverySignals,
            feedback: decomp.deliveryFeedback,
            subSkill: null,
          },
          {
            dimension: "tone",
            score: toneRollup.score,
            signals: [`[toneRollup: ${toneRollup.method}]`],
            feedback: decomp.toneFeedback,
            subSkill: null,
          },
        ];
      }
    } else {
      deliveryDims = parseScoringPass(deliverySettled.value.text, DELIVERY_DIMS);
    }
  }

  if (!contentDims || !deliveryDims) {
    // Graceful degradation: a full, real score via the single-call path.
    const fb = await runSingleCallScore(input, { config });
    fb.metrics.fallbackFired = true;
    fb.metrics.llmCallCount = (fb.metrics.llmCallCount ?? 1) + 2;
    return fb;
  }

  const dims6 = [...contentDims, ...deliveryDims];

  // Call 3 — synthesis. Failure → deterministic envelope (never a full-rep
  // mock-fallback).
  const synthUser = `${renderSynthesisScope(dims6)}\n\n${prep.userPrompt}`;
  let synthCall: ArmCall | null = null;
  let synthesis: SynthesisEnvelope;
  try {
    synthCall = await callScoped(system, synthUser, bytesFor(synthUser));
    synthesis = synthesisPassSchema.parse(extractJson(synthCall.text));
  } catch {
    synthesis = deriveSynthesisFallback(dims6);
    synthCall = null;
  }

  // Merge into the full scoringResponseSchema shape, then reuse the exact
  // control validation + sanitization path (JSON round-trip keeps it DRY
  // and byte-for-byte consistent with the single-call contract).
  const merged = {
    dimensions: dims6.map((d) => ({
      dimension: d.dimension,
      score: d.score,
      signals: d.signals ?? [],
      ...(d.feedback ? { feedback: d.feedback } : {}),
      subSkill: d.subSkill ?? null,
    })),
    headline: synthesis.headline,
    coachFocus: synthesis.coachFocus,
    strongerVersion: synthesis.strongerVersion ?? null,
    headlineTone: synthesis.headlineTone,
    nextRepHint: synthesis.nextRepHint,
    ...(synthesis.structuralAdherence != null
      ? { structuralAdherence: synthesis.structuralAdherence }
      : {}),
    ...(synthesis.implementationReview
      ? { implementationReview: synthesis.implementationReview }
      : {}),
  };

  const validationStart = Date.now();
  const { validated, sanitizedCoachFocus, sanitizedStrongerVersion, sanitizedDimFeedback } =
    parseAndValidate(JSON.stringify(merged), input.transcript);

  const { finalDimensions, dimensionMap } = applyHybridLayer({
    dims: sanitizedDimFeedback,
    input,
    config,
  });

  const contentMetrics = contentSettled.status === "fulfilled" ? contentSettled.value.metrics : null;
  const deliveryMetrics = deliverySettled.status === "fulfilled" ? deliverySettled.value.metrics : null;
  const modelUsed = contentMetrics?.modelUsed ?? deliveryMetrics?.modelUsed;

  const score = assembleRepScore({
    finalDimensions,
    dimensionMap,
    validated,
    input,
    sanitizedCoachFocus,
    sanitizedStrongerVersion,
    prosodyFeatures: prep.prosodyFeatures,
    signalsFlagOn: prep.signalsFlagOn,
    textSignals: prep.textSignals,
    modelUsed,
  });

  // Arm C — roll the tone sub-skills UP into the tone dimension's
  // subSkillScores (they drove the number, so they belong on the card).
  if (toneRollup) {
    const rollupScores = toneRollup.subSkillScores;
    score.dimensions = score.dimensions.map((d) =>
      d.dimension === "tone"
        ? {
            ...d,
            subSkillScores: { ...(d.subSkillScores ?? {}), ...rollupScores },
          }
        : d,
    );
  }

  const validationDurationMs = Date.now() - validationStart;
  const scoreRepTotalMs = Date.now() - scoreRepStart;

  const callMetrics = [contentMetrics, deliveryMetrics, synthCall?.metrics].filter(
    (m): m is ScoreRepResult["metrics"] => m != null,
  );
  const metrics = mergeArmMetrics(callMetrics[0]!, callMetrics, {
    validationDurationMs,
    scoreRepTotalMs,
    ragDurationMs: prep.ragResult.durationMs,
    ragChunkCount: prep.ragResult.chunks.length,
    fallbackFired: callMetrics.some((m) => m.fallbackFired),
    llmCallCount: callMetrics.length,
  });

  return { score, metrics };
}

// ── Per-skill fan-out (arm `per-skill-fanout`) ───────────────────────────
// Six single-dimension scoring calls in PARALLEL + one synthesis call.
// Wall-clock ≈ slowest single-dim decode + synthesis, and each single-dim
// output is tiny (one score + one feedback line), so the decode budget per
// call is a fraction of control's six-in-one. The thesis: max out the
// parallel-decode latency win while giving every dimension its own focused
// reasoning frame and full (small) token budget.
//
// WATCH (Max flagged, quality is the gate): per-dimension isolation is the
// STRONGEST form of the split that regressed tone/conciseness in
// grouped-fanout. Each voice dim (delivery/tone) is now judged with zero
// content context and vice-versa — the bench decides whether the calibration
// holds. Content dims keep the anti-compression guard from the lean CONTENT
// scope (the reusable clarity-fix asset) so short single-dim feedback can't
// manufacture nitpicks that drag a score down.
function renderPerSkillScope(dim: SkillDimension, lean: boolean): string {
  const isVoice = dim === "delivery" || dim === "tone";
  const feedbackShape = lean ? "1 sentence" : "1-2 sentences";
  return [
    `ARM SCOPE — SINGLE DIMENSION PASS: ${dim}.`,
    `Score ONLY ${dim} (0-100). Apply the SCORE CALIBRATION, ANTI-COMPRESSION, DIMENSION INDEPENDENCE, and EDGE-CASE rules from the system prompt EXACTLY — do NOT let any other dimension's strength or weakness move this score.`,
    isVoice
      ? `Ground ${dim} in the PROSODY EVIDENCE and MEASURED RATE lines and the transcript's fluency; reason ONLY about voice and pacing, never the argument's content (mediocre content delivered with genuinely expressive prosody is still HIGH tone). Apply the PROSODY EVIDENCE SCOPE and the delivery/tone edge rules.`
      : `Judge ${dim} from the transcript (and any SIGNALS / RAG CONTEXT). IGNORE delivery and tone — a separate pass grades voice. Write tight, specific feedback; the feedback being short must NEVER pull the score down — if you cannot name a real deficiency, the score is ≥80 per the calibration rules, not a hedged middle.`,
    `Return ONLY this JSON, no prose or fences: {"dimensions":[{"dimension":"${dim}","score":0-100,"feedback":"${feedbackShape} per the PER-SKILL FEEDBACK RULES","subSkill":"snake_case id from the SUB-SKILL REFERENCE for ${dim}"|null}]}`,
    `Include exactly one entry for ${dim}. Do NOT score any other dimension, and do NOT include a headline, coachFocus, or strongerVersion.`,
  ].join("\n");
}

/**
 * Arm entry point — per-skill fan-out. Contract-identical to control:
 * returns `{score, metrics}` with all six dimensions + composite. Graceful
 * degradation mirrors grouped-fanout: any single-dim pass failing to cover
 * its dimension → the full single-call scorer; synthesis failing → the
 * deterministic envelope.
 */
export async function runPerSkillFanout(
  input: ScoreRepInput,
  opts?: { lean?: boolean },
): Promise<ScoreRepResult> {
  const config = resolveArmBConfig();
  const lean = opts?.lean ?? false;
  const scoreRepStart = Date.now();

  const prep = await buildUserPrompt(input);
  const system = buildSystemBlocks({
    rubricBlock: prep.rubricBlock,
    userCalibration: input.userCalibration,
    coachingMemory: input.coachingMemory,
    lean,
  });
  const bytesFor = (userText: string) =>
    computeScoringPromptBytes({
      rubricBlock: prep.rubricBlock,
      userCalibration: input.userCalibration,
      coachingMemory: input.coachingMemory,
      userPrompt: userText,
      lean,
    });

  // Six single-dim calls, concurrent. allSettled so one failure degrades to
  // the single-call scorer rather than collapsing to mock-fallback.
  const settled = await Promise.allSettled(
    ALL_SIX.map((dim) => {
      const user = `${renderPerSkillScope(dim, lean)}\n\n${prep.userPrompt}`;
      return callScoped(system, user, bytesFor(user));
    }),
  );

  const dims6: ArmDimension[] = [];
  const dimMetrics: ScoreRepResult["metrics"][] = [];
  for (let i = 0; i < ALL_SIX.length; i++) {
    const dim = ALL_SIX[i]!;
    const s = settled[i]!;
    const parsed =
      s.status === "fulfilled" ? parseScoringPass(s.value.text, [dim]) : null;
    if (!parsed) {
      // Graceful degradation: a full, real score via the single-call path.
      const fb = await runSingleCallScore(input, { config });
      fb.metrics.fallbackFired = true;
      fb.metrics.llmCallCount = (fb.metrics.llmCallCount ?? 1) + (i + 1);
      return fb;
    }
    dims6.push(parsed[0]!);
    if (s.status === "fulfilled") dimMetrics.push(s.value.metrics);
  }

  // Synthesis — reuse the grouped-fanout envelope pass verbatim.
  const synthUser = `${renderSynthesisScope(dims6)}\n\n${prep.userPrompt}`;
  let synthCall: ArmCall | null = null;
  let synthesis: SynthesisEnvelope;
  try {
    synthCall = await callScoped(system, synthUser, bytesFor(synthUser));
    synthesis = synthesisPassSchema.parse(extractJson(synthCall.text));
  } catch {
    synthesis = deriveSynthesisFallback(dims6);
    synthCall = null;
  }

  const merged = {
    dimensions: dims6.map((d) => ({
      dimension: d.dimension,
      score: d.score,
      signals: d.signals ?? [],
      ...(d.feedback ? { feedback: d.feedback } : {}),
      subSkill: d.subSkill ?? null,
    })),
    headline: synthesis.headline,
    coachFocus: synthesis.coachFocus,
    strongerVersion: synthesis.strongerVersion ?? null,
    headlineTone: synthesis.headlineTone,
    nextRepHint: synthesis.nextRepHint,
    ...(synthesis.structuralAdherence != null
      ? { structuralAdherence: synthesis.structuralAdherence }
      : {}),
    ...(synthesis.implementationReview
      ? { implementationReview: synthesis.implementationReview }
      : {}),
  };

  const validationStart = Date.now();
  const { validated, sanitizedCoachFocus, sanitizedStrongerVersion, sanitizedDimFeedback } =
    parseAndValidate(JSON.stringify(merged), input.transcript);

  const { finalDimensions, dimensionMap } = applyHybridLayer({
    dims: sanitizedDimFeedback,
    input,
    config,
  });

  const modelUsed = dimMetrics[0]?.modelUsed ?? synthCall?.metrics.modelUsed;

  const score = assembleRepScore({
    finalDimensions,
    dimensionMap,
    validated,
    input,
    sanitizedCoachFocus,
    sanitizedStrongerVersion,
    prosodyFeatures: prep.prosodyFeatures,
    signalsFlagOn: prep.signalsFlagOn,
    textSignals: prep.textSignals,
    modelUsed,
  });

  const validationDurationMs = Date.now() - validationStart;
  const scoreRepTotalMs = Date.now() - scoreRepStart;

  const callMetrics = [...dimMetrics, synthCall?.metrics].filter(
    (m): m is ScoreRepResult["metrics"] => m != null,
  );
  const metrics = mergeArmMetrics(callMetrics[0]!, callMetrics, {
    validationDurationMs,
    scoreRepTotalMs,
    ragDurationMs: prep.ragResult.durationMs,
    ragChunkCount: prep.ragResult.chunks.length,
    fallbackFired: callMetrics.some((m) => m.fallbackFired),
    llmCallCount: callMetrics.length,
  });

  return { score, metrics };
}

/** Test-only surface for the pure Arm B internals (parsing, fallback,
 *  config, scope rendering) — the LLM calls can't run headless. */
export const __armBForTests = {
  renderPerSkillScope,
  parseScoringPass,
  parseDeliveryToneDecomp,
  measuredToneScores,
  deriveSynthesisFallback,
  resolveArmBConfig,
  renderSynthesisScope,
  synthesisPassSchema,
  CONTENT_SCOPE,
  DELIVERY_SCOPE,
  CONTENT_SCOPE_LEAN,
  DELIVERY_SCOPE_LEAN,
  CONTENT_SCOPE_HOLISTIC,
  DELIVERY_SCOPE_HOLISTIC,
  DELIVERY_TONE_DECOMP_SCOPE,
  CONTENT_DIMS,
  DELIVERY_DIMS,
};
