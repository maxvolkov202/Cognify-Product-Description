/**
 * Cognify Ch.11b — Sub-skill score mapper.
 *
 * Converts text-signal numbers (from `extractAllTextSignals`) and prosody
 * features into per-sub-skill scores (0-100) on the Hidden Skill Taxonomy
 * v2 (148 skills, PRD §5.5 / D20). Each signal maps to ONE sub-skill via
 * a tunable threshold curve.
 *
 * D20 rule: deterministic scoring ONLY where a signal genuinely measures
 * the skill. Skills without a real signal get NO entry here — they are
 * LLM-attributed (feedback-bullet `subSkill` tags today; numeric
 * attribution arrives with the Phase 3 grading rethink). The old
 * `dimension_fallback` behavior (copying the dimension's holistic score
 * into every unmeasured sub-skill) is gone: with 148 skills it flooded
 * rep jsonb and the profile with meaningless dimension-score copies.
 *
 * Why this lives separate from `score.ts`:
 *   - Pure function over signals. Easy to unit-test, easy to re-tune
 *     without touching the LLM call site.
 *   - Threshold constants are visible in one place; calibration tweaks
 *     don't require deciphering the score-prompt builder.
 */

import { type SubSkillId } from "@/types/sub-skills";
import type { TextSignals } from "./types";
import type { ProsodyFeatures } from "@/lib/audio/prosody";
import {
  HUME_EMOTION_NAMES,
  type HumeEmotionName,
} from "@/lib/audio/hume-prosody";

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

/** Higher jargon rate → lower vocabulary_precision score. Saturates at ~10/min. */
const JARGON_TO_WORD_CHOICE: readonly Anchor[] = [
  [0, 90],
  [1, 80],
  [2, 70],
  [3, 60],
  [5, 45],
  [8, 30],
  [12, 20],
];

/** Higher assumed-context count → lower audience_calibration. */
const ASSUMED_CONTEXT_TO_AUDIENCE: readonly Anchor[] = [
  [0, 85],
  [1, 70],
  [2, 55],
  [3, 45],
  [5, 30],
];

/** Ch.S1 — sentence complexity now drives listener_first_sequencing (not
 *  precision). Long winding clauses degrade the listener's ability to
 *  follow the SEQUENCE of ideas, which is what listener_first_sequencing
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

/** Hedge rate per minute → hedging_control. Saturates above 6/min. */
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

/** Ch.S3 — stoppingPointAccuracy (0-100) → real_time_editing. */
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

/** Ch.S4 — originalityIndex (0-100) → first_principles_reasoning. */
const ORIGINALITY_TO_FIRST_PRINCIPLES: readonly Anchor[] = [
  [0, 25],
  [25, 45],
  [50, 65],
  [70, 80],
  [90, 90],
];

/** Ch.S4 — self-correction count → intellectual_honesty PENALTY.
 *  Inverse: 0 corrections = no penalty (return high), 1+ corrections
 *  drag honesty down. Caller blends this with HONESTY_TO_HONESTY via
 *  min(). */
const SELF_CORRECTION_TO_HONESTY: readonly Anchor[] = [
  [0, 88],
  [1, 70],
  [2, 55],
  [3, 40],
  [5, 25],
];

// ——— Ch.S5 — Tone sub-skill curves (Hume emotion-derived) ————————

/** Variance of Excitement+Determination+Joy across windows → prosodic_alignment.
 *  Higher variance = vocal variety. Hume emotion scores are 0-1 so
 *  variance ranges roughly 0-0.04 in practice; we scale up for the curve. */
const HUME_VARIANCE_TO_PITCH_VARIATION: readonly Anchor[] = [
  [0, 30],
  [0.005, 50],
  [0.01, 65],
  [0.02, 80],
  [0.04, 90],
];

/** 1 - (Anxiety_mean + Distress_mean) → emphasis_timing. Low anxiety
 *  reads as controlled vocal energy. */
const HUME_CONTROL_TO_VOLUME_CONTROL: readonly Anchor[] = [
  [0, 30],
  [0.4, 50],
  [0.7, 70],
  [0.85, 82],
  [0.95, 88],
];

/** 1 - (Doubt_mean + Confusion_mean) → confidence. Confident,
 *  declarative statements close downward; doubt/confusion close upward. */
const HUME_CONFIDENCE_TO_DOWNWARD: readonly Anchor[] = [
  [0, 25],
  [0.4, 50],
  [0.7, 70],
  [0.9, 85],
];

/** Calmness + Contentment + Joy minus Awkwardness/Embarrassment →
 *  emotional_authenticity. Genuine warmth absent self-consciousness. */
const HUME_AUTH_TO_AUTHENTICITY: readonly Anchor[] = [
  [-0.2, 30],
  [0.1, 50],
  [0.3, 70],
  [0.5, 82],
  [0.7, 88],
];

