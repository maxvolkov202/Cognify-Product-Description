import { z } from "zod";
import { anthropic, MODELS, MODEL_VERSIONS } from "./claude";
import {
  ALL_DIMENSIONS,
  DIMENSION_RUBRIC,
  RUBRIC_VERSION,
  composite,
} from "@/lib/scoring/rubric";
import type {
  FeedbackBullet,
  NextRepFocusItem,
  RepScore,
  SkillDimension,
} from "@/types/domain";
import { FEEDBACK_VERSION } from "@/types/domain";
import {
  getPressureArchetype,
  type PressureArchetypeId,
} from "./pressure-archetypes";
import { loadSkill, renderBlocks } from "./knowledge";
import { extractSignals } from "@/lib/scoring/signals";
import {
  scorePacing,
  scoreThinkingQualityDeterministic,
  blendScores,
} from "@/lib/scoring/deterministic";

const dimensionScoreSchema = z.object({
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
});

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
  transcriptStart: z.number().min(0),
  transcriptEnd: z.number().min(0),
});

const dimensionEnumSchema = z.enum([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
  "structural_adherence",
]);

const feedbackBulletSchema = z.object({
  text: z.string().min(1).max(180),
  dimension: dimensionEnumSchema,
  quote: z.string().max(320).nullable(),
  transcriptStart: z.number().min(0).nullable(),
  transcriptEnd: z.number().min(0).nullable(),
});

const nextRepFocusItemSchema = feedbackBulletSchema.extend({
  exampleLine: z.string().max(360).nullable(),
});

const scoringResponseSchema = z.object({
  dimensions: z.array(dimensionScoreSchema).length(ALL_DIMENSIONS.length),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  callouts: z.array(calloutSchema).min(3).max(3),
  /** One-line diagnostic verdict — see HEADLINE RULES in systemPrompt. */
  headline: z.string().min(1).max(120),
  /** Phase 2 first-class bullets. Allow 0–2 so junk reps (composite < 25)
   *  can omit didWell without manufacturing praise. The prompt enforces
   *  "exactly 2" in the normal case. */
  didWell: z.array(feedbackBulletSchema).max(2),
  didntLand: z.array(feedbackBulletSchema).max(2),
  nextRepFocus: z.array(nextRepFocusItemSchema).max(2),
  primaryFocusDimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  /** Phase 3 calibration scaffold — tone band the AI thinks it wrote in. */
  headlineTone: z.enum(["blunt", "directive", "praise", "celebratory"]),
  /** Phase 3 scaffold — short tail phrase for the NEXT rep's
   *  LastRepFocusBanner. 3-8 words, no period. */
  nextRepHint: z.string().min(2).max(60),
});

/** Phase 2: per-mode signals plumbed into the scoring prompt so the AI can
 *  write mode-aware feedback. Without modeContext, scoreRep falls back to
 *  the Phase 1 "mode-blind" behavior (still produces a headline + bullets
 *  but no archetype framing or carry-over reference). */
export type ScoreRepModeContext = {
  /** Which orchestrator built the rep. Drives headline framing rules. */
  sessionType: "focus" | "combined" | "flow";
  /** When sessionType="focus", the dimension being drilled this session. */
  focusDimension?: SkillDimension;
  /** Promoted from top-level so Phase 2 can use the archetype's tagline +
   *  stressedDimensions in the headline framing. The archetype's weight
   *  profile is still applied via `weights` on ScoreRepInput. */
  pressureArchetypeId?: PressureArchetypeId;
  /** What the previous rep was about. Lets the AI write continuation copy
   *  ("you cleaned up structure from last rep"). */
  previousRepFocus?: {
    dimension: SkillDimension;
    headline: string;
    score: number;
  };
  /** 0-based rep index in the session. */
  repIndex: number;
  totalReps: number;
};

