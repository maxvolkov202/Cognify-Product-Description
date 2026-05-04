/**
 * Cognify Ch.11b — Sub-skill score mapper.
 *
 * Converts text-signal numbers (from `extractAllTextSignals`) into per-
 * sub-skill scores (0-100) on the 36 sub-skills defined in
 * `src/types/sub-skills.ts`. Each text signal maps to ONE sub-skill via
 * a tunable threshold curve. Sub-skills not covered by an extractor —
 * including all 11 Delivery + Tone sub-skills, plus the few content
 * sub-skills the text layer can't measure (e.g. coherence,
 * filler_elimination, perspective_taking) — fall back to the dimension's
 * holistic LLM score with `signalSource: "dimension_fallback"`.
 *
 * Why this lives separate from `score.ts`:
 *   - Pure function over signals + dim scores. Easy to unit-test, easy
 *     to re-tune without touching the LLM call site.
 *   - Threshold constants are visible in one place; calibration tweaks
 *     don't require deciphering the score-prompt builder.
 */

import type { SkillDimension } from "@/types/domain";
import {
  ALL_SUB_SKILLS,
  SUB_SKILL_TO_DIMENSION,
  type SubSkillId,
} from "@/types/sub-skills";
import type { TextSignals } from "./types";

/** Anchor: (signalValue, score). Linear interpolation between adjacent
 *  anchors; values outside the range clamp to the nearest endpoint. */
type Anchor = readonly [signalValue: number, score: number];

function interpolate(value: number, anchors: readonly Anchor[]): number {
  if (anchors.length === 0) return 50;
  // Sort by signalValue ascending — caller is expected to author them
  // in order, but defensive sort keeps the function well-defined.
  const sorted = [...anchors].sort((a, b) => a[0] - b[0]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (value >= a[0] && value <= b[0]) {
      const t = (value - a[0]) / (b[0] - a[0]);
      return Math.round(a[1] + t * (b[1] - a[1]));
    }
  }
  return last[1];
}

// ——— Per-signal threshold curves —————————————————————————————

/** Higher jargon rate → lower word_choice score. Saturates at ~10/min. */
const JARGON_TO_WORD_CHOICE: readonly Anchor[] = [
  [0, 90],
  [1, 80],
  [2, 70],
  [3, 60],
  [5, 45],
  [8, 30],
  [12, 20],
];

/** Higher assumed-context count → lower audience_awareness. */
const ASSUMED_CONTEXT_TO_AUDIENCE: readonly Anchor[] = [
  [0, 85],
  [1, 70],
  [2, 55],
  [3, 45],
  [5, 30],
];

/** Ch.S1 — sentence complexity now drives logical_sequencing (not
 *  precision). Long winding clauses degrade the listener's ability to
 *  follow the SEQUENCE of ideas, which is what logical_sequencing
 *  measures. Curve unchanged from the prior precision mapping — just
 *  the destination sub-skill changes. */
const COMPLEXITY_TO_LOGICAL_SEQ: readonly Anchor[] = [
  [0, 75],
  [1, 80],
  [1.5, 78],
  [2, 70],
  [3, 55],
  [5, 35],
  [8, 25],
];

/** Ch.S1 — Word precision (0-100, derived from concreteness lexicon)
 *  drives the precision sub-skill. Higher precision score = more
 *  concrete vocabulary = higher precision sub-skill. */
const WORD_PRECISION_TO_PRECISION: readonly Anchor[] = [
  [0, 25],
  [25, 40],
  [40, 55],
  [55, 70],
  [62, 75],
  [75, 85],
  [88, 92],
];

/** Ch.S1 — Idea density (ideas/sentence) → idea_isolation. Cleaner
 *  isolation (lower density) scores higher; ideas crammed together
 *  score lower. DNA target: density <2.5. */
const IDEA_DENSITY_TO_ISOLATION: readonly Anchor[] = [
  [0.5, 60],
  [1.0, 80],
  [1.5, 85],
  [2.0, 78],
  [2.5, 65],
  [3.5, 50],
  [5.0, 35],
];

/** More abstraction markers without examples → lower concreteness. */
const ABSTRACTION_TO_CONCRETENESS: readonly Anchor[] = [
  [0, 88],
  [1, 75],
  [2, 62],
  [4, 45],
  [6, 32],
  [10, 22],
];

