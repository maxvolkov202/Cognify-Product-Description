import type { SkillDimension } from "@/types/domain";

/**
 * Cognify scoring rubric — v2-beta.1
 *
 * Six dimensions grouped into Content (what you said) and Delivery (how
 * you said it). Renamed in the April 2026 v2 replan to match the team's
 * user-facing vocabulary and to clean the hybrid-scoring boundary:
 *
 *   Content  : clarity, structure, relevance
 *   Delivery : confidence, pacing, tone
 *
 * Pacing is the cleanest deterministic dimension — it maps directly to
 * Deepgram word-level timestamps (WPM variance, filler rate, time budget
 * compliance). Relevance is pure LLM (did the rep address the prompt?).
 * Everything else is hybrid: deterministic signals feed an LLM layer.
 *
 * When this rubric changes in a way that shifts scoring outputs, bump
 * RUBRIC_VERSION. Past rep scores stay tagged with the version they were
 * scored under, so trend lines remain honest across rubric evolutions.
 */

export const RUBRIC_VERSION = "v2-beta.2";

export type DimensionGroup = "content" | "delivery";

export type DimensionRubric = {
  dimension: SkillDimension;
  group: DimensionGroup;
  definition: string;
  lowScoreSignals: readonly string[];
  highScoreSignals: readonly string[];
  defaultWeight: number;
  scoringStrategy: "llm" | "deterministic" | "hybrid";
};

export const DIMENSION_RUBRIC: Record<SkillDimension, DimensionRubric> = {
  // ——— Content ———————————————————————————————————————
  clarity: {
    dimension: "clarity",
    group: "content",
    definition:
      "Ideas land on the first hearing. No ambiguity. Concrete language. The listener does not have to re-interpret.",
    lowScoreSignals: [
      "Unresolved pronouns (it, they, that) without clear referents",
      "Abstract nouns where concrete ones would work",
      "Jargon outside the target audience's register",
      "Listener-has-to-re-interpret moments",
    ],
    highScoreSignals: [
      "Concrete nouns and specific examples",
      "Audience-appropriate vocabulary",
      "Unambiguous pronoun resolution",
      "Main point stated in the first 10 seconds",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  structure: {
    dimension: "structure",
    group: "content",
    definition:
      "Visible scaffolding — opening that establishes direction, logical flow, and a close that reinforces the main point.",
    lowScoreSignals: [
      "No visible opening or closing",
      "Topic jumps without connective tissue",
      "Missing transitions between points",
      "Random ordering of ideas",
    ],
    highScoreSignals: [
      "Clear opening that establishes direction",
      "Logical connectors between points (first, because, therefore)",
      "Consistent ordering (chronological, causal, or importance)",
      "Closing that lands the main point",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  relevance: {
    dimension: "relevance",
    group: "content",
    definition:
      "The rep actually addresses the prompt. No drift onto tangents. The speaker answers the question that was asked. Off-topic, non-substantive, or junk reps score below 40 — relevance is the gatekeeper dimension.",
    lowScoreSignals: [
      "Ending on a different topic than the one asked",
      "Tangents that lose the original thread",
      "Answering a related but different question",
      "Rambling without returning to the prompt",
      "Non-substantive or junk content: testing the mic, random words, no real attempt to address the prompt",
    ],
    highScoreSignals: [
      "Direct engagement with the prompt from the opening",
      "Every point serves the main question",
      "Closing restates or reinforces the prompt's answer",
      "No detours that don't earn their place",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "llm",
  },
  // ——— Delivery ——————————————————————————————————————
  confidence: {
    dimension: "confidence",
    group: "delivery",
    definition:
      "Perceived composure and self-assurance in delivery. Steady generation, minimal hedging, clean recoveries from stumbles.",
    lowScoreSignals: [
      "Hedges: 'I think', 'maybe', 'kind of', 'sort of'",
      "Verbal backtracking: 'wait, let me start over'",
      "Long pauses (>2 seconds) outside natural breaks",
      "Over-apologizing: 'sorry', 'I'm not sure'",
      "Mid-sentence restarts",
    ],
    highScoreSignals: [
      "Direct assertions without hedging",
      "Quick clean recovery from stumbles",
      "Steady generation without stalling",
      "No over-apologizing",
      "Purposeful pauses, not panicked ones",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  pacing: {
    dimension: "pacing",
    group: "delivery",
    definition:
      "Speed, rhythm, and time budget discipline. Stable WPM across the rep. Finishes within time. Low filler rate.",
    lowScoreSignals: [
      "Filler words: um, uh, like, you know",
      "Rushing in the final quartile",
      "Going significantly over or under time budget",
      "Voice tightening, pitch rising",
      "Rambling run-on sentences",
    ],
    highScoreSignals: [
      "Low filler rate (< 2 per minute)",
      "Consistent WPM across rep quartiles",
      "Finishes within time budget",
      "Breaks are purposeful, not accidental",
      "Final sentence lands cleanly",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "deterministic",
  },
  tone: {
    dimension: "tone",
    group: "delivery",
    definition:
      "Calibration to audience and constraints. Register matches the listener. Warmth, seriousness, or formality is appropriate.",
    lowScoreSignals: [
      "Same register regardless of audience",
      "Technical jargon to non-technical audience",
      "Monotone delivery across an emotional moment",
      "Ignoring stated tone constraints",
    ],
    highScoreSignals: [
      "Audience-appropriate vocabulary",
      "Respects tone constraints (time, formality)",
      "Emotionally attuned to the moment",
      "Adjusts specificity to audience expertise",
    ],
    defaultWeight: 0.75,
    scoringStrategy: "hybrid",
  },
};

export const ALL_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "relevance",
  "confidence",
  "pacing",
  "tone",
];

export const CONTENT_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "relevance",
];

export const DELIVERY_DIMENSIONS: readonly SkillDimension[] = [
  "confidence",
  "pacing",
  "tone",
];

/**
 * Weighted composite score across dimensions. User-configurable weights
 * override defaults; absent dimensions are excluded from both numerator
 * and denominator so partial scoring stays honest.
 */
export function composite(
  scores: Partial<Record<SkillDimension, number>>,
  weights: Partial<Record<SkillDimension, number>> = {},
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dimension of ALL_DIMENSIONS) {
    const score = scores[dimension];
    if (score === undefined) continue;
    const weight =
      weights[dimension] ?? DIMENSION_RUBRIC[dimension].defaultWeight;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Sub-composite for one dimension group (Content or Delivery). Used by
 * the FeedbackPanel to show Content and Delivery averages separately.
 */
export function groupComposite(
  scores: Partial<Record<SkillDimension, number>>,
  group: DimensionGroup,
  weights: Partial<Record<SkillDimension, number>> = {},
): number {
  const dims = group === "content" ? CONTENT_DIMENSIONS : DELIVERY_DIMENSIONS;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dimension of dims) {
    const score = scores[dimension];
    if (score === undefined) continue;
    const weight =
      weights[dimension] ?? DIMENSION_RUBRIC[dimension].defaultWeight;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}