export type ScoreRepInput = {
  transcript: string;
  promptText: string;
  durationMs: number;
  /**
   * Expected rep time budget (ms). Used by the deterministic pacing
   * scorer to compute timeBudgetRatio. Defaults to durationMs if not
   * provided — which means no over/under budget penalty is applied.
   */
  timeBudgetMs?: number;
  frameworkNodes?: { label: string; description: string }[];
  weights?: Partial<Record<SkillDimension, number>>;
  words?: { word: string; startMs: number; endMs: number }[];
  /** Rendered calibration block from the user's past ratings + corrections
   *  (from `renderCalibrationForPrompt` in lib/db/queries/calibration.ts).
   *  Injected into the Claude system prompt so scoring adapts to the user's
   *  history. Null/absent when the user has no ratings yet. */
  userCalibration?: string | null;
  /** Phase 2: mode/session/carry-over context. Optional — when absent,
   *  the scoring prompt runs in mode-blind mode (Phase 1 behavior). */
  modeContext?: ScoreRepModeContext;
};

function renderTimedTranscript(
  transcript: string,
  words?: { word: string; startMs: number; endMs: number }[],
): string {
  // Full transcript is canonical. The compact timestamp index lets Claude
  // anchor callout ranges without bloating the prompt. Every ~5s is plenty
  // for callout granularity; tighter intervals burned tokens without
  // measurably improving anchoring quality.
  if (!words || words.length === 0) return transcript;
  const markers: string[] = [];
  let lastMark = -1;
  for (const w of words) {
    const sec = Math.floor(w.startMs / 1000);
    if (sec !== lastMark && sec % 5 === 0) {
      const stamp = `[${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}]`;
      markers.push(`${stamp} "${w.word}"`);
      lastMark = sec;
    }
  }
  if (markers.length === 0) return transcript;
  return `${transcript}\n\nTIMESTAMP INDEX (every ~5s):\n${markers.join("\n")}`;
}

