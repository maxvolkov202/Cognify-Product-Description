/**
 * Phase 5 — Two-stage scoring.
 *
 * Splits the single-call scoreRepWithMetrics into:
 *
 *   Stage 1 — SCORING ONLY. Returns 6 dim scores + composite +
 *             primaryFocusDimension + headlineTone. Small output (~300
 *             tokens), small system prompt (no copywriting instructions
 *             at all). Fires fast; user sees the dimension grid quickly.
 *
 *   Stage 2 — COPY ONLY. Takes stage 1's scores as input and writes
 *             headline + 3 callouts + didWell / didntLand /
 *             nextRepFocus + nextRepHint. Larger output (~1800 tokens),
 *             different system prompt focused on copywriting rules.
 *             Anchored to stage 1's primaryFocusDimension + scores so
 *             the copy can be tightly grounded in what was actually
 *             scored.
 *
 * Why two stages, not one:
 *   1. Smaller, more focused prompts per stage → cleaner outputs, fewer
 *      validation failures
 *   2. User sees scores after stage 1 (~1-2s typical) instead of
 *      waiting for the full 5+ second response
 *   3. Stage 2 knows the scores, so copy can ground in them ("clarity
 *      scored 64 — explain why the listener had to work")
 *   4. Cost increase is small: stage 1 is ~10% of stage 2's tokens
 *
 * Compatibility: the existing single-call path (scoreRepWithMetrics in
 * ./score.ts) is unchanged. Callers opt into two-stage by importing
 * from this module.
 */

import { z } from "zod";
import { anthropic, MODELS, MODEL_VERSIONS } from "./claude";
import type { AnthropicCallMetrics } from "./claude";
import {
  ALL_DIMENSIONS,
  DIMENSION_RUBRIC,
  RUBRIC_VERSION,
  composite,
} from "@/lib/scoring/rubric";
import type {
  RepScore,
  SkillDimension,
  Callout,
  FeedbackBullet,
  NextRepFocusItem,
} from "@/types/domain";
import { FEEDBACK_VERSION } from "@/types/domain";
import { loadSkill, renderBlocks } from "./knowledge";
import {
  extractSignals,
  extractAllTextSignals,
  renderTextSignalsBlock,
  type TextSignals,
} from "@/lib/scoring/signals";
import {
  scorePacing,
  scoreThinkingQualityDeterministic,
  blendScores,
} from "@/lib/scoring/deterministic";
import {
  extractInlineProsody,
  mergeProsody,
} from "@/lib/audio/prosody-inline";
import {
  hasWorkerProsody,
  renderProsodyBlock,
  type ProsodyFeatures,
} from "@/lib/audio/prosody";
import { extractWorkerProsody } from "@/lib/audio/prosody-worker";
import {
  retrieveKnowledgeForRep,
  renderRagContextBlock,
} from "./rag/retrieve";
import {
  retrieveSimilarReps,
  renderReferenceRepsBlock,
} from "./rag/reference-reps";
import type { ScoreRepInput, ScoreRepResult } from "./score";
import { renderRetryEvaluationBlock } from "./score";
import {
  getExerciseScoringContext,
  renderExerciseXmlBlock,
  tryExerciseFastFail,
  type ExerciseScoringContext,
} from "./muscle-group-exercises";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";

// ——— Stage 1 system prompt (SCORING ONLY) ——————————————————————

