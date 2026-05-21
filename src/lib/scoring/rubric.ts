import {
  DIMENSION_WEIGHTS,
  SKILL_DIMENSION_GROUPS,
  type SkillDimension,
} from "@/types/domain";

/**
 * Cognify scoring rubric — v3.0.0 (DNA reconciliation 2026-05-01)
 *
 * Six dimensions aligned with the Cognify DNA spec. Renamed from v2.0.0:
 *   - adaptability → tone (DNA defines Tone via pitch / volume / inflection
 *                          / vocal presence / warmth / articulation)
 *   - delivery is now Pacing-equivalent (rate, pauses, fillers, rhythm)
 *   - thinking_quality moved into the Content group (it's about what you
 *     said, not how)
 *
 * Groupings:
 *   Content  = {clarity, structure, conciseness, thinking_quality}
 *   Delivery = {delivery, tone}
 *
 * Composite weights now read from `DIMENSION_WEIGHTS` (single source of
 * truth in src/types/domain.ts) — clarity 25, structure 20, thinking 20,
 * conciseness 15, delivery 10, tone 10.
 *
 * When this rubric changes in a way that shifts scoring outputs, bump
 * RUBRIC_VERSION. Past rep scores stay tagged with the version they were
 * scored under, so trend lines remain honest across rubric evolutions.
 */

/**
 * v3.3.0 (Phase 3 — slim knowledge anchors, 2026-05-21): replaced the
 * full ~25KB skill knowledge blocks (clarity, structure, conciseness,
 * tone) injected into the score prompt with ~6KB of anchor-only signal
 * lists. Rich originals moved to skills-full/ for Phase 4 RAG
 * ingestion. No scoring math change; the model has less prose to read,
 * faster prompt generation, smaller cache footprint. Reps scored under
 * v3.3.0 should fall within ±5pt of v3.2.0 on the calibration harness
 * — verified before merge.
 *
 * v3.2.0 (Ch.13 — Band copy + per-dim rubric anchors 2026-05-02): adds
 * 30 anchored band statements (6 dims × 5 bands) into the score prompt
 * via `rubric-anchors.ts` (FF_BAND_ANCHORS-gated). Surface band copy
 * is rendered into ScoreHero unflagged — it's a string render, no
 * scoring impact. Composite math + weights unchanged.
 *
 * v3.1.0 (Ch.11): added the deterministic SIGNALS block to the score
 * prompt for the four LLM-scored content dimensions and persisted
 * per-sub-skill scores from the text-signal mapper. Composite math,
 * weights, band definitions unchanged from v3.0.0.
 *
 * Reps with the FF off score on the lower-version path and are tagged
 * with the current version anyway — the version is the rubric the rep
 * was eligible for, not the path it took.
 */
export const RUBRIC_VERSION = "v3.3.0";

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
    defaultWeight: DIMENSION_WEIGHTS.clarity,
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
    defaultWeight: DIMENSION_WEIGHTS.structure,
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
    defaultWeight: DIMENSION_WEIGHTS.conciseness,
    scoringStrategy: "hybrid",
  },
  thinking_quality: {
    dimension: "thinking_quality",
    group: "content",
    definition:
      "Depth and rigor of the thought behind the words. Claims are supported, reasoning goes beyond the surface, the speaker engages complexity rather than avoiding it. The substance of what is said, not the polish of how.",
    lowScoreSignals: [
      "Unsupported claims — assertions without reason or evidence",
      "Surface-level reasoning that restates the prompt without developing it",
      "No engagement with counterarguments or alternative views",
      "Logical chain breaks (conclusion doesn't follow premise)",
      "Hedges that signal weak conviction: 'I think', 'maybe', 'kind of'",
    ],
    highScoreSignals: [
      "Every claim followed by reason, example, or evidence",
      "Reasoning addresses why and so what — not just what",
      "Acknowledges complexity and engages opposing views",
      "Logical connectors used correctly (because, therefore, so)",
      "Goes beyond the predictable first-instinct answer",
    ],
    defaultWeight: DIMENSION_WEIGHTS.thinking_quality,
    scoringStrategy: "hybrid",
  },
  // ——— Delivery ——————————————————————————————————————
  delivery: {
    dimension: "delivery",
    group: "delivery",
    definition:
      "Rate, pauses, fillers, rhythm. The mechanics of speech under real-time conditions. Stable WPM in the 150-160 range, intentional pauses for cognitive bookmarking, low filler frequency, finishes cleanly within time.",
    lowScoreSignals: [
      "Speech rate well outside 130-170 wpm range",
      "High filler rate (> 5 per minute) — um, uh, like, you know",
      "Pauses absent or random instead of after key points",
      "Rushing in the final quartile",
      "Going significantly over or under time budget",
    ],
    highScoreSignals: [
      "Consistent WPM across rep quartiles, ~150-160 average",
      "Purposeful 1-3 second pauses after key points",
      "Filler rate < 2 per minute",
      "Finishes within 10% of time budget",
      "Final sentence lands cleanly",
    ],
    defaultWeight: DIMENSION_WEIGHTS.delivery,
    scoringStrategy: "deterministic",
  },
  tone: {
    dimension: "tone",
    group: "delivery",
    definition:
      "Vocal expressiveness — pitch variation, volume control, downward inflection on statements, vocal presence, warmth, and articulation. The first signal a listener processes before a single word is understood. Carries credibility, authority, and trust.",
    lowScoreSignals: [
      "Monotone — sustained flat pitch (low semitone variance)",
      "Upspeak — rising inflection at the end of statements",
      "Volume locked at one level, no emphasis variation",
      "Voice sounds tight, breathy, or low-energy",
      "Mumbling or unclear consonant articulation",
    ],
    highScoreSignals: [
      "Intentional pitch variation across the response (≥3 semitones range)",
      "Statements close with downward pitch — signals conviction",
      "Volume rises and falls to mark important words",
      "Crisp consonant articulation throughout",
      "Vocal energy holds from first sentence to last",
    ],
    defaultWeight: DIMENSION_WEIGHTS.tone,
    scoringStrategy: "hybrid",
  },
};

export const ALL_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

export const CONTENT_DIMENSIONS: readonly SkillDimension[] =
  SKILL_DIMENSION_GROUPS.content;

export const DELIVERY_DIMENSIONS: readonly SkillDimension[] =
  SKILL_DIMENSION_GROUPS.delivery;

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
