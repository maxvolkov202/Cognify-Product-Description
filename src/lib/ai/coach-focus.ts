// PRD v3 Phase 1 — Coach's Focus contract + retry-evaluation helpers.
//
// The PRD's Coach's Focus is "the single highest-impact improvement
// opportunity" (§4.5.2): exactly one per rep, tied to a Hidden Skill when
// available, and it becomes the objective of the required Retry. The
// scoring pipeline already emits the ingredients (primaryFocusDimension +
// nextRepFocus bullets); this module formalizes them into one persisted
// object so the retry flow, coaching_events ledger, and Phase 3 coaching
// memory all read the same shape.
//
// Pure functions only — tested in tests/coach-focus.test.ts.

import type { RepScore, SkillDimension } from "@/types/domain";

export type CoachFocus = {
  dimension: SkillDimension;
  /** Hidden Skill id (src/types/sub-skills.ts). Null when the focus is
   *  dimension-level only. */
  subSkill: string | null;
  /** The actionable focus line the user is asked to implement. */
  text: string;
};

export type ImplementationVerdict = "nailed" | "partial" | "missed";

/** The model's own implementation review, present only on retry-evaluated
 *  reps (schema-optional; see RETRY EVALUATION block in score.ts). */
export type ImplementationReview = {
  verdict: ImplementationVerdict;
  /** One sentence on HOW the implementation landed. */
  note: string;
};

/**
 * Derive the Coach's Focus a rep should carry forward from its score.
 * Prefers the nextRepFocus bullet matching primaryFocusDimension, then the
 * first nextRepFocus bullet, then a bare-dimension fallback. Null only
 * when the score has neither a focus dimension nor focus bullets
 * (mock-fallback reps).
 */
export function deriveCoachFocus(score: RepScore): CoachFocus | null {
  const bullets = score.nextRepFocus ?? [];
  const primary = score.primaryFocusDimension ?? bullets[0]?.dimension ?? null;
  if (!primary || primary === "structural_adherence") return null;

  const matching =
    bullets.find((b) => b.dimension === primary) ?? bullets[0] ?? null;
  if (matching) {
    return {
      dimension: matching.dimension as SkillDimension,
      subSkill: matching.subSkill ?? null,
      text: matching.text,
    };
  }
  return {
    dimension: primary,
    subSkill: null,
    text: `Improve ${primary.replace(/_/g, " ")} on your next attempt.`,
  };
}

/**
 * Deterministic implementation verdict from score movement on the focus
 * dimension. Fallback for when the model omits `implementationReview`
 * (and the ground truth for calibrating it later).
 *
 * Thresholds are deliberately generous per Owen C10 — score noise between
 * two takes of the same prompt is real, and a harsh "missed" on a flat
 * retry erodes trust in the loop.
 */
export function deriveImplementationVerdict(params: {
  focusDimension: SkillDimension;
  firstDimensions: { dimension: SkillDimension; score: number }[];
  retryDimensions: { dimension: SkillDimension; score: number }[];
}): ImplementationVerdict {
  const first = params.firstDimensions.find(
    (d) => d.dimension === params.focusDimension,
  );
  const retry = params.retryDimensions.find(
    (d) => d.dimension === params.focusDimension,
  );
  if (!first || !retry) return "partial";
  const delta = retry.score - first.score;
  if (delta >= 5) return "nailed";
  if (delta >= -2) return "partial";
  return "missed";
}

/**
 * Score-movement display rule (Owen C10): be liberal on negative movement.
 * A −2 reads as "focus next time"; a −12 reads as "this system is bogus".
 *
 * - delta >= 0            → show the number, celebrate proportionally.
 * - -3 <= delta < 0       → show the small number, neutral framing.
 * - delta < -3            → hide the number; soft copy instead.
 */
export function softenScoreDelta(delta: number): {
  showNumeric: boolean;
  tone: "celebrate" | "neutral" | "soft";
} {
  if (delta >= 1) return { showNumeric: true, tone: "celebrate" };
  if (delta >= -3) return { showNumeric: true, tone: "neutral" };
  return { showNumeric: false, tone: "soft" };
}
