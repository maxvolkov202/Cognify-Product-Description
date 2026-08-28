import type { SignalBundle } from "./signals";
import type { SkillDimension } from "@/types/domain";

/**
 * Cognify Deterministic Scorers — v2-beta.1
 *
 * Pure-function scorers that consume a SignalBundle and return a
 * numeric score + human-readable reasons for the score. These are the
 * model-stable layer of Cognify's hybrid scoring architecture.
 *
 * Two of Cognify's six dimensions are scored here:
 *
 *   - pacing     : pure deterministic (no LLM component)
 *   - confidence : hybrid — deterministic baseline that the LLM layer
 *                  blends against for the final score
 *
 * The other four dimensions (clarity, structure, relevance, tone) are
 * LLM-scored in src/lib/ai/score.ts. Pacing is fully deterministic
 * because the signals map 1:1 to what users perceive as "pacing" —
 * filler rate, WPM stability, time-budget compliance. Confidence is
 * hybrid because the deterministic signals cover the measurable part
 * (hedges, restarts, pauses, quartile stability) but the semantic
 * "did the speaker sound sure of themselves" layer needs LLM judgment.
 *
 * Scoring bands:
 *   95+  : near-perfect — reserved
 *   80-94: strong rep
 *   60-79: working but noticeable issues
 *   40-59: clear problems
 *   20-39: serious problems
 */

export type DeterministicScoreResult = {
  dimension: SkillDimension;
  score: number;
  signals: string[];
};

const MIN_SCORE = 20;
const MAX_SCORE = 98;

/** Grading plan WS3 (§4.5) — below this duration a words-per-minute figure
 *  is noise (three words in two seconds is "90 wpm"). Shared by the prompt's
 *  rate line (`renderRateLine`) and the deterministic WPM branches below so
 *  the number and the copy agree. */
export const RATE_MEASURABLE_MIN_MS = 8_000;

function clamp(n: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(n)));
}

export type PacingSubScores = {
  /** Distance of the measured rate from the 130-165 band (n/a → 85). */
  rate: number;
  /** Quartile WPM stability + final-quartile rush. */
  stability: number;
  /** Pause placement: clause-end pauses up, stalls and mid-phrase pauses down. */
  pauses: number;
  /** Filler and hedge rates. */
  fluency: number;
  /** Over-budget only; under-budget is never docked (WS3). */
  budget: number;
};

const PACING_WEIGHTS: Record<keyof PacingSubScores, number> = {
  rate: 0.35,
  stability: 0.15,
  pauses: 0.2,
  fluency: 0.2,
  budget: 0.1,
};

const clamp01to100 = (n: number) => Math.max(0, Math.min(100, n));
const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) =>
  y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

/** Rate sub-score from the rubric's own band: 130-165 is well-paced; above
 *  ~170 is docked progressively (edge rule 3 — the band is symmetric only at
 *  the low end); below 110 is docked mildly. Not judged under 8 s. */
export function pacingRateSubScore(wpm: number, durationMs: number): number {
  if (durationMs < RATE_MEASURABLE_MIN_MS) return 85;
  if (wpm >= 130 && wpm <= 165) return 100;
  if (wpm > 165) {
    if (wpm <= 170) return lerp(wpm, 165, 100, 170, 95);
    if (wpm <= 190) return lerp(wpm, 170, 95, 190, 65);
    if (wpm <= 220) return lerp(wpm, 190, 65, 220, 40);
    return Math.max(25, lerp(wpm, 220, 40, 260, 25));
  }
  // below the band: mild
  if (wpm >= 110) return lerp(wpm, 110, 85, 130, 100);
  if (wpm >= 70) return lerp(wpm, 70, 55, 110, 85);
  return Math.max(35, lerp(wpm, 40, 35, 70, 55));
}