/** Transition rate per minute → signposting. */
const TRANSITION_RATE_TO_SIGNPOSTING: readonly Anchor[] = [
  [0, 32],
  [1, 50],
  [2, 65],
  [3, 75],
  [5, 85],
  [8, 90],
];

/** opening-position score (0-100) → opening_hook (clamped 28..90). */
const OPENING_TO_OPENING_HOOK: readonly Anchor[] = [
  [0, 28],
  [25, 48],
  [50, 65],
  [75, 80],
  [100, 90],
];

/** Hierarchy markers count → argument_hierarchy. */
const HIERARCHY_TO_ARG_HIERARCHY: readonly Anchor[] = [
  [0, 50],
  [1, 65],
  [2, 78],
  [3, 85],
  [5, 90],
];

/** arcCompletion fraction (0..1, three-of-three trio) → narrative_arc. */
const ARC_TO_NARRATIVE: readonly Anchor[] = [
  [0, 32],
  [1 / 3, 52],
  [2 / 3, 72],
  [1, 88],
];

/** Ch.S2 — logical flow score (0-100) → coherence sub-skill. Combined
 *  with coherenceIndex via average in the mapper. */
const FLOW_TO_COHERENCE: readonly Anchor[] = [
  [0, 25],
  [25, 45],
  [50, 65],
  [70, 80],
  [90, 90],
];

/** Ch.S2 — coherence index (0-100) → coherence sub-skill. */
const COHERENCE_INDEX_TO_COHERENCE: readonly Anchor[] = [
  [0, 25],
  [30, 45],
  [60, 65],
  [80, 80],
  [95, 90],
];

/** Hedge rate per minute → hedging_awareness. Saturates above 6/min. */
const HEDGE_TO_HEDGING_AWARENESS: readonly Anchor[] = [
  [0, 90],
  [1, 75],
  [2, 62],
  [4, 42],
  [6, 28],
  [10, 20],
];

/** Repetition score (0-1) → repetition_control. */
const REPETITION_TO_REP_CONTROL: readonly Anchor[] = [
  [0, 90],
  [0.05, 85],
  [0.1, 78],
  [0.2, 65],
  [0.35, 48],
  [0.5, 32],
  [0.8, 22],
];

/** wordsPerDistinctIdea — tighter is better up to ~2x, then padding
 *  hurts. Realistic spoken-rep range observed: 1.4-3.5. */
const WPDI_TO_SCOPING: readonly Anchor[] = [
  [1.0, 60],
  [1.5, 80],
  [2.0, 78],
  [2.5, 70],
  [3.0, 60],
  [4.0, 48],
  [6.0, 32],
];

/** Ch.S3 — stoppingPointAccuracy (0-100) → editing_in_real_time. */
const STOPPING_TO_EDITING: readonly Anchor[] = [
  [0, 25],
  [25, 40],
  [50, 55],
  [70, 75],
  [85, 85],
  [100, 92],
];

/** Claim support rate (0-1) → claim_support. */
const CLAIM_SUPPORT_TO_SUPPORT: readonly Anchor[] = [
  [0, 30],
  [0.3, 50],
  [0.5, 65],
  [0.7, 80],
  [0.9, 90],
  [1.0, 92],
];

/** Counterargument markers count → counterargument_awareness. Absence
 *  isn't auto-failure (some prompts don't invite counterargs). */
const COUNTERARG_TO_COUNTERARG: readonly Anchor[] = [
  [0, 55],
  [1, 75],
  [2, 85],
  [4, 90],
];

/** Depth markers count → depth_of_analysis. */
const DEPTH_TO_DEPTH: readonly Anchor[] = [
  [0, 50],
  [1, 70],
  [2, 82],
  [4, 90],
];

/** Honesty markers — calibrated certainty is good, but stacking them
 *  past 3 starts to look like over-hedging. */
const HONESTY_TO_HONESTY: readonly Anchor[] = [
  [0, 60],
  [1, 78],
  [2, 82],
  [3, 78],
  [5, 68],
  [8, 55],
];

// ——— Mapper ——————————————————————————————————————————————

export type SubSkillScoreEntry = {
  score: number;
  /** Which signal (or "dimension_fallback") drove this score. Lets the
   *  /ops calibration page surface "this sub-skill came from
   *  signal=jargonRatePerMinute=2.3", which is invaluable for tuning. */
  signalSource: string;
};