const stage1SystemPrompt = `You are the scoring engine for Cognify, a communication training gym. Your ONLY job is to assign accurate 0-100 scores to a rep across six dimensions. You do NOT write callouts, headlines, or coaching text in this call — a separate stage handles all copy.

Dimensions (always in this order):
  CONTENT  : clarity, structure, conciseness, thinking_quality
  DELIVERY : delivery, tone

SCORING BANDS — apply these strictly. DO NOT anchor to mid-range (55-65) when you can't find evidence. If the rep didn't demonstrate the dim, score it honestly LOW. Sugar-coating destroys training value. Users came here to improve; they need honest grades to do that.

  10-25  Barely tried. Silence, one sentence, off-topic, mic test, rambling that never lands, fails the rule outright. Apply to BOTH content and delivery dims when the rep has no real attempt.
  30-45  Vague / surface-level. They spoke but missed the rule, dodged depth, drifted off the prompt, or rambled without landing.
  50-60  Generic. Hit the basics. No major failure but no notable strength either.
  65-80  Strong. Clear, substantive, executed the rule. A listener would notice the quality.
  85-95  Excellent. Would stand out in any room. Specific, sharp, well-constructed.
  95+    Reserved. Genuinely exceptional. Multiple dims must agree.

EXPLICIT FLOORS (override band rules when triggered):
  - Off-topic rep (didn't answer the prompt): cap ALL dims at 35.
  - Junk rep (mic test, gibberish, <5 words of real content): cap ALL dims at 25.
  - Silence-heavy rep (>50% silence): delivery + pacing capped at 30.
  - Rule violation that defines the exercise (e.g. fillers in Kill-the-Filler, jargon in No-Jargon, >30s in 30-Second-Rule): cap the EXERCISE'S PRIMARY dim at 40.

Return ONLY a JSON object (no prose, no markdown fences):

{
  "dimensions": [
    { "dimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone", "score": 0-100, "signals": ["≤80 char reason"] }
  ],
  "structuralAdherence": 0-100 (only when frameworkNodes provided, else omit),
  "primaryFocusDimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone",
  "headlineTone": "blunt"|"directive"|"praise"|"celebratory"
}

EDGE-CASE GRADING RULES (override per-dim rubric in conflict):
  1. Brevity-at-cost-of-meaning: clarity hit, not Conciseness reward.
  2. Shallow-but-organized: HIGH structure, LOW thinking_quality. Don't reward scaffolding for weak reasoning.
  3. Fast-and-no-fillers: 220+ wpm without filler still scores LOW on Delivery. Rate is part of pacing.
  4. Variety-with-upspeak: strong vocal variety does NOT cancel a consistent upspeak pattern. Tone stays LOW.
  5. Short-but-deep: <30s rep that fully engaged the prompt can score high. If it dodged depth, Thinking Quality drops.

PRIMARY FOCUS DIMENSION:
  - Pick the single dim that needs the user's attention next rep.
  - In focus mode: usually the focus dim, UNLESS focusDim >= 85 AND another dim < 60 (pivot to the new weakest).
  - In combined / pressure modes: lowest-scoring dim after weights.
  - When composite ≥ 95: pick the LOWEST dim regardless (only remaining work).

HEADLINE TONE BAND (you don't write the headline here — stage 2 does — but pick the band the headline SHOULD be in based on composite):
  - composite < 50  → "blunt"
  - 50-74           → "directive"
  - 75-89           → "praise"
  - ≥ 90            → "celebratory"

Output strict JSON only. Stage 2 will use your output to write the user-facing copy.`;

// ——— Stage 2 system prompt (COPYWRITING ONLY) —————————————————————