function pacingStabilitySubScore(signals: SignalBundle): number {
  if (signals.durationMs < RATE_MEASURABLE_MIN_MS) return 85;
  const mean =
    (signals.quartileWpm[0] + signals.quartileWpm[1] + signals.quartileWpm[2] + signals.quartileWpm[3]) / 4;
  if (mean <= 0) return 85;
  // Coefficient of variation across quartiles: < 0.15 is locked-in, 0.45 is
  // wobbling badly.
  const cv = Math.sqrt(signals.quartileWpmVariance) / mean;
  let score = cv <= 0.15 ? 100 : cv >= 0.45 ? 45 : lerp(cv, 0.15, 100, 0.45, 45);
  // Final-quartile rush (> 30% above the rep's mean) is the rubric's
  // explicit low signal.
  if (signals.finalQuartileDelta > 0.3) score -= 15;
  return clamp01to100(score);
}

function pacingPauseSubScore(signals: SignalBundle): number {
  const minutes = Math.max(0.25, signals.durationMs / 60_000);
  // Baseline 80: no pause evidence either way. Clause-end pauses lift it
  // (up to +20), stalls and mid-phrase hesitations pull it down. Rates are
  // per minute so a short rep is not treated like a long one.
  let score = 80;
  score += Math.min(20, (signals.clausePauseCount / minutes) * 5);
  score -= Math.min(30, (signals.stallCount / minutes) * 12);
  score -= Math.min(25, (signals.midPhrasePauseCount / minutes) * 6);
  return clamp01to100(score);
}

function pacingFluencySubScore(signals: SignalBundle): number {
  // Up to 2 fillers/min is unremarkable; 8/min is heavy.
  let score =
    signals.fillerRate <= 2 ? 100 : signals.fillerRate >= 8 ? 45 : lerp(signals.fillerRate, 2, 100, 8, 45);
  const hedgeOver = Math.max(0, signals.hedgeRate - 1);
  score -= Math.min(15, hedgeOver * 4);
  return clamp01to100(score);
}

function pacingBudgetSubScore(signals: SignalBundle): number {
  if (signals.timeBudgetRatio <= 1.1) return 100;
  const overPct = (signals.timeBudgetRatio - 1) * 100;
  return clamp01to100(overPct >= 60 ? 40 : lerp(overPct, 10, 100, 60, 40));
}

export type PacingScoreResult = DeterministicScoreResult & {
  subScores: PacingSubScores;
  /** Delivery feedback generated from the SAME numbers as the score, so the
   *  copy can never contradict the number (audit §1.3). */
  feedback: string;
};

function describeRate(wpm: number, durationMs: number): string {
  const r = Math.round(wpm);
  if (durationMs < RATE_MEASURABLE_MIN_MS) return "too short to measure a steady rate";
  if (wpm >= 130 && wpm <= 165) return `${r} words per minute, inside the 130-165 range listeners follow best`;
  if (wpm > 165) return `${r} words per minute, above the 130-165 range listeners follow best`;
  return `${r} words per minute, below the 130-165 range listeners follow best`;
}

