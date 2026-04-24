import type { SkillDimension } from "@/types/domain";

/**
 * Cognify scoring rubric — v2.0.0 (WS-1 apply 2026-04-24)
 *
 * Six dimensions aligned with strategy team + V2 mockups. Renamed from
 * v2-beta.2:
 *   - relevance   → (absorbed into an internal off-topic gate; see
 *                    src/lib/scoring/dimension-aliases.ts)
 *   - confidence  → thinking_quality (generation coherence, not vocal composure)
 *   - pacing      → delivery (absorbs pacing + vocal side of old tone)
 *   - tone        → adaptability (audience calibration + mid-rep adjustment)
 *   - NEW: conciseness (tight word economy; previously rolled into pacing)
 *
 * Groupings: Content = {clarity, structure, conciseness},
 *            Delivery = {thinking_quality, delivery, adaptability}.
 *
 * When this rubric changes in a way that shifts scoring outputs, bump
 * RUBRIC_VERSION. Past rep scores stay tagged with the version they were
 * scored under, so trend lines remain honest across rubric evolutions.
 */

export const RUBRIC_VERSION = "v2.0.0";

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
      "Ideas land on the first hearing. No ambiguity. Concrete language, audience-appropriate vocabulary, resolved pronouns, main point stated early. The listener does not have to re-interpret.",
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
      "Visible scaffolding — opening that establishes direction, logical flow connected by transitions, and a close that reinforces the main point.",
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
  conciseness: {
    dimension: "conciseness",
    group: "content",
    definition:
      "Maximum signal per word. Low filler rate, low repetition, words-per-point discipline, within time budget. Tight sentences over bloated ones.",
    lowScoreSignals: [
      "High filler rate (> 4 per minute)",
      "Repeating the same point in different words",
      "Long preambles before getting to the point",
      "Over-time or under-time by >20% of budget",
      "Hedge-stacking that dilutes claims",
    ],
    highScoreSignals: [
      "Low filler rate (< 2 per minute)",
      "Each sentence advances the argument",
      "Finishes within 10% of time budget",
      "No repetition of ideas",
      "Tight word economy (words-per-point < 25)",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  // ——— Delivery ——————————————————————————————————————
  thinking_quality: {
    dimension: "thinking_quality",
    group: "delivery",
    definition:
      "Coherent generation under real-time conditions. Low backtrack rate, low restart rate, logical chain holds, recall feels sharp. Measures the content of thinking, not vocal composure.",
    lowScoreSignals: [
      "Hedges: 'I think', 'maybe', 'kind of', 'sort of'",
      "Verbal backtracking: 'wait, let me start over'",
      "Long pauses (>2 seconds) outside natural breaks",
      "Mid-sentence restarts",
      "Logical chain breaks (conclusion doesn't follow premise)",
    ],
    highScoreSignals: [
      "Direct assertions without hedging",
      "Quick clean recovery from stumbles",
      "Logical connectors used correctly (because, therefore, so)",
      "Low restart count (< 1 per 30s)",
      "Purposeful pauses, not panicked ones",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  delivery: {
    dimension: "delivery",
    group: "delivery",
    definition:
      "How it sounds. Pacing (stable WPM, purposeful pauses), rhythm, vocal energy, finishing cleanly within time. The craft of speech distinct from the content.",
    lowScoreSignals: [
      "Rushing in the final quartile",
      "Going significantly over or under time budget",
      "Voice tightening, pitch rising",
      "Rambling run-on sentences",
      "Monotone delivery across an emotional moment",
    ],
    highScoreSignals: [
      "Consistent WPM across rep quartiles",
      "Purposeful pauses for emphasis",
      "Finishes within time budget",
      "Final sentence lands cleanly",
      "Vocal variation matches the content stakes",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "deterministic",
  },
  adaptability: {
    dimension: "adaptability",
    group: "delivery",
    definition:
      "Calibration to audience, constraints, and mid-rep cues. Register shifts for different listeners, adjusts when pushback or audience switch happens, stays responsive when the conversation deviates from the planned path.",
    lowScoreSignals: [
      "Same register regardless of audience",
      "Technical jargon to non-technical audience",
      "Ignoring stated tone or time constraints",
      "No visible adjustment after pushback or audience switch",
      "Defensive posture when challenged",
    ],
    highScoreSignals: [
      "Audience-appropriate vocabulary",
      "Visible register shift between two audiences",
      "Respects stated constraints (time, tone, format)",
      "Acknowledge-redirect-land pattern under pushback",
      "Emotionally attuned to the moment",
    ],
    defaultWeight: 0.9,
    scoringStrategy: "hybrid",
  },
};

export const ALL_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "adaptability",
];

export const CONTENT_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
];

export const DELIVERY_DIMENSIONS: readonly SkillDimension[] = [
  "thinking_quality",
  "delivery",
  "adaptability",
];

/**
 * Weighted composite score across dimensions. User-configurable weights
 * override defaults; absent dimensions are excluded from both numerator
 * and denominator so partial scoring stays honest.
 *
 * The internal off-topic gate (previously `relevance`) applies AFTER this
 * function: if the rep is judged off-topic by the LLM, composite is
 * floored to 40. See scoring pipeline in docs/SCORING_METHODOLOGY.md.
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