// System prompt is intentionally tight. Latency dominates UX here, so the
// rubric and dimension definitions live in a single cached block (knowledge)
// rather than being repeated inline. Output is bounded JSON with strict
// rules; verbose framing slowed things down without measurably improving
// quality in our internal calibration runs.
const systemPrompt = `You are the scoring model for Cognify, a communication training gym. Score a rep across six dimensions on 0-100 and write the post-rep feedback the user reads.

Dimensions, in order:
  CONTENT  : clarity, structure, conciseness, thinking_quality
  DELIVERY : delivery, tone

Be rigorous. 90+ is reserved for genuinely excellent reps. <40 means serious issues. Off-topic or junk reps (mic test, rambling, not answering the prompt) must score low on BOTH content and delivery dimensions; do not anchor to a default range.

Return ONLY a JSON object (no prose, no markdown fences):

{
  "dimensions": [
    { "dimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone", "score": 0-100, "signals": ["..."] }
  ],
  "structuralAdherence": 0-100 (only when frameworkNodes provided, else omit),
  "callouts": [
    { "dimension": "...", "tone": "positive"|"neutral"|"warn"|"critical", "title": "short label", "body": "why it mattered", "quote": "verbatim phrase from transcript"|null, "suggestedRewrite": "speakable rephrasing"|null, "transcriptStart": ms, "transcriptEnd": ms }
  ],
  "headline": "one-line verdict, see HEADLINE RULES below",
  "didWell": [{ "text": "...", "dimension": "...", "quote": "...", "transcriptStart": ms, "transcriptEnd": ms }, ...],
  "didntLand": [{ "text": "...", "dimension": "...", "quote": "...", "transcriptStart": ms, "transcriptEnd": ms }, ...],
  "nextRepFocus": [{ "text": "...", "dimension": "...", "quote": "..."|null, "transcriptStart": ms|null, "transcriptEnd": ms|null, "exampleLine": "..."|null }, ...],
  "primaryFocusDimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone",
  "headlineTone": "blunt"|"directive"|"praise"|"celebratory",
  "nextRepHint": "3-8 word continuation tail for the next rep's banner"
}

HEADLINE RULES (the single most important sentence the user reads):
  - One sentence, ≤90 chars, second-person ("you"), present-tense, no hedging.
  - It is the diagnostic verdict — the single most important truth about THIS rep. Not a stat number, not a list.
  - Tone scales with the composite score you assigned:
      composite < 50  → blunt diagnosis. Name what failed. Example: "Your ideas were there. Your structure collapsed before they landed."
      50–74           → directive. Name the one fix that moves the score most. Example: "You had the point — you just buried it under three setups."
      75–89           → specific praise + sharpening edge. Example: "Clean from open to ask. Tighten the middle and this is a 90."
      ≥ 90            → celebratory + raise the bar. Example: "Nothing to fix on this one. Try it again with a harder audience."
  - Junk reps / off-prompt rambles get an honest verdict, not coaching: "That wasn't the prompt. Try it again."
  - Banned in headline: any phrase from the BANNED list below; "great rep", "good rep", "nice rep", emoji, exclamation marks, score numbers, percentages.

PER-MODE HEADLINE FRAMING (when MODE block is supplied in the user message):
  - sessionType=focus, focusDimension=X:
      Default: headline targets X exclusively. Example: "Your structure still flips at the close — the ask is missing again."
      Pivot: if X >= 85 AND another dimension < 60, headline names the new weakest. Example: "Structure locked. Conciseness is now the leak — you doubled every point."
  - sessionType=combined:
      Headline targets the lowest-scoring dimension after weights. When composite ≥ 80, name the last remaining gap (don't praise the streak — reach for the next badge).
  - pressureArchetypeId=Y (in any sessionType):
      Headline references the archetype mechanism, not just a dim. Compare avg(stressedDimensions) vs avg(non-stressed):
        if stressed avg ≥ non-stressed + 10 → "you held the line under {mechanism}" framing
        else → "{mechanism} got past you" framing
  - previousRepFocus supplied: the headline must address whether that dimension improved or stayed flat compared to the previous rep's headline. Don't restate the previous headline — extend it.

CALLOUT RULES (responses violating these are rejected):
  - Exactly 3 callouts: 1 positive + 2 warn/critical. The two improvements target the TWO lowest-scoring dimensions (one each).
  - Every callout includes a \`quote\` copied verbatim from the transcript.
  - Warn/critical callouts include a \`suggestedRewrite\`: concrete, speakable, same length or shorter, in the user's voice. Positive callouts set suggestedRewrite=null.
  - dimension must be one of the six rubric dimensions (or "structural_adherence" when scoring against a framework).

BULLET RULES (didWell / didntLand / nextRepFocus — these are the user-facing summary bullets, distinct from callouts):
  - didWell:        exactly 2 bullets in the normal case. ALLOWED 0 only when composite < 25 (junk reps must not manufacture praise).
  - didntLand:      exactly 2 bullets, paired with the 2 nextRepFocus items (each gap gets a paired fix in the same array index).
  - nextRepFocus:   exactly 2 bullets, prescriptive ("Open with a direction-setting sentence so the listener knows where you're going.").
  - text ≤140 chars, second-person ("you …"), action-oriented, no hedging.
  - Voice differs from callouts: callouts label what happened ("Rushed the setup"); bullets give actionable context ("You started talking without telling me where you were going.").
  - GROUNDING — non-negotiable for didWell + didntLand:
      Every bullet MUST cite a verbatim transcript phrase in \`quote\` and a timestamp range. If you cannot cite, do not write the bullet.
      The quote is character-for-character from the transcript. Paraphrasing or insertion is rejected by the post-validator.
  - GROUNDING — nextRepFocus only:
      Generic prescriptive guidance is allowed ONLY in nextRepFocus bullets, AND ONLY when transcriptStart, transcriptEnd, and quote are ALL explicitly null. The text must read as universal advice ("open with a direction-setting sentence"), not pseudo-specific.
      If a nextRepFocus bullet ties to a specific transcript moment, populate quote + timestamps the same as didntLand.
  - exampleLine (nextRepFocus only): a short, speakable line the user could imitate next rep. Same constraints as suggestedRewrite. At most ONE of the two nextRepFocus items may have exampleLine=null.
  - primaryFocusDimension: pick the single dimension you'd most want the user to focus on for the next rep. Surfaces in the UI's dimension grid.

COPY RULES:
  - title ≤80 chars: a label of what happened, not advice. Example: "Rushed the setup", "Landed the ask".
  - body ≤300 chars: 1-2 tight sentences on why the moment matters. The fix belongs in suggestedRewrite, not body.

BANNED in title, body, or any bullet text: "good job", "great job", "nice work", "nice job", "well done", "way to go", "keep it up", "you got this", "you're doing great", "you did well". Drop filler adverbs (really, very, quite). Avoid hype verbs (crushed, absolutely, completely nailed). Every positive callout and didWell bullet points at a specific transcript moment.

ANTI-HALLUCINATION RULES:
  - Never write "you said X" / "when you mentioned X" / "the part where you X" without populating the quote field with the verbatim phrase.
  - If you're tempted to reference a transcript moment but can't find the exact phrase, drop the reference entirely. Generic advice is honest; fabricated specifics break trust.
  - Bullets that reference transcript moments without verbatim quotes are rejected by the post-validator.

HEADLINE TONE BAND (calibration scaffold — pick the band you wrote the headline in):
  - "blunt"       — composite < 50, headline names what failed.
  - "directive"   — 50-74, headline names the one fix.
  - "praise"      — 75-89, specific praise + sharpening edge.
  - "celebratory" — ≥ 90, raise-the-bar framing.
  Pick the band that actually matches the headline you wrote, not the score range — they should align, but if you wrote softer copy than the band suggests, report what you wrote.

NEXT REP HINT:
  - 3-8 words, present-tense, second-person, no period.
  - Becomes the tail of the next rep's "Last rep focus: <dim> — <hint>" banner.
  - Tied to primaryFocusDimension. Specific over generic when possible:
      generic   : "keep building on it"
      specific  : "land the open before the ask"
  - No filler verbs ("focus on", "work on") — give an action.`;