export type SubSkillScoreMap = Partial<Record<SubSkillId, SubSkillScoreEntry>>;

/** The sub-skills directly driven by a text signal. The remaining 36 -
 *  N entries fall back to the dimension's holistic LLM score. */
const TEXT_DRIVEN_SUB_SKILLS: ReadonlySet<SubSkillId> = new Set<SubSkillId>([
  // Clarity
  "word_choice",
  "audience_awareness",
  "precision",
  "concreteness",
  "idea_isolation", // Ch.S1
  "logical_sequencing", // Ch.S1 (was dimension_fallback pre-S1)
  // Structure
  "signposting",
  "opening_hook",
  "argument_hierarchy",
  "narrative_arc",
  "coherence", // Ch.S2
  // Conciseness
  "hedging_awareness",
  "repetition_control",
  "response_scoping",
  "editing_in_real_time", // Ch.S3
  // Thinking Quality
  "claim_support",
  "counterargument_awareness",
  "depth_of_analysis",
  "intellectual_honesty",
]);

/**
 * Map text signals → per-sub-skill scores. Sub-skills covered by an
 * extractor get a signal-derived score; the rest inherit their
 * dimension's holistic LLM score (passed in via `dimensionScores`) with
 * `signalSource: "dimension_fallback"`.
 *
 * Pure: same (signals, dimensionScores) → same map.
 */