export function buildPacingFeedback(signals: SignalBundle, sub: PacingSubScores): string {
  const parts: string[] = [`You spoke at ${describeRate(signals.wpm, signals.durationMs)}`];
  const evidence: string[] = [];
  evidence.push(`${signals.fillerRate.toFixed(1)} fillers a minute`);
  if (signals.clausePauseCount > 0)
    evidence.push(`${signals.clausePauseCount} deliberate pause${signals.clausePauseCount === 1 ? "" : "s"} after a point`);
  if (signals.stallCount > 0)
    evidence.push(`${signals.stallCount} stall${signals.stallCount === 1 ? "" : "s"} over 3 seconds`);
  if (signals.midPhrasePauseCount > 0)
    evidence.push(`${signals.midPhrasePauseCount} mid-sentence pause${signals.midPhrasePauseCount === 1 ? "" : "s"}`);
  if (signals.timeBudgetRatio > 1.1)
    evidence.push(`${Math.round((signals.timeBudgetRatio - 1) * 100)}% past the time budget`);
  parts[0] += `, with ${evidence.join(", ")}.`;

  // One action, aimed at the weakest sub-score.
  const weakest = (Object.keys(sub) as (keyof PacingSubScores)[]).reduce((a, b) => (sub[b] < sub[a] ? b : a));
  const action: Record<keyof PacingSubScores, string> = {
    rate:
      signals.wpm > 165
        ? "Slow the delivery a notch so each point has room to land."
        : "Pick up the pace slightly so the listener stays with you.",
    stability:
      signals.finalQuartileDelta > 0.3
        ? "You sped up at the end; keep the closing sentence at the same pace as the opening."
        : "Keep the pace even from the first quartile to the last.",
    pauses:
      signals.stallCount > 0
        ? "Cut the long stalls; a one-second pause after a key point is enough."
        : signals.midPhrasePauseCount > 0
          ? "Move your pauses to the end of a sentence instead of the middle."
          : "Add a short pause after each key point.",
    fluency:
      signals.fillerRate > 2
        ? "Replace the fillers with a silent beat."
        : "Drop the hedges; state the claim and stop.",
    budget: "Stop when the point is complete instead of running past the time budget.",
  };
  if (sub[weakest] >= 90) parts.push("Keep this pace; it is working.");
  else parts.push(action[weakest]);
  return parts.join(" ");
}

/**
 * Pacing — pure deterministic scoring (WS4 rebuild, grading plan §3.4).
 *
 * A weighted function of the rubric's own signals: rate distance from the
 * 130-165 band, quartile stability, pause placement, filler/hedge fluency,
 * and over-budget only. Every sub-score is returned, and the feedback text
 * is generated from the same numbers. Re-scoring the same audio returns
 * the same result. Replaces the "92 minus penalties" formula the audit
 * found clumped 79% of human reps at exactly 92.
 */
export function scorePacing(signals: SignalBundle): PacingScoreResult {
  const subScores: PacingSubScores = {
    rate: pacingRateSubScore(signals.wpm, signals.durationMs),
    stability: pacingStabilitySubScore(signals),
    pauses: pacingPauseSubScore(signals),
    fluency: pacingFluencySubScore(signals),
    budget: pacingBudgetSubScore(signals),
  };
  const weighted = (Object.keys(PACING_WEIGHTS) as (keyof PacingSubScores)[]).reduce(
    (acc, k) => acc + subScores[k] * PACING_WEIGHTS[k],
    0,
  );
  const reasons: string[] = [
    `Rate: ${Math.round(signals.wpm)} WPM (${Math.round(subScores.rate)})`,
    `Stability: ${Math.round(subScores.stability)}`,
    `Pauses: ${signals.clausePauseCount} after a point, ${signals.midPhrasePauseCount} mid-phrase, ${signals.stallCount} stalls (${Math.round(subScores.pauses)})`,
    `Fluency: ${signals.fillerRate.toFixed(1)} fillers/min, ${signals.hedgeRate.toFixed(1)} hedges/min (${Math.round(subScores.fluency)})`,
    ...(signals.timeBudgetRatio > 1.1
      ? [`Over time budget by ${Math.round((signals.timeBudgetRatio - 1) * 100)}% (${Math.round(subScores.budget)})`]
      : []),
  ];
  return {
    dimension: "delivery",
    score: clamp(weighted),
    signals: reasons,
    subScores,
    feedback: buildPacingFeedback(signals, subScores),
  };
}

/**
 * Thinking Quality — deterministic baseline (LLM blends on top in
 * score.ts). Renamed from scoreConfidenceDeterministic in the v2.0.0
 * rename — signals are unchanged (hedges/restarts/stalls all measure
 * the same quality-of-thinking-on-spot).
 *
 * Signals: hedges, restarts, long pauses, stalls, final-quartile rush.
 * These capture the measurable components of real-time generation
 * coherence. The LLM layer handles the semantic "did they sound sharp"
 * overlay.
 */
