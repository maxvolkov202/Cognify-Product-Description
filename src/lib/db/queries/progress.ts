import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  progressSnapshots,
  practiceSessions,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { SkillDimension } from "@/types/domain";
import { ALL_DIMENSIONS } from "@/lib/scoring/rubric";

export type SkillTrendPoint = { takenAt: Date; score: number };
export type SkillTrend = { dimension: SkillDimension; points: SkillTrendPoint[] };
export type DayActivity = { date: string; count: number; composite: number };
export type RecentRep = {
  id: string;
  promptText: string;
  compositeScore: number;
  createdAt: Date;
  durationMs: number;
  topic: string | null;
};

export async function getSkillTrends(
  userId: string,
  days = 30,
): Promise<SkillTrend[]> {
  return safeDb(async () => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        dimension: progressSnapshots.dimension,
        score: progressSnapshots.score,
        takenAt: progressSnapshots.takenAt,
      })
      .from(progressSnapshots)
      .where(
        and(
          eq(progressSnapshots.userId, userId),
          gte(progressSnapshots.takenAt, since),
        ),
      )
      .orderBy(progressSnapshots.takenAt);

    const byDim = new Map<SkillDimension, SkillTrendPoint[]>();
    for (const dim of ALL_DIMENSIONS) byDim.set(dim, []);
    for (const row of rows) {
      const dim = row.dimension as SkillDimension;
      const list = byDim.get(dim);
      if (list) list.push({ takenAt: row.takenAt, score: row.score });
    }

    return Array.from(byDim.entries()).map(([dimension, points]) => ({
      dimension,
      points,
    }));
  }, ALL_DIMENSIONS.map((d) => ({ dimension: d, points: [] })));
}

export async function getCurrentSkillScores(
  userId: string,
): Promise<Record<SkillDimension, number | null>> {
  return safeDb(async () => {
    const rows = await db
      .select({
        dimension: progressSnapshots.dimension,
        score: progressSnapshots.score,
      })
      .from(progressSnapshots)
      .where(eq(progressSnapshots.userId, userId))
      .orderBy(desc(progressSnapshots.takenAt))
      .limit(120);

    const latest = new Map<SkillDimension, number>();
    for (const row of rows) {
      const dim = row.dimension as SkillDimension;
      if (!latest.has(dim)) latest.set(dim, row.score);
    }

    const result = {} as Record<SkillDimension, number | null>;
    for (const dim of ALL_DIMENSIONS) result[dim] = latest.get(dim) ?? null;
    return result;
  }, Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, null])) as Record<SkillDimension, null>);
}

export async function getActivityHeatmap(
  userId: string,
  days = 90,
): Promise<DayActivity[]> {
  return safeDb(async () => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        date: sql<string>`to_char(${reps.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        composite: sql<number>`avg(${reps.compositeScore})::float`,
      })
      .from(reps)
      .where(and(eq(reps.userId, userId), gte(reps.createdAt, since)))
      .groupBy(sql`to_char(${reps.createdAt}, 'YYYY-MM-DD')`);

    return rows.map((r) => ({
      date: r.date,
      count: r.count,
      composite: r.composite ?? 0,
    }));
  }, []);
}

export async function getRepById(repId: string): Promise<RecentRep | null> {
  return safeDb(async () => {
    const row = await db.query.reps.findFirst({ where: eq(reps.id, repId) });
    if (!row) return null;
    return {
      id: row.id,
      promptText: row.promptText,
      compositeScore: row.compositeScore ?? 0,
      createdAt: row.createdAt,
      durationMs: row.durationMs,
      topic: row.topic,
    };
  }, null);
}

export async function getRecentReps(
  userId: string,
  limit = 10,
): Promise<RecentRep[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: reps.id,
        promptText: reps.promptText,
        compositeScore: reps.compositeScore,
        createdAt: reps.createdAt,
        durationMs: reps.durationMs,
        topic: reps.topic,
      })
      .from(reps)
      .where(eq(reps.userId, userId))
      .orderBy(desc(reps.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      promptText: r.promptText,
      compositeScore: r.compositeScore ?? 0,
      createdAt: r.createdAt,
      durationMs: r.durationMs,
      topic: r.topic,
    }));
  }, []);
}

export async function getStreakDays(userId: string): Promise<number> {
  return safeDb(async () => {
    const rows = await db
      .select({
        date: sql<string>`to_char(${reps.createdAt}, 'YYYY-MM-DD')`,
      })
      .from(reps)
      .where(eq(reps.userId, userId))
      .groupBy(sql`to_char(${reps.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(desc(sql`to_char(${reps.createdAt}, 'YYYY-MM-DD')`));

    if (rows.length === 0) return 0;
    const dates = rows.map((r) => r.date);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]!);
      const curr = new Date(dates[i]!);
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  }, 0);
}

/**
 * Get yesterday's average composite score for a user — used by the
 * end-of-workout summary's "+4 from yesterday" delta display.
 * Returns null if no reps exist for yesterday OR the database is down.
 */
export async function getYesterdayDailyAverage(
  userId: string,
): Promise<{ composite: number; repCount: number } | null> {
  return safeDb(async () => {
    const yStart = new Date();
    yStart.setDate(yStart.getDate() - 1);
    yStart.setHours(0, 0, 0, 0);
    const yEnd = new Date(yStart);
    yEnd.setHours(23, 59, 59, 999);

    const [row] = await db
      .select({
        avg: sql<number>`coalesce(avg(${reps.compositeScore}), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(reps)
      .where(
        and(
          eq(reps.userId, userId),
          gte(reps.createdAt, yStart),
          lte(reps.createdAt, yEnd),
        ),
      );

    if (!row || row.count === 0) return null;
    return { composite: row.avg, repCount: row.count };
  }, null);
}

/**
 * Return all reps for a user between two dates (inclusive). Used by the
 * Duolingo-style calendar strip's day-detail modal and the monthly report.
 */
export async function getRepsForDateRange(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<RecentRep[]> {
  return safeDb(async () => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const rows = await db
      .select({
        id: reps.id,
        promptText: reps.promptText,
        compositeScore: reps.compositeScore,
        createdAt: reps.createdAt,
        durationMs: reps.durationMs,
        topic: reps.topic,
      })
      .from(reps)
      .where(
        and(
          eq(reps.userId, userId),
          gte(reps.createdAt, start),
          lte(reps.createdAt, end),
        ),
      )
      .orderBy(desc(reps.createdAt));

    return rows.map((r) => ({
      id: r.id,
      promptText: r.promptText,
      compositeScore: r.compositeScore ?? 0,
      createdAt: r.createdAt,
      durationMs: r.durationMs,
      topic: r.topic,
    }));
  }, []);
}

export async function getRepsOnSameTopic(
  userId: string,
  topic: string,
): Promise<RecentRep[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: reps.id,
        promptText: reps.promptText,
        compositeScore: reps.compositeScore,
        createdAt: reps.createdAt,
        durationMs: reps.durationMs,
        topic: reps.topic,
      })
      .from(reps)
      .where(and(eq(reps.userId, userId), eq(reps.topic, topic)))
      .orderBy(reps.createdAt);

    return rows.map((r) => ({
      id: r.id,
      promptText: r.promptText,
      compositeScore: r.compositeScore ?? 0,
      createdAt: r.createdAt,
      durationMs: r.durationMs,
      topic: r.topic,
    }));
  }, []);
}