/** Determination + Pride + Triumph → gravitas. */
const HUME_PRESENCE_TO_PRESENCE: readonly Anchor[] = [
  [0, 30],
  [0.2, 55],
  [0.4, 72],
  [0.6, 82],
  [0.8, 88],
];

/** Calmness + Contentment + Sympathy + Love → warmth. */
const HUME_WARMTH_TO_WARMTH: readonly Anchor[] = [
  [0, 30],
  [0.2, 50],
  [0.4, 68],
  [0.6, 80],
  [0.8, 88],
];

// ——— Taxonomy v2 — prosody-measured curves ————————————————————

/** Filler rate per minute → filler_reduction (conciseness). Same shape
 *  as the deterministic pacing scorer's target: <2/min is strong. */
const FILLER_RATE_TO_FILLER_REDUCTION: readonly Anchor[] = [
  [0, 92],
  [1, 85],
  [2, 75],
  [4, 55],
  [6, 40],
  [10, 25],
];

/** Words per minute → rate_awareness (delivery). Band-shaped: the
 *  150-160 wpm retention band scores highest; both rushing and crawling
 *  degrade. */
const WPM_TO_RATE_AWARENESS: readonly Anchor[] = [
  [80, 35],
  [110, 55],
  [135, 75],
  [150, 88],
  [160, 88],
  [180, 72],
  [200, 52],
  [230, 35],
];

// ——— Mapper ——————————————————————————————————————————————

export type SubSkillScoreEntry = {
  score: number;
  /** Which signal drove this score. Lets the
   *  /ops calibration page surface "this sub-skill came from
   *  signal=jargonRatePerMinute=2.3", which is invaluable for tuning. */
  signalSource: string;
};

export type SubSkillScoreMap = Partial<Record<SubSkillId, SubSkillScoreEntry>>;

/** Look up an emotion's mean / variance from a ProsodyFeatures object's
 *  Hume-emotion arrays. Returns 0 when prosody is null or emotion is
 *  absent. */
function humeMean(p: ProsodyFeatures | null | undefined, name: HumeEmotionName): number {
  if (!p?.humeEmotionMeans) return 0;
  const idx = HUME_EMOTION_NAMES.indexOf(name);
  return idx >= 0 ? (p.humeEmotionMeans[idx] ?? 0) : 0;
}
function humeVariance(p: ProsodyFeatures | null | undefined, name: HumeEmotionName): number {
  if (!p?.humeEmotionVariances) return 0;
  const idx = HUME_EMOTION_NAMES.indexOf(name);
  return idx >= 0 ? (p.humeEmotionVariances[idx] ?? 0) : 0;
}

/**
 * Map text signals (+ prosody when available) → per-sub-skill scores.
 * Only skills a signal genuinely measures get an entry (D20); everything
 * else is LLM-attributed elsewhere.
 *
 * Pure: same (signals, prosody) → same map.
 */
