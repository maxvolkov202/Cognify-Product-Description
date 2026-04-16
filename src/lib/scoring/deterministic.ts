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

function clamp(n: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(n)));
}

/**
 * Pacing — pure deterministic scoring.
 *
 * Signals: filler rate, hedge rate, time-budget compliance, WPM sanity.
 * No LLM component. Trend lines for this dimension are mathematically
 * stable — re-scoring the same audio returns the exact same pacing
 * score today, next week, and next year.
 */
export function scorePacing(signals: SignalBundle): DeterministicScoreResult {
  let score = 92;
  const reasons: string[] = [];

  // ——— Filler rate penalty ———————————————————————————
  // Baseline: up to 2 fillers/min is unremarkable in natural speech.
  // Above that, penalize 3 points per filler/min, capped at 28.
  const fillerOver = Math.max(0, signals.fillerRate - 2);
  const fillerPenalty = Math.min(28, fillerOver * 3);
  if (fillerPenalty > 0) {
    score -= fillerPenalty;
    reasons.push(`Filler rate: ${signals.fillerRate.toFixed(1)}/min`);
  }

  // ——— Hedge rate penalty ———————————————————————————
  // Hedging affects pacing less than confidence but still costs something.
  const hedgeOver = Math.max(0, signals.hedgeRate - 1);
  const hedgePenalty = Math.min(15, hedgeOver * 2);
  if (hedgePenalty > 0) {
    score -= hedgePenalty;
    reasons.push(`Hedge rate: ${signals.hedgeRate.toFixed(1)}/min`);
  }

  // ——— Time budget compliance ———————————————————————————
  if (signals.timeBudgetRatio > 1.10) {
    const overPct = Math.round((signals.timeBudgetRatio - 1) * 100);
    const penalty = Math.min(12, overPct);
    score -= penalty;
    reasons.push(`Over time budget by ${overPct}%`);
  } else if (signals.timeBudgetRatio < 0.50) {
    score -= 8;
    reasons.push(
      `Under budget — only ${Math.round(signals.timeBudgetRatio * 100)}% used`,
    );
  }

  // ——— WPM sanity check ———————————————————————————
  // Natural conversational speech is 120-180 WPM. Outside 70-220 is a
  // signal something's wrong — too slow (dragging) or too fast (rushing).
  if (signals.wpm < 70 && signals.wordCount > 5) {
    score -= 5;
    reasons.push(`Pace slow: ${Math.round(signals.wpm)} WPM`);
  } else if (signals.wpm > 220) {
    score -= 5;
    reasons.push(`Pace rushed: ${Math.round(signals.wpm)} WPM`);
  }

  return {
    dimension: "pacing",
    score: clamp(score),
    signals:
      reasons.length > 0
        ? reasons
        : [
            `Clean pacing — ${Math.round(signals.wpm)} WPM, ${signals.fillerRate.toFixed(1)} fillers/min, within budget`,
          ],
  };
}

/**
 * Confidence — deterministic baseline (LLM blends on top in score.ts).
 *
 * Signals: hedges, restarts, long pauses, stalls, final-quartile rush.
 * These capture the measurable components of perceived composure. The
 * LLM layer handles the semantic "did they sound confident" overlay.
 */
export function scoreConfidenceDeterministic(
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

  // ——— Long pause penalty ———————————————————————————
  const longPausePenalty = Math.min(15, signals.longPauseCount * 3);
  if (longPausePenalty > 0) {
    score -= longPausePenalty;
    reasons.push(
      `${signals.longPauseCount} long pause${signals.longPauseCount === 1 ? "" : "s"} > 1.5s`,
    );
  }

  // ——— Stall penalty — heavier, because stalls are visible ———
  const stallPenalty = Math.min(22, signals.stallCount * 7);
  if (stallPenalty > 0) {
    score -= stallPenalty;
    reasons.push(
      `${signals.stallCount} stall${signals.stallCount === 1 ? "" : "s"} > 3s`,
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
    dimension: "confidence",
    score: clamp(score),
    signals:
      reasons.length > 0
        ? reasons
        : ["Steady composure — clean recovery, no hedges, stable pacing"],
  };
}

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