const stage2SystemPrompt = `You are the copywriting engine for Cognify. A separate scoring stage has already assigned 0-100 scores across six dimensions for this rep. Your ONLY job is to write the user-facing feedback copy that grounds in those scores.

You will be given (in the user message):
  - the same transcript + signals + prosody + RAG context as the scoring stage
  - the SCORING OUTPUT from stage 1 (dimension scores, primaryFocusDimension, headlineTone)

You DO NOT re-score. The scores are canonical. Your job is to write tight, grounded copy that explains WHY those scores were assigned and gives the user one prescriptive thing to work on next rep.

Return ONLY a JSON object (no prose, no markdown fences):

{
  "callouts": [
    { "dimension": "...", "tone": "positive"|"neutral"|"warn"|"critical", "title": "≤80 chars", "body": "≤300 chars", "quote": "verbatim from transcript"|null, "suggestedRewrite": "speakable, ≤360 chars"|null, "transcriptStart": ms, "transcriptEnd": ms }
  ],
  "headline": "one sentence, ≤200 chars, see HEADLINE RULES",
  "didWell": [{ "text": "≤140 chars, second-person", "dimension": "...", "subSkill": "snake_case"|null, "quote": "verbatim"|null, "transcriptStart": ms|null, "transcriptEnd": ms|null }],
  "didntLand": [{ "text": "...", "dimension": "...", "subSkill": "..."|null, "quote": "...", "transcriptStart": ms|null, "transcriptEnd": ms|null }],
  "nextRepFocus": [{ "text": "prescriptive", "dimension": "...", "subSkill": "..."|null, "quote": "..."|null, "transcriptStart": null, "transcriptEnd": null, "exampleLine": "speakable"|null }],
  "nextRepHint": "3-8 words, present tense, second-person, no period"
}

HEADLINE RULES (the single most important sentence the user reads):
  - One sentence, ≤90 chars where possible, ≤200 chars max. Second-person ("you"), present-tense, no hedging.
  - Tone matches the headlineTone band that stage 1 picked:
      blunt       → name what failed. e.g. "Your ideas were there. Your structure collapsed before they landed."
      directive   → name the one fix that moves the score most. e.g. "You had the point — you just buried it under three setups."
      praise      → specific praise + sharpening edge. e.g. "Clean from open to ask. Tighten the middle and this is a 90."
      celebratory → raise the bar. e.g. "Nothing to fix on this one. Try it again with a harder audience."
  - Junk reps: honest verdict, not coaching. e.g. "That wasn't the prompt. Try it again."
  - BANNED in headline: "great rep", "good rep", "nice rep", emoji, exclamation marks, score numbers, percentages.

CALLOUT RULES:
  - Exactly 3 callouts: 1 positive + 2 warn/critical. The two improvements target the TWO lowest-scoring dimensions (one each).
  - PER-DIMENSION FEEDBACK SHAPE:
    * HOLISTIC dims (structure, thinking_quality, delivery): quote=null, transcriptStart=null, transcriptEnd=null. Body is a 1-2 sentence WHOLE-RESPONSE verdict — describe how the response succeeded or failed at this dim ACROSS THE FULL RESPONSE. Not a transcript moment. Examples of good holistic verdicts:
        - structure (low): "Your response had no clear arc — you opened mid-thought, jumped between three half-finished points, and ended without landing the main idea. Listeners had no map."
        - thinking_quality (low): "You described what happens without explaining why. The reasoning stayed at the surface — no causes, no stakes, no counterargument."
        - delivery (low): "Your energy was flat from start to finish. No emphasis shift on the load-bearing words, no dynamic range on the key beats."
    * QUOTE-BASED dims (clarity, conciseness, tone, pacing): quote=verbatim transcript span (must be a real substring). Body explains why THIS MOMENT demonstrates the dim score. transcriptStart/transcriptEnd in ms.
  - Warn/critical callouts include a 'suggestedRewrite':
    * Quote-based dims: a speakable rewrite of the quoted line (same length or shorter, user's voice).
    * Holistic dims: a guiding principle for the next attempt ("Open with a 3-point map and stick to it through the close.") — not a sentence rewrite.
  - Positive callouts set suggestedRewrite=null regardless of dim type.
  - NEVER write "you said X" for a holistic-dim callout. Holistic callouts describe the response globally; quote-anchoring it would mislead the reader into thinking that one moment caused the score.

BULLET RULES (didWell / didntLand / nextRepFocus):
  - didWell: exactly 2 bullets normally. ALLOWED 0 only when composite < 25 (no manufactured praise on junk reps).
  - didntLand: exactly 2 bullets, paired with the 2 nextRepFocus items (each gap → paired fix at same index).
  - nextRepFocus: exactly 2 bullets, prescriptive ("Open with a direction-setting sentence so the listener knows where you're going.")
  - SUB-SKILL: every bullet MUST set 'subSkill' to a sub-skill within the named 'dimension'. The sub-skill must belong to the bullet's dimension (Word Choice belongs to Clarity, not Structure). Use the SUB-SKILL REFERENCE block in the user message.
  - text ≤140 chars, second-person, action-oriented, no hedging.

GROUNDING (mirrors the callout shape split):
  - QUOTE-BASED dims (clarity, conciseness, tone, pacing): didWell + didntLand bullets MUST cite a verbatim transcript phrase in 'quote' and a timestamp range.
  - HOLISTIC dims (structure, thinking_quality, delivery): didWell + didntLand bullets set quote=null, transcriptStart=null, transcriptEnd=null. The bullet text describes the whole-response behavior, not a moment.
  - nextRepFocus may have quote=null + transcriptStart=null + transcriptEnd=null when the advice is universal ("open with a direction-setting sentence"). If you tie nextRepFocus to a specific moment AND the dim is quote-based, populate quote + timestamps.
  - Never write "you said X" / "when you mentioned X" for a holistic dim, even on quote-based dims it must be a real verbatim phrase.

BANNED in titles, bodies, bullet text: "good job", "great job", "nice work", "nice job", "well done", "way to go", "keep it up", "you got this", "you're doing great", "you did well". Drop filler adverbs (really, very, quite). Avoid hype verbs (crushed, absolutely, nailed).

NEXT REP HINT:
  - 3-8 words, present-tense, second-person, no period.
  - Becomes the tail of the next rep's banner. Tied to primaryFocusDimension. Specific over generic.
  - No "focus on" / "work on" filler — give an action.

This is COPY ONLY. Do not include 'dimensions', 'primaryFocusDimension', or 'headlineTone' in your output — those came from stage 1.`;

// ——— Shared knowledge load (slim variants) ——————————————————————

const LLM_SCORED_DIMENSIONS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "tone",
];

function renderCompactRubric(): string {
  return LLM_SCORED_DIMENSIONS.map((d) => {
    const r = DIMENSION_RUBRIC[d];
    return `## ${d}
${r.definition}
Low: ${r.lowScoreSignals.slice(0, 3).join("; ")}
High: ${r.highScoreSignals.slice(0, 3).join("; ")}`;
  }).join("\n\n");
}

const COMPACT_RUBRIC = renderCompactRubric();

function loadLlmScoredKnowledge(): string {
  const blocks = LLM_SCORED_DIMENSIONS.map((d) => loadSkill(d)).filter(
    (b): b is NonNullable<typeof b> => b !== null,
  );
  return renderBlocks(blocks);
}
const COMPACT_KNOWLEDGE = loadLlmScoredKnowledge();

