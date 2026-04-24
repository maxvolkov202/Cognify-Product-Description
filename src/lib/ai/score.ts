import { z } from "zod";
import { anthropic, MODELS, MODEL_VERSIONS } from "./claude";
import {
  ALL_DIMENSIONS,
  DIMENSION_RUBRIC,
  RUBRIC_VERSION,
  composite,
} from "@/lib/scoring/rubric";
import type { RepScore, SkillDimension } from "@/types/domain";
import { loadSkills, loadPatterns, renderBlocks } from "./knowledge";
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
  // The full transcript is the canonical source of truth — always return
  // it in full. If word timings are present, append a compact timestamp
  // index so Claude can reference specific moments in callouts, but we
  // never truncate the transcript to whatever words we happen to have.
  if (!words || words.length === 0) return transcript;
  const markers: string[] = [];
  let lastMark = -1;
  for (const w of words) {
    const sec = Math.floor(w.startMs / 1000);
    if (sec !== lastMark && sec % 2 === 0) {
      const stamp = `[${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}]`;
      markers.push(`${stamp} "${w.word}"`);
      lastMark = sec;
    }
  }
  if (markers.length === 0) return transcript;
  return `${transcript}\n\nTIMESTAMP INDEX (every ~2s, from word-level timings — use for callout ranges):\n${markers.join("\n")}`;
}

const systemPrompt = `You are the scoring model for Cognify, a communication training platform. Score the user's rep across six dimensions on a 0-100 scale, with transparent signals for each score.

The six dimensions are grouped into two buckets:
  CONTENT  : clarity, structure, conciseness           (what they said)
  DELIVERY : thinking_quality, delivery, adaptability  (how they said it)

Be rigorous. Scores above 90 are reserved for genuinely excellent reps. Scores below 40 indicate serious issues. Off-topic or junk reps (not addressing the prompt, testing the mic, stream-of-consciousness rambling) must be scored honestly across all six dimensions — low content dimensions AND low delivery dimensions, because such reps fail in both directions. Do not anchor toward any default range — score authentically based on the rubric.

Return ONLY valid JSON matching this exact schema, no prose:

{
  "dimensions": [
    { "dimension": "clarity" | "structure" | "relevance" | "confidence" | "pacing" | "tone", "score": 0-100, "signals": ["..."] }
  ],
  "structuralAdherence": 0-100 (only if frameworkNodes provided),
  "callouts": [
    {
      "dimension": "...",
      "tone": "positive" | "neutral" | "warn" | "critical",
      "title": "short label",
      "body": "why this moment mattered",
      "quote": "verbatim phrase the user actually said (copy letters exactly)" | null,
      "suggestedRewrite": "a complete speakable rephrasing in the user's voice" | null,
      "transcriptStart": ms,
      "transcriptEnd": ms
    }
  ]
}

The "dimensions" array must contain exactly one entry per dimension in this order: clarity, structure, conciseness, thinking_quality, delivery, adaptability.

CALLOUT RULES (strict — responses violating these will be rejected):
  - Return EXACTLY 3 callouts: one "positive" + two "warn"/"critical".
  - The two improvement callouts MUST target the TWO lowest-scoring dimensions (one each, not both the same).
  - Every callout MUST include a \`quote\` — a verbatim phrase copied exactly from the transcript (same letters, same order; do not paraphrase).
  - Every "warn"/"critical" callout MUST include a \`suggestedRewrite\` — a concrete, speakable rephrasing of the quote in the user's voice (same length or shorter; something they could actually say next time).
  - For "positive" callouts, set \`suggestedRewrite\` to null.
  - Do not invent content. If you cannot find a real quote to anchor a callout, skip that callout.
  - Every callout's \`dimension\` MUST be one of the six rubric dimensions (or "structural_adherence" when the rep has a framework). Never omit.

COPY RULES:
  - "title": ≤80 chars, a short label of what specifically happened (e.g., "Rushed the setup", "Landed the ask").
  - "body":  ≤300 chars, 1-2 tight sentences on why this moment matters — NOT the fix itself (the fix lives in suggestedRewrite).
  - Keep tone coaching, not clinical. Specific, not generic.

BANNED (responses will be rejected if these appear anywhere in any callout title or body):
  - "good job", "great job", "nice work", "nice job", "well done", "way to go"
  - "you did well", "you're doing great", "keep it up", "you got this"
  - Generic positive filler. EVERY positive callout must point at a specific moment in the transcript.
  - Filler adverbs: "really", "very", "quite" — drop them.
  - Hype verbs that oversell: "crushed" (only if literal), "absolutely", "completely nailed".`;

function renderRubric(): string {
  return ALL_DIMENSIONS.map((d) => {
    const r = DIMENSION_RUBRIC[d];
    return `## ${d}
${r.definition}
Low-score signals:
${r.lowScoreSignals.map((s) => `- ${s}`).join("\n")}
High-score signals:
${r.highScoreSignals.map((s) => `- ${s}`).join("\n")}`;
  }).join("\n\n");
}

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
    `PROMPT THE USER WAS ASKED TO ADDRESS:\n${input.promptText}`,
    `\nREP DURATION: ${(input.durationMs / 1000).toFixed(1)}s`,
    input.frameworkNodes
      ? `\nFRAMEWORK THE USER SHOULD HOLD (score structural adherence against these nodes in order):\n${input.frameworkNodes
          .map((n, i) => `${i + 1}. ${n.label} — ${n.description}`)
          .join("\n")}`
      : null,
    hasWordTimestamps
      ? `\nTRANSCRIPT (inline [m:ss] markers indicate real timestamps — use these for callout ranges):\n${timedTranscript}`
      : `\nTRANSCRIPT:\n${timedTranscript}`,
    `\nRUBRIC:\n${renderRubric()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const knowledgeBlocks = [...loadSkills(), ...loadPatterns()];
  const knowledgeText = renderBlocks(knowledgeBlocks);

  const response = await anthropic.messages.create({
    model: MODELS.scoring,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
      ...(knowledgeText
        ? [
            {
              type: "text" as const,
              text: `SCORING KNOWLEDGE BASE — use these expert-sourced skill notes to ground your scoring. Each block is the pedagogical definition of one dimension grouped into Content (clarity, structure, conciseness) and Delivery (thinking_quality, delivery, adaptability) with multi-source signals and scoring boundaries:\n\n${knowledgeText}`,
              cache_control: { type: "ephemeral" as const },
            },
          ]
        : []),
      ...(input.userCalibration
        ? [
            {
              type: "text" as const,
              text: input.userCalibration,
              // NOT cache-controlled — this is user-specific and changes
              // as the user rates more reps. Caching would leak calibration
              // across users.
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
