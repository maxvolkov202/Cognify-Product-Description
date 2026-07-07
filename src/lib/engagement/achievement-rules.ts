/**
 * Cognify DNA Ch.9c — achievement rules engine.
 *
 * Invoked from saveRep after persistence. Inspects the user's full state
 * (just-saved rep + cumulative totals + streak + dimensions) and inserts
 * any newly satisfied achievements into user_achievements. Returns the
 * list of newly-unlocked Achievement ids so the client can fire toasts.
 *
 * Idempotent — uniqueness on (user_id, achievement_id) means double-fire
 * is silently absorbed by ON CONFLICT DO NOTHING.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userAchievements } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { ModeId, RepScore, SkillDimension } from "@/types/domain";
import { ALL_DIMENSIONS } from "@/lib/scoring/rubric";
import {
  ACHIEVEMENTS,
  type AchievementId,
  skill80AchievementId,
} from "./achievements";

export type EvaluateAchievementsInput = {
  userId: string;
  score: RepScore;
  mode: ModeId;
  /** Whether this rep was a focus drill (Skill Lab). */
  isFocusDrill?: boolean;
  /** Whether this rep was a pressure rep. */
  isPressureRep?: boolean;
  /** Whether this rep came from Build-a-Rep. */
  isBuildARep?: boolean;
  /** Total reps the user has completed including THIS rep. From
   *  users.lifetimeReps after awardXp's increment. */
  lifetimeReps: number;
  /** Current streak in days, computed by the streak system. */
  streakDays: number;
  /** Set of dimensions the user has scored at least once across history. */
  dimensionsEverScored?: ReadonlySet<SkillDimension>;
  /** PRD §10.12 — lifetime count of coaching_events rows with
   *  implemented_verdict='nailed' (Coach's Focus implemented on a retry).
   *  Caller supplies via one COUNT query; omitted → implement_* skipped. */
  implementedNailedCount?: number;
};

export async function evaluateAchievements(
  input: EvaluateAchievementsInput,
): Promise<AchievementId[]> {
  const candidateIds = collectCandidates(input);
  if (candidateIds.length === 0) return [];

  return safeDb<AchievementId[]>(async () => {
    // Use ON CONFLICT DO NOTHING + RETURNING to insert only the truly-new
    // ones in a single round-trip. db.execute returns the rows directly
    // when using postgres-js driver (no .rows wrapper).
    const rows = (await db.execute<{ achievement_id: string }>(sql`
      INSERT INTO cognify_v2.user_achievements (user_id, achievement_id)
      SELECT ${input.userId}::uuid, t.id FROM unnest(${sql`ARRAY[${sql.join(
        candidateIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[]`}) AS t(id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id
    `)) as unknown as Array<{ achievement_id: string }>;
    return rows.map((r) => r.achievement_id as AchievementId);
  }, []);
}

/** Pure function — given the rep + user state, list achievement ids the
 *  user QUALIFIES for. Doesn't dedupe against already-earned (DB does
 *  that via ON CONFLICT). Pure so it's unit-testable. */
function collectCandidates(input: EvaluateAchievementsInput): string[] {
  const out: string[] = [];
  const composite = input.score.composite;

  // ——— Volume
  if (input.lifetimeReps >= 1) out.push("vol_first_rep");
  if (input.lifetimeReps >= 10) out.push("vol_10_reps");
  if (input.lifetimeReps >= 50) out.push("vol_50_reps");
  if (input.lifetimeReps >= 100) out.push("vol_100_reps");
  if (input.lifetimeReps >= 250) out.push("vol_250_reps");
  if (input.lifetimeReps >= 1000) out.push("vol_1000_reps");

  // ——— Skill — first 80+ per dimension (this rep)
  for (const d of input.score.dimensions) {
    if (d.score >= 80) {
      out.push(skill80AchievementId(d.dimension));
    }
  }

  // ——— Skill — composite milestones
  if (composite >= 90) out.push("skill_90_composite");
  if (composite >= 95) out.push("skill_95_composite");

  // ——— Skill — implementation milestones (PRD §10.12)
  const nailed = input.implementedNailedCount ?? 0;
  if (nailed >= 5) out.push("implement_5");
  if (nailed >= 25) out.push("implement_25");
  if (nailed >= 100) out.push("implement_100");

  // ——— Streak
  if (input.streakDays >= 3) out.push("streak_3");
  if (input.streakDays >= 7) out.push("streak_7");
  if (input.streakDays >= 30) out.push("streak_30");
  if (input.streakDays >= 90) out.push("streak_90");
  if (input.streakDays >= 365) out.push("streak_365");

  // ——— Exploration
  if (input.isPressureRep) out.push("explore_pressure");
  if (input.isFocusDrill) out.push("explore_focus_drill");
  if (input.isBuildARep) out.push("explore_build_a_rep");

  // All-dims-scored: union of historical dims + this rep's dims.
  const everScored = new Set<SkillDimension>(
    input.dimensionsEverScored ?? [],
  );
  for (const d of input.score.dimensions) everScored.add(d.dimension);
  if (ALL_DIMENSIONS.every((d) => everScored.has(d))) {
    out.push("explore_all_dims");
  }

  // No-notes: 95+ on every dimension this rep.
  if (
    input.score.dimensions.length === ALL_DIMENSIONS.length &&
    input.score.dimensions.every((d) => d.score >= 95)
  ) {
    out.push("explore_first_perfect");
  }

  // Filter to known ids only — guard against typos.
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  return out.filter((id) => known.has(id));
}

/** Read the user's earned achievement ids — used by /achievements page. */
export async function getUserAchievements(
  userId: string,
): Promise<{ id: string; earnedAt: Date }[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: userAchievements.achievementId,
        earnedAt: userAchievements.earnedAt,
      })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
    return rows;
  }, []);
}

/** Read the set of dimensions the user has ever scored — needed by the
 *  rules engine for explore_all_dims. Caller passes into evaluate(). */
export async function getDimensionsEverScored(
  userId: string,
): Promise<Set<SkillDimension>> {
  return safeDb<Set<SkillDimension>>(async () => {
    const rows = (await db.execute<{ dimension: string }>(sql`
      SELECT DISTINCT d.dimension
      FROM cognify_v2.dimension_scores d
      JOIN cognify_v2.reps r ON r.id = d.rep_id
      WHERE r.user_id = ${userId}::uuid
    `)) as unknown as Array<{ dimension: string }>;
    const out = new Set<SkillDimension>();
    for (const r of rows) {
      out.add(r.dimension as SkillDimension);
    }
    // Eagerly apply Ch.1 alias (legacy 'adaptability' → current 'tone')
    if (out.has("adaptability" as SkillDimension)) {
      out.delete("adaptability" as SkillDimension);
      out.add("tone");
    }
    // Apply v1 'pacing'/'confidence' aliases for completeness, even though
    // achievement rules only care about the v3 names.
    return out;
  }, new Set<SkillDimension>());
}

/** Re-export for callers that want the type without importing the bank. */
export type { AchievementId };