export function mapSignalsToSubSkillScores(
  signals: TextSignals,
  prosody?: ProsodyFeatures | null,
): SubSkillScoreMap {
  const map: SubSkillScoreMap = {};
  const c = signals.clarity;
  const s = signals.structure;
  const cn = signals.conciseness;
  const t = signals.thinking_quality;

  // Clarity
  map.vocabulary_precision = {
    score: interpolate(c.jargonRatePerMinute, JARGON_TO_WORD_CHOICE),
    signalSource: `jargonRatePerMinute=${c.jargonRatePerMinute}`,
  };
  map.audience_calibration = {
    score: interpolate(c.assumedContextMarkers, ASSUMED_CONTEXT_TO_AUDIENCE),
    signalSource: `assumedContextMarkers=${c.assumedContextMarkers}`,
  };
  // Ch.S1: precision is now driven by wordPrecisionScore (concreteness
  // lexicon); sentence complexity moves to listener_first_sequencing.
  map.lexical_specificity = {
    score: interpolate(c.wordPrecisionScore, WORD_PRECISION_TO_PRECISION),
    signalSource: `wordPrecisionScore=${c.wordPrecisionScore}`,
  };
  map.concreteness = {
    score: interpolate(c.abstractionMarkerCount, ABSTRACTION_TO_CONCRETENESS),
    signalSource: `abstractionMarkerCount=${c.abstractionMarkerCount}`,
  };
  map.listener_first_sequencing = {
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
  map.hedging_control = {
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
  map.real_time_editing = {
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
  // Ch.S4 — intellectual_honesty blends calibrated-certainty markers
  // (positive) with self-correction markers (negative). Self-correction
  // pulls down hard: a rep with 3+ corrections takes max 40 honesty
  // even if it has plenty of calibrated-certainty hedges. Implementation:
  // take the MIN of the two anchor curves (the worst-of-two semantics).
  const honestyFromMarkers = interpolate(
    t.intellectualHonestyMarkers,
    HONESTY_TO_HONESTY,
  );
  const honestyFromCorrections = interpolate(
    t.logicalConsistencyMarkers,
    SELF_CORRECTION_TO_HONESTY,
  );
  map.intellectual_honesty = {
    score: Math.min(honestyFromMarkers, honestyFromCorrections),
    signalSource: `honesty=${t.intellectualHonestyMarkers}-corrections=${t.logicalConsistencyMarkers}`,
  };
  // Ch.S4 — first_principles_reasoning driven by originalityIndex.
  map.first_principles_reasoning = {
    score: interpolate(t.originalityIndex, ORIGINALITY_TO_FIRST_PRINCIPLES),
    signalSource: `originalityIndex=${t.originalityIndex}`,
  };

  // Taxonomy v2 — prosody-measured skills (raw DSP features, no Hume
  // needed): filler rate and speaking rate genuinely measure
  // filler_reduction (conciseness) and rate_awareness (delivery).
  if (prosody) {
    map.filler_reduction = {
      score: interpolate(
        prosody.fillerRatePerMinute,
        FILLER_RATE_TO_FILLER_REDUCTION,
      ),
      signalSource: `fillerRatePerMinute=${prosody.fillerRatePerMinute.toFixed(1)}`,
    };
    map.rate_awareness = {
      score: interpolate(prosody.wordsPerMinute, WPM_TO_RATE_AWARENESS),
      signalSource: `wordsPerMinute=${prosody.wordsPerMinute.toFixed(0)}`,
    };
  }

  // Ch.S5 — voice-presence skills driven by the Hume emotion vector when
  // present. Under taxonomy v2 the prosodic-mechanics targets live in
  // `delivery` (prosodic_alignment, emphasis_timing) and the emotional-
  // presence targets in `tone` (confidence, emotional_authenticity,
  // gravitas, warmth). Without audio these skills get no entry — they
  // are LLM-attributed via feedback bullets instead (D20).
  if (prosody?.humeEmotionMeans && prosody.humeEmotionMeans.length > 0) {
    // prosodic_alignment: variance of Excitement + Determination + Joy.
    const pitchVarSig =
      humeVariance(prosody, "Excitement") +
      humeVariance(prosody, "Determination") +
      humeVariance(prosody, "Joy");
    map.prosodic_alignment = {
      score: interpolate(pitchVarSig, HUME_VARIANCE_TO_PITCH_VARIATION),
      signalSource: `humeVariance(Excitement+Determination+Joy)=${pitchVarSig.toFixed(4)}`,
    };

    // emphasis_timing: 1 - (Anxiety + Distress) means.
    const ctrlSig = Math.max(
      0,
      1 - humeMean(prosody, "Anxiety") - humeMean(prosody, "Distress"),
    );
    map.emphasis_timing = {
      score: interpolate(ctrlSig, HUME_CONTROL_TO_VOLUME_CONTROL),
      signalSource: `humeControl(1-Anxiety-Distress)=${ctrlSig.toFixed(3)}`,
    };

    // confidence: 1 - (Doubt + Confusion) means.
    const downSig = Math.max(
      0,
      1 - humeMean(prosody, "Doubt") - humeMean(prosody, "Confusion"),
    );
    map.confidence = {
      score: interpolate(downSig, HUME_CONFIDENCE_TO_DOWNWARD),
      signalSource: `humeConfident(1-Doubt-Confusion)=${downSig.toFixed(3)}`,
    };

    // emotional_authenticity: Calmness + Contentment + Joy minus
    // Awkwardness + Embarrassment.
    const authSig =
      humeMean(prosody, "Calmness") +
      humeMean(prosody, "Contentment") +
      humeMean(prosody, "Joy") -
      humeMean(prosody, "Awkwardness") -
      humeMean(prosody, "Embarrassment");
    map.emotional_authenticity = {
      score: interpolate(authSig, HUME_AUTH_TO_AUTHENTICITY),
      signalSource: `humeAuth(Calm+Content+Joy-Awk-Emb)=${authSig.toFixed(3)}`,
    };

    // gravitas: Determination + Pride + Triumph.
    const presSig =
      humeMean(prosody, "Determination") +
      humeMean(prosody, "Pride") +
      humeMean(prosody, "Triumph");
    map.gravitas = {
      score: interpolate(presSig, HUME_PRESENCE_TO_PRESENCE),
      signalSource: `humePresence(Determ+Pride+Triumph)=${presSig.toFixed(3)}`,
    };

    // warmth: Calmness + Contentment + Sympathy + Love.
    const warmthSig =
      humeMean(prosody, "Calmness") +
      humeMean(prosody, "Contentment") +
      humeMean(prosody, "Sympathy") +
      humeMean(prosody, "Love");
    map.warmth = {
      score: interpolate(warmthSig, HUME_WARMTH_TO_WARMTH),
      signalSource: `humeWarmth(Calm+Content+Symp+Love)=${warmthSig.toFixed(3)}`,
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
