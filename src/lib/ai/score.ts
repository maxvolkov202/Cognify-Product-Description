import { z } from "zod";
import { anthropic, MODELS, MODEL_VERSIONS } from "./claude";
import {
  ALL_DIMENSIONS,
  DIMENSION_RUBRIC,
  RUBRIC_VERSION,
  composite,
} from "@/lib/scoring/rubric";
import type { RepScore, SkillDimension } from "@/types/domain";
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
    "adaptability",
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
    "adaptability",
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

const scoringResponseSchema = z.object({
  dimensions: z.array(dimensionScoreSchema).length(ALL_DIMENSIONS.length),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  callouts: z.array(calloutSchema).min(3).max(3),
});

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
const systemPrompt = `You are the scoring model for Cognify, a communication training gym. Score a rep across six dimensions on 0-100.

Dimensions, in order:
  CONTENT  : clarity, structure, conciseness
  DELIVERY : thinking_quality, delivery, adaptability

Be rigorous. 90+ is reserved for genuinely excellent reps. <40 means serious issues. Off-topic or junk reps (mic test, rambling, not answering the prompt) must score low on BOTH content and delivery dimensions; do not anchor to a default range.

Return ONLY a JSON object (no prose, no markdown fences):

{
  "dimensions": [
    { "dimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"adaptability", "score": 0-100, "signals": ["..."] }
  ],
  "structuralAdherence": 0-100 (only when frameworkNodes provided, else omit),
  "callouts": [
    { "dimension": "...", "tone": "positive"|"neutral"|"warn"|"critical", "title": "short label", "body": "why it mattered", "quote": "verbatim phrase from transcript"|null, "suggestedRewrite": "speakable rephrasing"|null, "transcriptStart": ms, "transcriptEnd": ms }
  ]
}

CALLOUT RULES (responses violating these are rejected):
  - Exactly 3 callouts: 1 positive + 2 warn/critical. The two improvements target the TWO lowest-scoring dimensions (one each).
  - Every callout includes a \`quote\` copied verbatim from the transcript.
  - Warn/critical callouts include a \`suggestedRewrite\`: concrete, speakable, same length or shorter, in the user's voice. Positive callouts set suggestedRewrite=null.
  - dimension must be one of the six rubric dimensions (or "structural_adherence" when scoring against a framework).

COPY RULES:
  - title ≤80 chars: a label of what happened, not advice. Example: "Rushed the setup", "Landed the ask".
  - body ≤300 chars: 1-2 tight sentences on why the moment matters. The fix belongs in suggestedRewrite, not body.

BANNED in title or body: "good job", "great job", "nice work", "nice job", "well done", "way to go", "keep it up", "you got this", "you're doing great", "you did well". Drop filler adverbs (really, very, quite). Avoid hype verbs (crushed, absolutely, completely nailed). Every positive callout points at a specific transcript moment.`;

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
  "adaptability",
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
    | "adaptability"
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

export async function scoreRep(input: ScoreRepInput): Promise<RepScore> {
  const timedTranscript = renderTimedTranscript(input.transcript, input.words);
  const hasWordTimestamps = input.words && input.words.length > 0;

  const userPrompt = [
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
              text: `SCORING KNOWLEDGE (clarity, structure, conciseness, adaptability):\n\n${COMPACT_KNOWLEDGE}`,
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
  // Clarity, structure, conciseness, and adaptability stay LLM-scored as-is.
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
  };
}