// ——— Stage 1 schema ——————————————————————————————————————————

const stage1Schema = z.object({
  dimensions: z
    .array(
      z.object({
        dimension: z.enum([
          "clarity",
          "structure",
          "conciseness",
          "thinking_quality",
          "delivery",
          "tone",
        ]),
        score: z.number().min(0).max(100),
        signals: z.array(z.string()),
      }),
    )
    .length(ALL_DIMENSIONS.length),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  primaryFocusDimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  headlineTone: z.enum(["blunt", "directive", "praise", "celebratory"]),
});

// ——— Stage 2 schema —————————————————————————————————————————

const calloutSchema = z.object({
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
    "structural_adherence",
  ]),
  tone: z.enum(["positive", "neutral", "warn", "critical"]),
  title: z.string().max(80),
  body: z.string().max(320),
  quote: z.string().max(320).nullable(),
  suggestedRewrite: z.string().max(360).nullable(),
  // Nullable; upstream normalize coerces missing keys (undefined) to null
  // before parse so the LLM omitting these doesn't trip the schema.
  transcriptStart: z.number().min(0).nullable(),
  transcriptEnd: z.number().min(0).nullable(),
});

const bulletSchema = z.object({
  text: z.string().min(1).max(280),
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
    "structural_adherence",
  ]),
  subSkill: z.string().nullable().optional(),
  quote: z.string().max(320).nullable(),
  transcriptStart: z.number().min(0).nullable(),
  transcriptEnd: z.number().min(0).nullable(),
});

const stage2Schema = z.object({
  callouts: z.array(calloutSchema).min(3).max(3),
  headline: z.string().min(1).max(200),
  didWell: z.array(bulletSchema).max(2),
  didntLand: z.array(bulletSchema).max(2),
  nextRepFocus: z
    .array(bulletSchema.extend({ exampleLine: z.string().max(360).nullable() }))
    .max(2),
  nextRepHint: z.string().min(2).max(60),
  /** PRD v3 engine — present only when the user prompt carried a
   *  RETRY EVALUATION block. Optional so non-retry reps validate
   *  unchanged; deriveImplementationVerdict() covers omission. */
  implementationReview: z
    .object({
      verdict: z.enum(["nailed", "partial", "missed"]),
      note: z.string().min(1).max(280),
    })
    .nullable()
    .optional(),
});

// ——— Stage outputs ——————————————————————————————————————————

export type Stage1Output = z.infer<typeof stage1Schema> & {
  composite: number;
};

export type Stage2Output = z.infer<typeof stage2Schema>;

export type ScoreStageMetrics = AnthropicCallMetrics & {
  validationDurationMs: number;
  ragDurationMs: number;
  ragChunkCount: number;
};

// ——— Shared scoring context (used by both stages) ——————————————

type ScoringContext = {
  userPrompt: string;
  cachedSystemBlocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  prosodyFeatures: ProsodyFeatures | null;
  textSignals: TextSignals | null;
  ragDurationMs: number;
  ragChunkCount: number;
  hasWordTimestamps: boolean;
  /** Phase 8 — exercise context for Stage 2's constraint-hint append.
   *  NULL when input.exerciseId was unset or hydration failed. */
  exerciseCtx: ExerciseScoringContext | null;
};

