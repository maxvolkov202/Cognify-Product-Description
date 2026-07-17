// System Change v2 Phase 2B.3 (D23) — pure planning logic for the
// catalog-backed lab sessions. Extracted from the planLabSession server
// action so the deterministic parts (dimension interleave, pressure-slot
// placement, exercise rotation, flow ramp) are unit-testable
// (tests/session-types.test.ts) — server actions stay thin.

import { canonicalizeSubSkillId, type SubSkillId } from "@/types/sub-skills";
import type { PressureArchetypeId } from "@/lib/ai/pressure-archetypes";
import type { LabCatalogExercise } from "@/lib/workout/lab-plan";
import type { SkillDimension } from "@/types/domain";

/** Server-side volume caps — planLabSession is a public server action;
 *  every slot costs sequential DB (and possibly LLM top-up) work. */
export const MAX_FOCUS_REPS = 10;
export const MAX_MIXED_REPS = 15;

export function clampFocusCount(count: number): number {
  return Math.max(1, Math.min(MAX_FOCUS_REPS, Math.floor(count) || 1));
}

/**
 * Round-robin interleave mixed-session dimensions so reps are spread,
 * not clumped per dim — the lobby copy promises "we interleave them so
 * you don't repeat the same skill back to back" (legacy planMixedSession
 * behavior). Total volume capped at MAX_MIXED_REPS.
 */
export function interleaveMixedDims(
  skillReps: { dimension: SkillDimension; reps: number }[],
): SkillDimension[] {
  const remaining = skillReps
    .map((sr) => ({
      dimension: sr.dimension,
      reps: Math.max(0, Math.floor(sr.reps) || 0),
    }))
    .filter((sr) => sr.reps > 0);
  const out: SkillDimension[] = [];
  while (out.length < MAX_MIXED_REPS) {
    let advanced = false;
    for (const sr of remaining) {
      if (sr.reps <= 0) continue;
      out.push(sr.dimension);
      sr.reps--;
      advanced = true;
      if (out.length >= MAX_MIXED_REPS) break;
    }
    if (!advanced) break;
  }
  return out;
}

/**
 * Pressure-slot placement (Build → Stress → Reinforce, WS-3): FOCUS
 * sessions of 4+ reps carry one pressure rep at index N-2, exactly like
 * the retired planFocusWorkout. Mixed sessions get NONE — the retired
 * planMixedSession was explicit ("Mixed is dimension-volume work, not
 * pressure") and the user configured every rep's dimension themselves.
 */
export function pressureIndexFor(
  style: "focus" | "mixed",
  slotCount: number,
): number {
  return style === "focus" && slotCount >= 4 ? slotCount - 2 : -1;
}

/** The flow ramp's designed archetype order (Direction.md): time pressure
 *  first, stakes last. */
export const FLOW_RAMP: readonly PressureArchetypeId[] = [
  "time_compression",
  "audience_switch",
  "pushback",
  "clarifying_interrupt",
  "stakes_raise",
];

/**
 * Archetype sequence for a pressure session: the design ramp order,
 * entered at a rotating start offset so consecutive short sessions (1-3
 * reps) don't replay the same intro archetype forever (legacy
 * planPressureSession behavior). 5+ rep sessions still cover the full
 * ramp regardless of start.
 */
export function pressureArchetypeSequence(
  count: number,
  startOffset: number,
): PressureArchetypeId[] {
  const start =
    ((Math.floor(startOffset) % FLOW_RAMP.length) + FLOW_RAMP.length) %
    FLOW_RAMP.length;
  return Array.from(
    { length: count },
    (_, i) => FLOW_RAMP[(start + i) % FLOW_RAMP.length]!,
  );
}

/**
 * Pick `count` exercises for a dimension, rotating without repeats until
 * the pool is exhausted. When `preferSubSkill` is set, exercises tagged
 * with that hidden skill lead the rotation (the "drill this sub-skill"
 * deep link). Skill ids are canonicalized on BOTH sides so pre-v2 ids in
 * unreseeded catalog rows still match. Returns `preferredMatched: false`
 * when the bias was requested but no exercise carries the skill — the
 * caller logs it (silent no-op was a Phase 2 review finding).
 *
 * Pure given `shuffleFn` — inject a seeded shuffle for deterministic
 * tests.
 */
export function rotateExercises(
  pool: LabCatalogExercise[],
  count: number,
  shuffleFn: <T>(arr: T[]) => T[],
  preferSubSkill?: SubSkillId,
  /** §8.5 content memory — exercises the user completed recently. They
   *  sort behind fresh material (never excluded: a small bank must
   *  still fill the session). */
  recentExerciseIds?: ReadonlySet<string>,
): { picks: LabCatalogExercise[]; preferredMatched: boolean } {
  if (pool.length === 0) return { picks: [], preferredMatched: false };
  const wanted = preferSubSkill ? canonicalizeSubSkillId(preferSubSkill) : null;
  const preferred = wanted
    ? pool.filter((e) =>
        (e.hiddenSkills ?? []).some(
          (id) => canonicalizeSubSkillId(id) === wanted,
        ),
      )
    : [];
  const preferredSet = new Set(preferred);
  const rest = pool.filter((e) => !preferredSet.has(e));
  const isRecent = (e: LabCatalogExercise) =>
    recentExerciseIds?.has(e.id) ?? false;
  const fresh = shuffleFn(rest.filter((e) => !isRecent(e)));
  const recent = shuffleFn(rest.filter(isRecent));
  // Preferred exercises keep priority even when recent (the weakness
  // bias is the stronger signal), but sort fresh-first within the tier.
  const preferredOrdered = [
    ...shuffleFn(preferred.filter((e) => !isRecent(e))),
    ...shuffleFn(preferred.filter(isRecent)),
  ];
  const ordered = [...preferredOrdered, ...fresh, ...recent];
  const picks: LabCatalogExercise[] = [];
  for (let i = 0; i < count; i++) picks.push(ordered[i % ordered.length]!);
  return {
    picks,
    preferredMatched: !preferSubSkill || preferred.length > 0,
  };
}