/**
 * Compact rubric block — definitions + signals for the four LLM-scored
 * dimensions only (delivery + thinking_quality are deterministic, no
 * need to spend tokens describing them to the model). Capped to keep
 * the system prompt under ~3KB after caching.
 */
const LLM_SCORED_DIMENSIONS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "tone",
];

function renderRubric(): string {
  return LLM_SCORED_DIMENSIONS.map((d) => {
    const r = DIMENSION_RUBRIC[d];
    return `## ${d}
${r.definition}
Low: ${r.lowScoreSignals.slice(0, 3).join("; ")}
High: ${r.highScoreSignals.slice(0, 3).join("; ")}`;
  }).join("\n\n");
}

// Cached at module scope so we don't re-render on every request.
const COMPACT_RUBRIC = renderRubric();

/** Knowledge for ONLY the LLM-scored skills. delivery + thinking_quality
 *  are deterministic so we don't ship their knowledge to the model. */
function loadLlmScoredSkillKnowledge(): string {
  const blocks = LLM_SCORED_DIMENSIONS.map((d) => loadSkill(d)).filter(
    (b): b is NonNullable<typeof b> => b !== null,
  );
  return renderBlocks(blocks);
}
const COMPACT_KNOWLEDGE = loadLlmScoredSkillKnowledge();

/**
 * Banned phrases that disqualify a callout from the user-visible feed.
 * When found, the callout's copy is rewritten to a neutral-but-specific
 * fallback so the 1+2 shape holds. Pattern: case-insensitive substring
 * match against title + body combined. Short, high-signal list —
 * expanding it is cheap but false-positive risk grows fast, so tune
 * against real outputs if/when needed.
 */
const CALLOUT_BANNED_PHRASES = [
  "good job",
  "great job",
  "nice work",
  "nice job",
  "well done",
  "way to go",
  "keep it up",
  "you got this",
  "you're doing great",
  "you did well",
];