async function prepareContext(input: ScoreRepInput): Promise<ScoringContext> {
  const hasWordTimestamps = !!(input.words && input.words.length > 0);

  // Phase 8 + B — exercise hydration moved before RAG so the muscle-
  // group dimension can pin the preferred RAG chunk. Hydration runs
  // concurrently with prosody / RAG via Promise.all below; the
  // resolved value is used both for the user-prompt XML block and the
  // RAG preferredDim hint. Legacy reps (no exerciseId) skip entirely
  // and produce byte-identical prompts to today.
  const exerciseCtxPromise: Promise<ExerciseScoringContext | null> =
    input.exerciseId
      ? getExerciseScoringContext(input.exerciseId)
      : Promise.resolve(null);

  // Resolve the exercise hint up front so we know the preferred dim for
  // RAG. This is one small indexed SELECT (~5ms p50); negligible against
  // the ~1.5-3s scoring path. Reused below for the XML block and rubric
  // hint, so the cost is amortized.
  const exerciseCtx = await exerciseCtxPromise;
  const preferredDim = exerciseCtx
    ? muscleGroupToSkillDim(exerciseCtx.dimension)
    : null;

  // RAG retrieval — fire concurrently with prosody worker (when worker
  // is configured).
  const ragEnabled = process.env.FF_RAG_RETRIEVE !== "false";
  const ragPromise = ragEnabled
    ? retrieveKnowledgeForRep({
        transcript: input.transcript,
        scoredDims: LLM_SCORED_DIMENSIONS,
        preferredDim,
      })
    : Promise.resolve<Awaited<ReturnType<typeof retrieveKnowledgeForRep>>>({
        chunks: [],
        durationMs: 0,
        failureReason: null,
      });

  const inlineProsody = input.prosodyFeatures
    ? null
    : hasWordTimestamps
      ? extractInlineProsody({
          words: input.words!,
          durationMs: input.durationMs,
        })
      : null;
  const workerPromise =
    input.audioUrl != null
      ? extractWorkerProsody({
          audioUrl: input.audioUrl,
          durationMs: input.durationMs,
        })
      : Promise.resolve(null);
  const [workerProsody, ragResult] = await Promise.all([
    workerPromise,
    ragPromise,
  ]);
  const prosodyFeatures =
    input.prosodyFeatures ??
    (inlineProsody ? mergeProsody(inlineProsody, workerProsody) : null);
  const prosodyBlock = renderProsodyBlock(prosodyFeatures);
  const ragBlock = renderRagContextBlock(ragResult.chunks);

  // Text signals — same gate as the legacy path.
  let textSignals: TextSignals | null = null;
  let signalsBlock: string | null = null;
  if (process.env.FF_DETERMINISTIC_SIGNALS === "true") {
    textSignals = extractAllTextSignals({
      transcript: input.transcript,
      durationMs: input.durationMs,
      words: input.words,
    });
    signalsBlock = renderTextSignalsBlock(textSignals);
  }

  const exerciseXml = exerciseCtx ? renderExerciseXmlBlock(exerciseCtx) : null;

  const timedTranscript = input.transcript;
  // PRD v3 engine — retry-evaluation context. Rendered ONLY when the rep
  // is a retry (modeContext.retryContext set); non-retry prompts stay
  // byte-identical, so calibration reference runs are unaffected. The
  // two-stage path deliberately does NOT render the rest of the MODE
  // block (it never has).
  const retryBlock = renderRetryEvaluationBlock(
    input.modeContext?.retryContext,
  );
  const userPrompt = [
    exerciseXml,
    input.frameworkNodes
      ? `FRAMEWORK (score structural_adherence against these nodes in order):\n${input.frameworkNodes
          .map((n, i) => `${i + 1}. ${n.label}: ${n.description}`)
          .join("\n")}`
      : null,
    `PROMPT: ${input.promptText}`,
    `REP DURATION: ${(input.durationMs / 1000).toFixed(1)}s`,
    retryBlock,
    ragBlock,
    signalsBlock,
    prosodyBlock,
    hasWordTimestamps
      ? `TRANSCRIPT:\n${timedTranscript}`
      : `TRANSCRIPT:\n${timedTranscript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Stage-specific system prompts get injected separately; the shared
  // cached blocks (rubric + knowledge) live here so both stages reuse
  // the same Anthropic prompt cache entries.
  const cachedSystemBlocks: ScoringContext["cachedSystemBlocks"] = [
    {
      type: "text",
      text: `RUBRIC (only the four LLM-scored dimensions; delivery and thinking_quality are scored separately):\n\n${COMPACT_RUBRIC}`,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (COMPACT_KNOWLEDGE) {
    cachedSystemBlocks.push({
      type: "text",
      text: `SCORING KNOWLEDGE (clarity, structure, conciseness, tone):\n\n${COMPACT_KNOWLEDGE}`,
      cache_control: { type: "ephemeral" },
    });
  }

  return {
    userPrompt,
    cachedSystemBlocks,
    prosodyFeatures,
    textSignals,
    ragDurationMs: ragResult.durationMs,
    ragChunkCount: ragResult.chunks.length,
    hasWordTimestamps,
    exerciseCtx,
  };
}

function computePromptBytes(systemText: string, userText: string): number {
  return Buffer.byteLength(systemText, "utf8") + Buffer.byteLength(userText, "utf8");
}

/** Coerce missing transcript anchors / quote on callout + bullet items
 *  to null. gpt-4o + others sometimes omit those fields entirely (lands
 *  as `undefined` after JSON.parse) which the nullable Zod schemas
 *  reject. Was the dominant validation_failed cause in 2026-05-21 replay
 *  testing. */
function normalizeAnchorFieldsInArrays(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = { ...(parsed as Record<string, unknown>) };
  for (const key of [
    "callouts",
    "didWell",
    "didntLand",
    "nextRepFocus",
  ] as const) {
    const arr = obj[key];
    if (!Array.isArray(arr)) continue;
    obj[key] = arr.map((item) => {
      if (!item || typeof item !== "object") return item;
      const it = { ...(item as Record<string, unknown>) };
      if (!("transcriptStart" in it) || it.transcriptStart === undefined) {
        it.transcriptStart = null;
      }
      if (!("transcriptEnd" in it) || it.transcriptEnd === undefined) {
        it.transcriptEnd = null;
      }
      if (!("quote" in it) || it.quote === undefined) {
        it.quote = null;
      }
      if (key === "callouts") {
        if (!("suggestedRewrite" in it) || it.suggestedRewrite === undefined) {
          it.suggestedRewrite = null;
        }
      }
      return it;
    });
  }
  return obj;
}

function parseJsonResponse<T>(
  responseText: string,
  schema: z.ZodSchema<T>,
  stageName: string,
): T {
  const MAX_BYTES = 64 * 1024;
  if (responseText.length > MAX_BYTES) {
    throw new Error(
      `${stageName} response exceeded ${MAX_BYTES}B (${responseText.length}B). First 500 chars: ${responseText.slice(0, 500)}`,
    );
  }
  const stripped = responseText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  const cleaned =
    firstBrace !== -1 && lastBrace > firstBrace
      ? stripped.slice(firstBrace, lastBrace + 1)
      : stripped;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `${stageName} response was not valid JSON. Got: ${responseText.slice(0, 500)}`,
    );
  }
  parsed = normalizeAnchorFieldsInArrays(parsed);
  return schema.parse(parsed);
}

// ——— Stage 1 — SCORING ————————————————————————————————————

export type Stage1Result = {
  stage1: Stage1Output;
  metrics: ScoreStageMetrics;
  /** Context cached for reuse in stage 2 — avoids re-running RAG +
   *  prosody. Callers that invoke stage 2 should pass this through. */
  context: ScoringContext;
};

export async function scoreStage1(input: ScoreRepInput): Promise<Stage1Result> {
  const context = await prepareContext(input);

  const systemText =
    stage1SystemPrompt +
    "\n\n" +
    context.cachedSystemBlocks.map((b) => b.text).join("\n\n");
  const promptSizeBytes = computePromptBytes(systemText, context.userPrompt);

  const { response, metrics: callMetrics } =
    await anthropic.messages.createWithMetrics(
      {
        model: MODELS.scoring,
        // Stage 1 output is small (6 dim entries + 3 short fields) —
        // 400 tokens is generous headroom.
        max_tokens: 400,
        temperature: 0.2,
        system: [
          { type: "text", text: stage1SystemPrompt, cache_control: { type: "ephemeral" } },
          ...context.cachedSystemBlocks,
        ],
        messages: [{ role: "user", content: [{ type: "text", text: context.userPrompt }] }],
      },
      promptSizeBytes,
    );

  const validationStart = Date.now();
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Stage 1 returned no text content");
  }
  const validated = parseJsonResponse(textBlock.text, stage1Schema, "Stage 1");

  // Apply deterministic blend for delivery + thinking_quality, same as
  // the legacy path. Pacing is fully deterministic; thinking is 60/40
  // det/llm.
  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of validated.dimensions) dimensionMap[d.dimension] = d.score;
  let finalDimensions = validated.dimensions.map((d) => ({ ...d }));
  if (input.words && input.words.length > 0) {
    const sig = extractSignals({
      words: input.words,
      transcript: input.transcript,
      durationMs: input.durationMs,
      timeBudgetMs: input.timeBudgetMs ?? input.durationMs,
    });
    const det = scorePacing(sig);
    dimensionMap.delivery = det.score;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "delivery"
        ? { dimension: "delivery" as const, score: det.score, signals: det.signals }
        : d,
    );
    const thinkDet = scoreThinkingQualityDeterministic(sig);
    const llmThink = dimensionMap.thinking_quality ?? 60;
    const blended = blendScores(thinkDet.score, llmThink, 0.6);
    dimensionMap.thinking_quality = blended;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "thinking_quality"
        ? { dimension: "thinking_quality" as const, score: blended, signals: [...thinkDet.signals, `(LLM: ${llmThink})`] }
        : d,
    );

    // Phase 8 — exercise fast-fail. Only fires when context.exerciseCtx
    // is set; legacy reps (Skill Lab, scenario, baseline) skip this
    // entirely and produce byte-identical composites.
    if (context.exerciseCtx) {
      const fastFail = tryExerciseFastFail({
        slug: context.exerciseCtx.slug,
        fillerRate: sig.fillerRate,
        durationMs: input.durationMs,
      });
      if (fastFail) {
        for (const [dim, override] of Object.entries(fastFail.overrides)) {
          if (override == null) continue;
          const d = dim as SkillDimension;
          dimensionMap[d] = override;
          finalDimensions = finalDimensions.map((dx) =>
            dx.dimension === d
              ? {
                  dimension: d,
                  score: override,
                  signals: [
                    ...(dx.signals ?? []),
                    `(exercise fast-fail: ${context.exerciseCtx!.slug})`,
                  ],
                }
              : dx,
          );
        }
      }
    }
  }

  const compositeScore = composite(dimensionMap, input.weights);
  const validationDurationMs = Date.now() - validationStart;

  return {
    stage1: {
      dimensions: finalDimensions,
      ...(validated.structuralAdherence != null
        ? { structuralAdherence: validated.structuralAdherence }
        : {}),
      primaryFocusDimension: validated.primaryFocusDimension,
      headlineTone: validated.headlineTone,
      composite: compositeScore,
    },
    metrics: {
      ...callMetrics,
      validationDurationMs,
      ragDurationMs: context.ragDurationMs,
      ragChunkCount: context.ragChunkCount,
    },
    context,
  };
}

// ——— Stage 2 — COPYWRITING ——————————————————————————————

export type Stage2Result = {
  stage2: Stage2Output;
  metrics: ScoreStageMetrics;
  /** Phase 6 — diagnostic info on the few-shot exemplar retrieval. */
  exemplarMatches: number;
  exemplarRetrieveMs: number;
};

export async function scoreStage2(
  input: ScoreRepInput,
  stage1: Stage1Output,
  contextIn?: ScoringContext,
): Promise<Stage2Result> {
  const context = contextIn ?? (await prepareContext(input));

  // Phase 6 — few-shot exemplar retrieval. Fires BEFORE the stage 2
  // LLM call so we can inject the matches. Per-call timeout is 1s; on
  // any failure we proceed without exemplars (Stage 2 falls back to
  // rubric + RAG anchors). Gated by FF_REFERENCE_REPS so the bank can
  // be disabled if it ever shows quality regressions.
  const refRepsEnabled = process.env.FF_REFERENCE_REPS !== "false";
  const refRepsResult: Awaited<ReturnType<typeof retrieveSimilarReps>> =
    refRepsEnabled
      ? await retrieveSimilarReps({ transcript: input.transcript })
      : { matches: [], durationMs: 0, failureReason: null };
  const exemplarsBlock = renderReferenceRepsBlock(refRepsResult.matches);

  // Stage 2 adds the stage 1 output to the user prompt so the
  // copywriting can ground in the actual scores.
  const stage1Block = `STAGE 1 SCORES (canonical — do not re-score):\n${JSON.stringify(
    {
      dimensions: stage1.dimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
      })),
      composite: stage1.composite,
      primaryFocusDimension: stage1.primaryFocusDimension,
      headlineTone: stage1.headlineTone,
    },
    null,
    2,
  )}`;

  // Phase 8 — exercise rubric AUGMENTATION. Single operator-facing
  // constraint sentence appended ONLY when a registered hint exists
  // for the exercise. Phrased as a rubric instruction so the LLM
  // treats it as a scoring rule, not feedback to render verbatim.
  const exerciseHintBlock =
    context.exerciseCtx?.hint
      ? `EXERCISE CONSTRAINT (augments rubric — operator-facing, do NOT render to user verbatim):\n${context.exerciseCtx.hint}`
      : null;

  // Compose the user prompt. Exemplars come BEFORE stage 1 + the rest
  // of the context so the model reads "what good feedback looks like
  // on similar reps" first, then the canonical scores it has to
  // ground in.
  const userPromptWithStage1 = [
    exemplarsBlock,
    stage1Block,
    exerciseHintBlock,
    context.userPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemText =
    stage2SystemPrompt +
    "\n\n" +
    context.cachedSystemBlocks.map((b) => b.text).join("\n\n");
  const promptSizeBytes = computePromptBytes(systemText, userPromptWithStage1);

  const { response, metrics: callMetrics } =
    await anthropic.messages.createWithMetrics(
      {
        model: MODELS.scoring,
        // Stage 2 output is large: headline + 3 callouts + 6 bullets.
        // Phase 8 (2026-05-21) — bumped from 1800 to 2800 after the
        // legacy /api/score path showed Haiku consistently hitting its
        // max_tokens cap on rich-signal reps. Stage 2 is similar in
        // shape (callouts + bullets dominate output) so we apply the
        // same cap headroom here. Stage 1 stays at 400 since its
        // output is genuinely small (6 dim scores + 3 short fields).
        max_tokens: 2800,
        temperature: 0.2,
        system: [
          { type: "text", text: stage2SystemPrompt, cache_control: { type: "ephemeral" } },
          ...context.cachedSystemBlocks,
        ],
        messages: [
          { role: "user", content: [{ type: "text", text: userPromptWithStage1 }] },
        ],
      },
      promptSizeBytes,
    );

  const validationStart = Date.now();
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Stage 2 returned no text content");
  }
  const validated = parseJsonResponse(textBlock.text, stage2Schema, "Stage 2");
  const validationDurationMs = Date.now() - validationStart;

  return {
    stage2: validated,
    metrics: {
      ...callMetrics,
      validationDurationMs,
      // Stage 2 reuses the same RAG context — no additional retrieval.
      ragDurationMs: 0,
      ragChunkCount: context.ragChunkCount,
    },
    exemplarMatches: refRepsResult.matches.length,
    exemplarRetrieveMs: refRepsResult.durationMs,
  };
}

// ——— Combined wrapper (for backward-compat callers) ———————————

/**
 * Phase 5 — assemble the full RepScore from stage1 + stage2 outputs.
 * Exported so the /api/score/stage2 route can return the same shape
 * /api/score does, keeping client-side saveRep persistence unchanged.
 *
 * Stage1Output + Stage2Output + the (optional) prosody features from
 * the scoring context are all we need to produce a complete RepScore.
 * When prosody is absent (e.g. /api/score/stage2 was called without
 * a precomputed context), prosodyAvailable defaults to false.
 */
export function assembleRepScore(
  stage1: Stage1Output,
  stage2: Stage2Output,
  opts?: { prosodyFeatures?: ProsodyFeatures | null },
): RepScore {
  return {
    composite: stage1.composite,
    dimensions: stage1.dimensions,
    ...(stage1.structuralAdherence != null
      ? { structuralAdherence: stage1.structuralAdherence }
      : {}),
    callouts: stage2.callouts as Callout[],
    modelVersion: MODEL_VERSIONS.scoring + "+twostage",
    rubricVersion: RUBRIC_VERSION,
    headline: stage2.headline,
    didWell: stage2.didWell as FeedbackBullet[],
    didntLand: stage2.didntLand as FeedbackBullet[],
    nextRepFocus: stage2.nextRepFocus as NextRepFocusItem[],
    primaryFocusDimension: stage1.primaryFocusDimension,
    headlineTone: stage1.headlineTone,
    nextRepHint: stage2.nextRepHint,
    // PRD v3 engine — only present on retry-evaluated reps.
    ...(stage2.implementationReview
      ? { implementationReview: stage2.implementationReview }
      : {}),
    feedbackVersion: FEEDBACK_VERSION,
    prosodyAvailable: opts?.prosodyFeatures
      ? hasWorkerProsody(opts.prosodyFeatures)
      : false,
    requiresHumanReview: stage1.composite >= 95,
  };
}

/** Sequential two-stage scoring that returns the same RepScore shape as
 *  the legacy scoreRepWithMetrics. Useful for callers that don't want
 *  the progressive UI benefit but want the two-stage cleanliness. */
export async function scoreRepTwoStage(
  input: ScoreRepInput,
): Promise<ScoreRepResult> {
  const t0 = Date.now();
  const { stage1, context, metrics: stage1Metrics } = await scoreStage1(input);
  const { stage2, metrics: stage2Metrics } = await scoreStage2(input, stage1, context);
  const scoreRepTotalMs = Date.now() - t0;

  const score = assembleRepScore(stage1, stage2, {
    prosodyFeatures: context.prosodyFeatures,
  });

  // Sum the two stages' metrics into one ScoreRepMetrics shape that
  // mirrors the legacy single-call result. modelDurationMs is the SUM
  // of both stages (wall-clock from user POV); the individual stage
  // durations are still visible via the stage1/stage2 endpoint paths.
  return {
    score,
    metrics: {
      ...stage1Metrics,
      modelUsed: stage1Metrics.modelUsed,
      modelDurationMs:
        stage1Metrics.modelDurationMs + stage2Metrics.modelDurationMs,
      anthropicDurationMs:
        stage1Metrics.anthropicDurationMs +
        stage2Metrics.anthropicDurationMs,
      openaiDurationMs:
        (stage1Metrics.openaiDurationMs ?? 0) +
        (stage2Metrics.openaiDurationMs ?? 0),
      promptSizeBytes:
        (stage1Metrics.promptSizeBytes ?? 0) +
        (stage2Metrics.promptSizeBytes ?? 0),
      inputTokens:
        (stage1Metrics.inputTokens ?? 0) +
        (stage2Metrics.inputTokens ?? 0),
      outputTokens:
        (stage1Metrics.outputTokens ?? 0) +
        (stage2Metrics.outputTokens ?? 0),
      cacheReadTokens:
        (stage1Metrics.cacheReadTokens ?? 0) +
        (stage2Metrics.cacheReadTokens ?? 0),
      cacheCreationTokens:
        (stage1Metrics.cacheCreationTokens ?? 0) +
        (stage2Metrics.cacheCreationTokens ?? 0),
      validationDurationMs:
        stage1Metrics.validationDurationMs +
        stage2Metrics.validationDurationMs,
      scoreRepTotalMs,
      ragDurationMs: stage1Metrics.ragDurationMs,
      ragChunkCount: stage1Metrics.ragChunkCount,
    },
  };
}
