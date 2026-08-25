/**
 * Per-skill score movement with the C10 softening rule.
 *
 * C10 (Owen, decision log): score movement is shown when it helps and
 * suppressed when it would only sting — zero movement is noise, and a drop
 * bigger than 3 points renders as the plain score with no delta so a rough
 * take doesn't read as punishment. Small dips (−1..−3) stay visible because
 * they're honest without being discouraging.
 *
 * Shared by the Improvement Review (first→retry movement) and the
 * first-attempt Core Skill Breakdown (movement vs the previous exercise in
 * the same session), so the two surfaces can never drift apart on the rule.
 */
export function visibleSkillDelta(
  current: number,
  previous: number | null | undefined,
): number | null {
  if (previous == null) return null;
  const delta = Math.round(current - previous);
  if (delta === 0 || delta < -3) return null;
  return delta;
}