type RawCallout = {
  dimension:
    | "clarity"
    | "structure"
    | "conciseness"
    | "thinking_quality"
    | "delivery"
    | "tone"
    | "structural_adherence";
  tone: "positive" | "neutral" | "warn" | "critical";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
  transcriptStart: number;
  transcriptEnd: number;
};

function calloutContainsBanned(c: RawCallout): boolean {
  const hay = `${c.title} ${c.body}`.toLowerCase();
  return CALLOUT_BANNED_PHRASES.some((p) => hay.includes(p));
}

/** Phase 2 grounding validator. Mirrors sanitizeCallouts' belt-and-suspenders
 *  approach: trust the prompt rules but verify post-LLM. For each bullet:
 *    - If quote != null, verify it's a substring of the rep transcript
 *      (case-insensitive, whitespace-collapsed). Mismatch → strip quote +
 *      timestamps so the UI renders the bullet without quote-mark styling
 *      and without the timestamp jump affordance. Don't drop the bullet —
 *      the text alone is still useful guidance.
 *    - Verify transcriptStart < transcriptEnd <= durationMs. Out-of-range
 *      timestamps get nulled out (same UI consequence as bad quote).
 *    - Banned-phrase sweep: bullets containing pseudo-specific phrases
 *      ("you said", "when you mentioned", "the part where you") with
 *      quote=null are also stripped of any timestamp data — they were
 *      claiming to ground in transcript without actually doing so. */
const PSEUDO_GROUND_PHRASES = [
  "you said",
  "when you mentioned",
  "when you said",
  "the part where you",
  "the moment where you",
  "the bit where you",
];

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeBullets<T extends FeedbackBullet>(opts: {
  bullets: T[];
  transcript: string;
  durationMs: number;
  /** Tag for log output ("didWell" / "didntLand" / "nextRepFocus"). */
  label: string;
}): T[] {
  const { bullets, transcript, durationMs, label } = opts;
  const haystack = normalizeForMatch(transcript);
  return bullets.map((b) => {
    let quote = b.quote;
    let start = b.transcriptStart;
    let end = b.transcriptEnd;

    // Quote substring check.
    if (quote != null) {
      const needle = normalizeForMatch(quote);
      if (needle.length === 0 || !haystack.includes(needle)) {
        console.warn(
          `[score] ${label} bullet quote not found in transcript; stripping anchor:`,
          { quote: quote.slice(0, 80) },
        );
        quote = null;
        start = null;
        end = null;
      }
    }

    // Timestamp range check.
    if (start != null && end != null) {
      if (start < 0 || end <= start || end > durationMs) {
        console.warn(
          `[score] ${label} bullet timestamps out of range; stripping anchor:`,
          { start, end, durationMs },
        );
        quote = null;
        start = null;
        end = null;
      }
    }

    // Pseudo-ground sweep: text claims a transcript moment but no quote.
    const lowerText = b.text.toLowerCase();
    const claimsTranscriptMoment = PSEUDO_GROUND_PHRASES.some((p) =>
      lowerText.includes(p),
    );
    if (claimsTranscriptMoment && quote == null) {
      console.warn(
        `[score] ${label} bullet claims transcript moment without quote; nulling timestamps:`,
        { text: b.text.slice(0, 80) },
      );
      start = null;
      end = null;
    }

    return { ...b, quote, transcriptStart: start, transcriptEnd: end };
  });
}

function sanitizeCallouts(callouts: RawCallout[]): RawCallout[] {
  return callouts.map((c) => {
    if (!calloutContainsBanned(c)) return c;
    // Log so we can audit prompt drift. Don't drop — we need to keep
    // the 1+2 shape intact.
    console.warn(
      "[score] callout tripped banned-phrase filter; sanitizing:",
      { dimension: c.dimension, tone: c.tone, title: c.title },
    );
    if (c.tone === "positive") {
      return {
        ...c,
        title: "Landed a specific moment",
        body:
          c.quote
            ? `The line "${c.quote}" hit clearly — keep that specificity.`
            : "A specific moment landed cleanly. Keep that specificity.",
      };
    }
    return {
      ...c,
      title: "Tighten this moment",
      body:
        c.quote
          ? `"${c.quote}" could land cleaner. See the suggested rewrite below.`
          : "This moment could land cleaner. See the suggested rewrite below.",
    };
  });
}