export function scoreThinkingQualityDeterministic(
  signals: SignalBundle,
): DeterministicScoreResult {
  let score = 85;
  const reasons: string[] = [];

  // ——— Hedge rate penalty (heavier than pacing's) ———————————
  const hedgePenalty = Math.min(22, signals.hedgeRate * 4);
  if (hedgePenalty > 0) {
    score -= hedgePenalty;
    reasons.push(`Hedge rate: ${signals.hedgeRate.toFixed(1)}/min`);
  }

  // ——— Restart penalty — working memory overflow signal ———————
  const restartPenalty = Math.min(20, signals.restartCount * 5);
  if (restartPenalty > 0) {
    score -= restartPenalty;
    reasons.push(
      `${signals.restartCount} restart${signals.restartCount === 1 ? "" : "s"}`,
    );
  }

  // Grading plan WS3 (§4.7) — pause / stall penalties scale with
  // duration so a 10 s rep with one pause is not treated like a 60 s rep
  // with six. Full weight from one minute up; a 10 s rep pays a sixth.
  const durationScale = Math.min(1, Math.max(0, signals.durationMs) / 60_000);
  // Reasons explain the docked amount: a scaled penalty says so, and one
  // that rounds to nothing is not reported at all.
  const scaledNote =
    durationScale < 1
      ? ` (reduced weight, ${Math.round(signals.durationMs / 1000)}s rep)`
      : "";

  // ——— Long pause penalty ———————————————————————————
  const longPausePenalty = Math.min(15, signals.longPauseCount * 3 * durationScale);
  if (longPausePenalty >= 1) {
    score -= longPausePenalty;
    reasons.push(
      `${signals.longPauseCount} long pause${signals.longPauseCount === 1 ? "" : "s"} > 1.5s${scaledNote}`,
    );
  }

  // ——— Stall penalty — heavier, because stalls are visible ———
  const stallPenalty = Math.min(22, signals.stallCount * 7 * durationScale);
  if (stallPenalty >= 1) {
    score -= stallPenalty;
    reasons.push(
      `${signals.stallCount} stall${signals.stallCount === 1 ? "" : "s"} > 3s${scaledNote}`,
    );
  }

  // ——— Final-quartile rush penalty ———————————————————————
  // Rushing the closer signals panic under time pressure.
  if (signals.finalQuartileDelta > 0.30) {
    score -= 8;
    reasons.push(
      `Rushed the close (+${Math.round(signals.finalQuartileDelta * 100)}% pacing)`,
    );
  }

  return {
    dimension: "thinking_quality",
    score: clamp(score),
    signals:
      reasons.length > 0
        ? reasons
        : ["Steady thinking — clean recovery, no hedges, stable generation"],
  };
}

/**
 * Legacy alias for callers still referencing the pre-rename function
 * name. Prefer `scoreThinkingQualityDeterministic` — this shim exists
 * only so the rename lands in one PR without breaking downstream.
 * @deprecated use scoreThinkingQualityDeterministic
 */
export const scoreConfidenceDeterministic = scoreThinkingQualityDeterministic;

/**
 * Blend a deterministic score with an LLM-generated score. Used for
 * confidence (hybrid dimension). For pacing (pure deterministic), call
 * scorePacing() directly and use its result as-is.
 *
 * Default weight: 60% deterministic / 40% LLM. This biases toward the
 * model-stable layer while letting LLM semantic judgment lift or drop
 * the baseline based on qualitative cues.
 */
export function blendScores(
  deterministic: number,
  llm: number,
  weightDeterministic: number = 0.6,
): number {
  const w = Math.max(0, Math.min(1, weightDeterministic));
  return Math.round(deterministic * w + llm * (1 - w));
}
