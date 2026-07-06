// PRD v3 Phase 4 — Lab Personalization Engine (PRD §8.4.5, §8.5.4, §6.6).
//
// The user chooses the APPLICATION; this module chooses the exercises.
// Selection weights toward the user's weakest hidden Application Skills
// (from the Communication Profile's per-application skill estimates),
// explores unmeasured skills before strong ones, spreads a session
// across DIFFERENT skills, and deprioritizes recently-used exercises —
// the same conventions as the Daily Workout's Hidden-Skill-aware pick
// (src/server/lib/workout/assignment.ts), so both engines "feel" like
// one coach.
//
// Pure function — callers supply profile estimates and recent-use data.
// Tested in tests/skill-lab-selection.test.ts.

import { seededShuffle } from "@/server/lib/workout/assignment";

export type LabExerciseCandidate = {
  id: string;
  /** Hidden Application Skill ids this exercise targets (may be null for
   *  rows seeded before enrichment). */
  applicationSkills: string[] | null;
};

export type LabSkillEstimates = Record<
  string,
  { score: number; sampleCount: number } | undefined
>;

export type LabSelectionInput = {
  candidates: LabExerciseCandidate[];
  /** Per-Application-Skill estimates from the Communication Profile
   *  (profile.applications[app].skills). Missing id = never measured. */
  skillEstimates: LabSkillEstimates;
  /** Exercises the user attempted recently (any attempt) — deprioritized,
   *  never hard-excluded: application catalogs are small. */
  recentExerciseIds: ReadonlySet<string>;
  count: number;
  seed: string;
};

export type LabSelectionPick = {
  id: string;
  /** The weakest estimated skill this exercise targets — the session's
   *  hidden training intent for this slot (logging/coaching context). */
  targetSkill: string | null;
};

/** Unmeasured skills count as slightly below the scale midpoint so new
 *  behaviors get explored before strong ones — matches the Daily
 *  Workout's UNMEASURED_SUB_SKILL_SCORE and PRD §6.6's baseline phase
 *  (all-unmeasured → uniform base → balanced seeded mix). */
const UNMEASURED_APP_SKILL_SCORE = 45;
const NO_METADATA_SCORE = 60;
const SKILL_OVERLAP_PENALTY = 15;
/** "Recently completed exercises should be deprioritized" (PRD §6.6) —
 *  a soft push, larger than one overlap but smaller than the gap between
 *  a weak (<40) and strong (>75) skill, so genuine weakness still wins
 *  over freshness. */
const RECENT_USE_PENALTY = 20;

function skillScore(
  estimates: LabSkillEstimates,
  skillId: string,
): number {
  const est = estimates[skillId];
  return est ? est.score : UNMEASURED_APP_SKILL_SCORE;
}

/** Pick `count` exercises for a Lab session. Returns exactly `count`
 *  picks whenever the catalog is non-empty — sessions longer than the
 *  catalog cycle through it again (same weakness-priority order), and
 *  the runner re-picks prompts so repeats stay fresh. */
export function selectLabExercises(
  input: LabSelectionInput,
): LabSelectionPick[] {
  const { candidates, skillEstimates, recentExerciseIds, count, seed } = input;
  if (candidates.length === 0 || count <= 0) return [];

  const shuffled = seededShuffle(candidates, seed);
  const covered = new Set<string>();
  const remaining = shuffled.slice();
  const basePicks: LabSelectionPick[] = [];

  while (remaining.length > 0 && basePicks.length < Math.min(count, shuffled.length)) {
    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const ex = remaining[i]!;
      let base = NO_METADATA_SCORE;
      if (ex.applicationSkills && ex.applicationSkills.length > 0) {
        base = Math.min(
          ...ex.applicationSkills.map((s) => skillScore(skillEstimates, s)),
        );
      }
      const overlap = ex.applicationSkills
        ? ex.applicationSkills.filter((s) => covered.has(s)).length
        : 0;
      const recent = recentExerciseIds.has(ex.id) ? RECENT_USE_PENALTY : 0;
      const total = base + overlap * SKILL_OVERLAP_PENALTY + recent;
      if (total < bestScore) {
        bestScore = total;
        bestIdx = i;
      }
    }
    const picked = remaining.splice(bestIdx, 1)[0]!;
    for (const s of picked.applicationSkills ?? []) covered.add(s);
    basePicks.push({
      id: picked.id,
      targetSkill: weakestTargetSkill(picked, skillEstimates),
    });
  }

  // Sessions longer than the catalog: cycle the weakness-priority order.
  const picks = basePicks.slice();
  while (picks.length < count) {
    picks.push(basePicks[picks.length % basePicks.length]!);
  }
  return picks;
}

function weakestTargetSkill(
  ex: LabExerciseCandidate,
  estimates: LabSkillEstimates,
): string | null {
  if (!ex.applicationSkills || ex.applicationSkills.length === 0) return null;
  let weakest: string | null = null;
  let weakestScore = Number.POSITIVE_INFINITY;
  for (const s of ex.applicationSkills) {
    const score = skillScore(estimates, s);
    if (score < weakestScore) {
      weakestScore = score;
      weakest = s;
    }
  }
  return weakest;
}