export function mapSignalsToSubSkillScores(
  signals: TextSignals,
  dimensionScores: Partial<Record<SkillDimension, number>>,
): SubSkillScoreMap {
  const map: SubSkillScoreMap = {};
  const c = signals.clarity;
  const s = signals.structure;
  const cn = signals.conciseness;
  const t = signals.thinking_quality;

  // Clarity
  map.word_choice = {
    score: interpolate(c.jargonRatePerMinute, JARGON_TO_WORD_CHOICE),
    signalSource: `jargonRatePerMinute=${c.jargonRatePerMinute}`,
  };
  map.audience_awareness = {
    score: interpolate(c.assumedContextMarkers, ASSUMED_CONTEXT_TO_AUDIENCE),
    signalSource: `assumedContextMarkers=${c.assumedContextMarkers}`,
  };
  // Ch.S1: precision is now driven by wordPrecisionScore (concreteness
  // lexicon); sentence complexity moves to logical_sequencing.
  map.precision = {
    score: interpolate(c.wordPrecisionScore, WORD_PRECISION_TO_PRECISION),
    signalSource: `wordPrecisionScore=${c.wordPrecisionScore}`,
  };
  map.concreteness = {
    score: interpolate(c.abstractionMarkerCount, ABSTRACTION_TO_CONCRETENESS),
    signalSource: `abstractionMarkerCount=${c.abstractionMarkerCount}`,
  };
  map.logical_sequencing = {
    score: interpolate(c.sentenceComplexityIndex, COMPLEXITY_TO_LOGICAL_SEQ),
    signalSource: `sentenceComplexityIndex=${c.sentenceComplexityIndex}`,
  };
  map.idea_isolation = {
    score: interpolate(c.ideaDensity, IDEA_DENSITY_TO_ISOLATION),
    signalSource: `ideaDensity=${c.ideaDensity}`,
  };

  // Structure
  map.signposting = {
    score: interpolate(s.transitionMarkerRate, TRANSITION_RATE_TO_SIGNPOSTING),
    signalSource: `transitionMarkerRate=${s.transitionMarkerRate}/min`,
  };
  map.opening_hook = {
    score: interpolate(s.openingPositionScore, OPENING_TO_OPENING_HOOK),
    signalSource: `openingPositionScore=${s.openingPositionScore}`,
  };
  // Ch.S2 — argument_hierarchy gets a logicalFlowScore boost. Visible
  // hierarchy markers + visible flow both contribute; we average them
  // (50/50) so a rep with explicit "first/second/third" but jumpy flow
  // doesn't max out, and a rep with no markers but tight flow still
  // earns credit.
  const argHierarchyFromMarkers = interpolate(
    s.pointHierarchyMarkers,
    HIERARCHY_TO_ARG_HIERARCHY,
  );
  const argHierarchyFromFlow = interpolate(s.logicalFlowScore, FLOW_TO_COHERENCE);
  map.argument_hierarchy = {
    score: Math.round((argHierarchyFromMarkers + argHierarchyFromFlow) / 2),
    signalSource: `hierarchy=${s.pointHierarchyMarkers}+flow=${s.logicalFlowScore}`,
  };
  const arc = s.arcCompletion;
  const arcFraction =
    ((arc.clearOpening ? 1 : 0) +
      (arc.developedMiddle ? 1 : 0) +
      (arc.definitiveClose ? 1 : 0)) /
    3;
  map.narrative_arc = {
    score: interpolate(arcFraction, ARC_TO_NARRATIVE),
    signalSource: `arcCompletion=${arc.clearOpening ? "Y" : "N"}/${arc.developedMiddle ? "Y" : "N"}/${arc.definitiveClose ? "Y" : "N"}`,
  };
  // Ch.S2 — coherence sub-skill: avg of logicalFlowScore + coherenceIndex.
  const flowScore = interpolate(s.logicalFlowScore, FLOW_TO_COHERENCE);
  const cohScore = interpolate(s.coherenceIndex, COHERENCE_INDEX_TO_COHERENCE);
  map.coherence = {
    score: Math.round((flowScore + cohScore) / 2),
    signalSource: `logicalFlow=${s.logicalFlowScore}+coherenceIndex=${s.coherenceIndex}`,
  };

  // Conciseness
  map.hedging_awareness = {
    score: interpolate(cn.hedgeRatePerMinute, HEDGE_TO_HEDGING_AWARENESS),
    signalSource: `hedgeRatePerMinute=${cn.hedgeRatePerMinute}/min`,
  };
  map.repetition_control = {
    score: interpolate(cn.repetitionScore, REPETITION_TO_REP_CONTROL),
    signalSource: `repetitionScore=${cn.repetitionScore}`,
  };
  map.response_scoping = {
    score: interpolate(cn.wordsPerDistinctIdea, WPDI_TO_SCOPING),
    signalSource: `wordsPerDistinctIdea=${cn.wordsPerDistinctIdea}`,
  };
  map.editing_in_real_time = {
    score: interpolate(cn.stoppingPointAccuracy, STOPPING_TO_EDITING),
    signalSource: `stoppingPointAccuracy=${cn.stoppingPointAccuracy}`,
  };

  // Thinking Quality
  map.claim_support = {
    score: interpolate(t.claimSupportRate, CLAIM_SUPPORT_TO_SUPPORT),
    signalSource: `claimSupportRate=${(t.claimSupportRate * 100).toFixed(0)}%`,
  };
  map.counterargument_awareness = {
    score: interpolate(t.counterargumentMarkers, COUNTERARG_TO_COUNTERARG),
    signalSource: `counterargumentMarkers=${t.counterargumentMarkers}`,
  };
  map.depth_of_analysis = {
    score: interpolate(t.depthOfAnalysisMarkers, DEPTH_TO_DEPTH),
    signalSource: `depthOfAnalysisMarkers=${t.depthOfAnalysisMarkers}`,
  };
  map.intellectual_honesty = {
    score: interpolate(t.intellectualHonestyMarkers, HONESTY_TO_HONESTY),
    signalSource: `intellectualHonestyMarkers=${t.intellectualHonestyMarkers}`,
  };

  // Dimension-fallback for every sub-skill not covered above.
  for (const subSkill of ALL_SUB_SKILLS) {
    if (TEXT_DRIVEN_SUB_SKILLS.has(subSkill)) continue;
    const dim = SUB_SKILL_TO_DIMENSION[subSkill];
    const dimScore = dimensionScores[dim];
    if (dimScore == null) continue;
    map[subSkill] = {
      score: dimScore,
      signalSource: "dimension_fallback",
    };
  }

  return map;
}

/** Compact representation for storage. The `signalSource` strings are
 *  helpful in /ops + debugging but not needed at user-facing render time
 *  — `score.ts` writes only the numeric scores into the rep's
 *  `dimension_scores.signals.subSkillScores` jsonb to keep persisted
 *  payload small. Callers needing the full SignalSource trail should
 *  re-compute via `mapSignalsToSubSkillScores`. */
export function toScoresOnly(
  map: SubSkillScoreMap,
): Partial<Record<SubSkillId, number>> {
  const out: Partial<Record<SubSkillId, number>> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v) out[k as SubSkillId] = v.score;
  }
  return out;
}
