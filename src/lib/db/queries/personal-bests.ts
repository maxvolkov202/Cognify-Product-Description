import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalBests } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { SkillDimension } from "@/types/domain";
import { ALL_DIMENSIONS } from "@/lib/scoring/rubric";

export type PersonalBest = {
  id: string;
  dimension: SkillDimension;
  score: number;
  repId: string;
  achievedAt: Date;
};

/**
 * Return the user's all-time best rep per dimension. Missing dimensions
 * resolve to null. Uses DISTINCT ON in Postgres for single-query latest
 * per-dimension retrieval.
 */
export async function getPersonalBests(
  userId: string,
): Promise<Partial<Record<SkillDimension, PersonalBest>>> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: personalBests.id,
        dimension: personalBests.dimension,
        score: personalBests.score,
        repId: personalBests.repId,
        achievedAt: personalBests.achievedAt,
      })
      .from(personalBests)
      .where(eq(personalBests.userId, userId))
      .orderBy(desc(personalBests.score), desc(personalBests.achievedAt));

    const out: Partial<Record<SkillDimension, PersonalBest>> = {};
    for (const row of rows) {
      const dim = row.dimension as SkillDimension;
      if (out[dim]) continue; // Keep the highest first-seen per dim.
      out[dim] = {
        id: row.id,
        dimension: dim,
        score: row.score,
        repId: row.repId,
        achievedAt: row.achievedAt,
      };
    }
    return out;
  }, {});
}

/**
 * Record new personal bests for a just-scored rep. Only inserts a PB
 * row when the new score strictly beats the user's current max for
 * that dimension.
 *
 * Returns the list of dimensions that set a new PB (can be empty). The
 * caller uses this to fire the PersonalBestToast — same signal the
 * in-session state already produced, but now durable across sessions.
 */
export async function recordPersonalBests(opts: {
  userId: string;
  repId: string;
  dimensionScores: { dimension: SkillDimension; score: number }[];
  /** Minimum score to qualify. Skips micro-PBs during first-few-reps
   *  noise (matches WorkoutSession's in-session threshold). */
  minimumScore?: number;
}): Promise<{ dimension: SkillDimension; score: number; previousMax: number | null }[]> {
  return safeDb(async () => {
    const { userId, repId, dimensionScores, minimumScore = 50 } = opts;
    if (dimensionScores.length === 0) return [];

    const rows = await db
      .select({
        dimension: personalBests.dimension,
        maxScore: sql<number>`MAX(${personalBests.score})`,
      })
      .from(personalBests)
      .where(eq(personalBests.userId, userId))
      .groupBy(personalBests.dimension);

    const currentMax = new Map<SkillDimension, number>();
    for (const r of rows) currentMax.set(r.dimension as SkillDimension, r.maxScore);

    const toInsert: {
      userId: string;
      repId: string;
      dimension: SkillDimension;
      score: number;
    }[] = [];
    const newBests: {
      dimension: SkillDimension;
      score: number;
      previousMax: number | null;
    }[] = [];
    for (const d of dimensionScores) {
      if (!ALL_DIMENSIONS.includes(d.dimension)) continue;
      if (d.score < minimumScore) continue;
      const prior = currentMax.get(d.dimension) ?? null;
      if (prior === null || d.score > prior) {
        toInsert.push({ userId, repId, dimension: d.dimension, score: d.score });
        newBests.push({
          dimension: d.dimension,
          score: d.score,
          previousMax: prior,
        });
      }
    }

    if (toInsert.length > 0) {
      await db.insert(personalBests).values(toInsert);
    }
    return newBests;
  }, []);
}

/**
 * Count how many PB rows exist for a user (aggregate, not per-dimension).
 * Used by the /report and /progress chrome to show a simple "3 PBs this
 * week" counter. `sinceIso` scopes to a time window when provided.
 */
export async function countPersonalBests(
  userId: string,
  sinceIso?: string,
): Promise<number> {
  return safeDb(async () => {
    const whereClauses = [eq(personalBests.userId, userId)];
    if (sinceIso) {
      whereClauses.push(sql`${personalBests.achievedAt} >= ${new Date(sinceIso)}`);
    }
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(personalBests)
      .where(and(...whereClauses));
    return row?.count ?? 0;
  }, 0);
}