/** Render the MODE block injected into the user prompt before the
 *  transcript so the AI knows what frame to write the headline + bullets
 *  in. Returns null when no modeContext is provided (Phase 1 behavior). */
function renderModeBlock(ctx: ScoreRepModeContext | undefined): string | null {
  if (!ctx) return null;
  const lines: string[] = [];
  lines.push(`MODE: ${ctx.sessionType}`);
  if (ctx.sessionType === "focus" && ctx.focusDimension) {
    lines.push(`FOCUS DIMENSION: ${ctx.focusDimension}`);
  }
  if (ctx.pressureArchetypeId) {
    const arch = getPressureArchetype(ctx.pressureArchetypeId);
    lines.push(
      `PRESSURE ARCHETYPE: ${arch.id} ("${arch.tagline}")`,
      `STRESSED DIMENSIONS (priority order): ${arch.stressedDimensions.join(", ")}`,
      `Frame the headline around how the user handled the ${arch.name.toLowerCase()} mechanism. Bias didWell/didntLand toward the stressed dimensions.`,
    );
  }
  if (ctx.previousRepFocus) {
    const { dimension, headline, score } = ctx.previousRepFocus;
    lines.push(
      `PREVIOUS REP FOCUS: ${dimension} (${Math.round(score)}). Headline was: "${headline}"`,
      `Your headline must address whether ${dimension} improved or stayed flat compared to that — extend, don't restate.`,
    );
  }
  lines.push(`This is rep ${ctx.repIndex + 1} of ${ctx.totalReps}.`);
  return lines.join("\n");
}

export async function scoreRep(input: ScoreRepInput): Promise<RepScore> {
  const timedTranscript = renderTimedTranscript(input.transcript, input.words);
  const hasWordTimestamps = input.words && input.words.length > 0;

  const modeBlock = renderModeBlock(input.modeContext);

  const userPrompt = [
    modeBlock,
    `PROMPT: ${input.promptText}`,
    `REP DURATION: ${(input.durationMs / 1000).toFixed(1)}s`,
    input.frameworkNodes
      ? `FRAMEWORK (score structural_adherence against these nodes in order):\n${input.frameworkNodes
          .map((n, i) => `${i + 1}. ${n.label}: ${n.description}`)
          .join("\n")}`
      : null,
    hasWordTimestamps
      ? `TRANSCRIPT (inline [m:ss] markers are real timestamps; use them for callout ranges):\n${timedTranscript}`
      : `TRANSCRIPT:\n${timedTranscript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODELS.scoring,
    // Bounded output: 6 dimension scores + ~3 callouts. 1024 is the 95th
    // percentile observed across recent reps; 1200 leaves headroom without
    // letting the model ramble.
    max_tokens: 1200,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text" as const,
        text: `RUBRIC (only the four LLM-scored dimensions; delivery and thinking_quality are scored separately):\n\n${COMPACT_RUBRIC}`,
        cache_control: { type: "ephemeral" as const },
      },
      ...(COMPACT_KNOWLEDGE
        ? [
            {
              type: "text" as const,
              text: `SCORING KNOWLEDGE (clarity, structure, conciseness, tone):\n\n${COMPACT_KNOWLEDGE}`,
              cache_control: { type: "ephemeral" as const },
            },
          ]
        : []),
      ...(input.userCalibration
        ? [
            {
              type: "text" as const,
              text: input.userCalibration,
              // NOT cache-controlled — user-specific.
            },
          ]
        : []),
    ],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Scoring response was not valid JSON. Got: ${textBlock.text.slice(0, 500)}`,
    );
  }

  const validated = scoringResponseSchema.parse(parsed);

  // WS-4: post-LLM callout validator. The scoring prompt has BANNED
  // rules but belt-and-suspenders — we also check client-side and
  // filter any callouts whose title/body contain banned filler. Rather
  // than drop the whole response, we sanitize: filtered callouts get
  // replaced by a neutral-tone fallback so the 1-positive + 2-improvement
  // shape stays intact. In practice this is rare because the prompt's
  // authoring rules are strict.
  validated.callouts = sanitizeCallouts(validated.callouts);

  // Phase 2: anti-hallucination grounding. Strip quote/timestamp anchors
  // when the AI claims a transcript moment we can't verify. Bullets
  // remain in the response — only the false specificity is removed.
  const sanitizedDidWell = sanitizeBullets({
    bullets: validated.didWell as FeedbackBullet[],
    transcript: input.transcript,
    durationMs: input.durationMs,
    label: "didWell",
  });
  const sanitizedDidntLand = sanitizeBullets({
    bullets: validated.didntLand as FeedbackBullet[],
    transcript: input.transcript,
    durationMs: input.durationMs,
    label: "didntLand",
  });
  const sanitizedNextRepFocus = sanitizeBullets({
    bullets: validated.nextRepFocus as NextRepFocusItem[],
    transcript: input.transcript,
    durationMs: input.durationMs,
    label: "nextRepFocus",
  });

  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of validated.dimensions) {
    dimensionMap[d.dimension] = d.score;
  }

  // ——— Hybrid scoring layer ——————————————————————————————
  // Pacing is OVERRIDDEN by the deterministic scorer (pure function)
  // so its trend lines are mathematically stable across time. This is
  // the calibration-ready layer that David flagged in the advisory
  // meeting — re-scoring the same audio returns the same pacing number.
  //
  // Confidence is BLENDED (60% deterministic / 40% LLM) because the
  // semantic "did they sound sharp" layer genuinely adds signal
  // on top of the measurable hedge/restart/pause baseline.
  //
  // Clarity, structure, conciseness, and tone stay LLM-scored as-is.
  let finalDimensions = validated.dimensions.map((d) => ({ ...d }));
  if (input.words && input.words.length > 0) {
    const signalBundle = extractSignals({
      words: input.words,
      transcript: input.transcript,
      durationMs: input.durationMs,
      timeBudgetMs: input.timeBudgetMs ?? input.durationMs,
    });

    // Delivery — pure deterministic override (was "pacing" in v2-beta.*)
    const deliveryResult = scorePacing(signalBundle);
    dimensionMap.delivery = deliveryResult.score;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "delivery"
        ? {
            dimension: "delivery" as const,
            score: deliveryResult.score,
            signals: deliveryResult.signals,
          }
        : d,
    );

    // Thinking Quality — hybrid blend with LLM layer (was "confidence")
    const thinkingDet = scoreThinkingQualityDeterministic(signalBundle);
    const llmThinking = dimensionMap.thinking_quality ?? 60;
    const thinkingBlended = blendScores(thinkingDet.score, llmThinking, 0.6);
    dimensionMap.thinking_quality = thinkingBlended;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "thinking_quality"
        ? {
            dimension: "thinking_quality" as const,
            score: thinkingBlended,
            signals: [
              ...thinkingDet.signals,
              `(LLM semantic layer: ${llmThinking})`,
            ],
          }
        : d,
    );
  }

  const compositeScore = composite(dimensionMap, input.weights);

  return {
    composite: compositeScore,
    dimensions: finalDimensions,
    ...(validated.structuralAdherence != null
      ? { structuralAdherence: validated.structuralAdherence }
      : {}),
    callouts: validated.callouts,
    modelVersion: MODEL_VERSIONS.scoring,
    rubricVersion: RUBRIC_VERSION,
    headline: validated.headline,
    didWell: sanitizedDidWell,
    didntLand: sanitizedDidntLand,
    nextRepFocus: sanitizedNextRepFocus,
    primaryFocusDimension: validated.primaryFocusDimension,
    headlineTone: validated.headlineTone,
    nextRepHint: validated.nextRepHint,
    feedbackVersion: FEEDBACK_VERSION,
  };
}
