import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reps,
  progressSnapshots,
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

/**
 * Pressure rep stats over the last N days. Pressure reps are identified
 * by their topic prefix `Pressure · {archetype}` — WorkoutSession sets
 * this when saving pressure reps so historical analytics can filter
 * without a dedicated column.
 *
 * Returns the count, average composite, and a per-archetype breakdown
 * (if the topic encodes the archetype name, which it does).
 */
export type PressureRepStats = {
  count: number;
  avgComposite: number | null;
  byArchetype: {
    archetypeName: string;
    count: number;
    avgComposite: number;
  }[];
  /** The most recent N pressure reps with their composite for trend display. */
  recent: {
    archetypeName: string;
    composite: number;
    createdAt: Date;
  }[];
};

export async function getPressureRepStats(
  userId: string,
  days = 60,
): Promise<PressureRepStats> {
  return safeDb(async () => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        compositeScore: reps.compositeScore,
        createdAt: reps.createdAt,
        topic: reps.topic,
      })
      .from(reps)
      .where(
        and(
          eq(reps.userId, userId),
          gte(reps.createdAt, since),
          // Postgres LIKE for prefix match; drizzle exposes it via sql
          sql`${reps.topic} LIKE 'Pressure · %'`,
        ),
      )
      .orderBy(desc(reps.createdAt));

    if (rows.length === 0) {
      return { count: 0, avgComposite: null, byArchetype: [], recent: [] };
    }

    const parseArchetype = (topic: string | null): string =>
      topic?.replace(/^Pressure · /, "") ?? "Pressure";

    const sum = rows.reduce((s, r) => s + (r.compositeScore ?? 0), 0);
    const avgComposite = Math.round(sum / rows.length);

    const byArchetypeMap = new Map<
      string,
      { count: number; total: number }
    >();
    for (const r of rows) {
      const name = parseArchetype(r.topic);
      const entry = byArchetypeMap.get(name) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += r.compositeScore ?? 0;
      byArchetypeMap.set(name, entry);
    }
    const byArchetype = Array.from(byArchetypeMap.entries())
      .map(([archetypeName, { count, total }]) => ({
        archetypeName,
        count,
        avgComposite: Math.round(total / count),
      }))
      .sort((a, b) => b.avgComposite - a.avgComposite);

    const recent = rows.slice(0, 10).map((r) => ({
      archetypeName: parseArchetype(r.topic),
      composite: r.compositeScore ?? 0,
      createdAt: r.createdAt,
    }));

    return {
      count: rows.length,
      avgComposite,
      byArchetype,
      recent,
    };
  }, { count: 0, avgComposite: null, byArchetype: [], recent: [] });
}

/**
 * Build a WeeklyRepSummary for the current week (Monday → Sunday UTC)
 * plus per-dimension delta vs the prior week. Used by
 * generateWeeklyNarrative to produce the coaching paragraph on /progress.
 */
export async function getWeeklyRepSummary(
  userId: string,
): Promise<{
  weekStartISO: string;
  weekEndISO: string;
  repCount: number;
  averageComposite: number;
  dimensions: {
    dimension: SkillDimension;
    avg: number | null;
    delta: number | null;
  }[];
  bestArchetype: { name: string; avg: number } | null;
  weakestDimension: SkillDimension | null;
}> {
  return safeDb(async () => {
    // Monday-based week boundaries in UTC. Good enough for v1 — will
    // upgrade to user-locale boundaries when we have the timezone field.
    const now = new Date();
    const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

    const weekRepRows = await db
      .select({
        id: reps.id,
        composite: reps.compositeScore,
        topic: reps.topic,
      })
      .from(reps)
      .where(
        and(
          eq(reps.userId, userId),
          gte(reps.createdAt, weekStart),
          lte(reps.createdAt, weekEnd),
        ),
      );

    const repCount = weekRepRows.length;
    const averageComposite =
      repCount > 0
        ? Math.round(
            weekRepRows.reduce((s, r) => s + (r.composite ?? 0), 0) /
              repCount,
          )
        : 0;

    // Per-dimension avg over the week (via progressSnapshots)
    const weekDimRows = await db
      .select({
        dimension: progressSnapshots.dimension,
        score: progressSnapshots.score,
      })
      .from(progressSnapshots)
      .where(
        and(
          eq(progressSnapshots.userId, userId),
          gte(progressSnapshots.takenAt, weekStart),
          lte(progressSnapshots.takenAt, weekEnd),
        ),
      );
    const prevDimRows = await db
      .select({
        dimension: progressSnapshots.dimension,
        score: progressSnapshots.score,
      })
      .from(progressSnapshots)
      .where(
        and(
          eq(progressSnapshots.userId, userId),
          gte(progressSnapshots.takenAt, prevWeekStart),
          lte(progressSnapshots.takenAt, weekStart),
        ),
      );

    const weekAverage = (
      rows: { dimension: string; score: number }[],
    ): Partial<Record<SkillDimension, number>> => {
      const agg = new Map<SkillDimension, { sum: number; count: number }>();
      for (const r of rows) {
        const dim = r.dimension as SkillDimension;
        const entry = agg.get(dim) ?? { sum: 0, count: 0 };
        entry.sum += r.score;
        entry.count += 1;
        agg.set(dim, entry);
      }
      const out: Partial<Record<SkillDimension, number>> = {};
      for (const [dim, { sum, count }] of agg.entries()) {
        out[dim] = Math.round(sum / count);
      }
      return out;
    };

    const thisAvg = weekAverage(weekDimRows);
    const prevAvg = weekAverage(prevDimRows);

    const dimensions = ALL_DIMENSIONS.map((dim) => {
      const avg = thisAvg[dim] ?? null;
      const prev = prevAvg[dim];
      const delta =
        avg !== null && typeof prev === "number" ? avg - prev : null;
      return { dimension: dim, avg, delta };
    });

    const weakestDimension = dimensions
      .filter((d) => d.avg !== null)
      .sort((a, b) => (a.avg as number) - (b.avg as number))[0]?.dimension ?? null;

    // Best pressure archetype this week (parsed from topic)
    const pressureRows = weekRepRows.filter((r) =>
      r.topic?.startsWith("Pressure · "),
    );
    let bestArchetype: { name: string; avg: number } | null = null;
    if (pressureRows.length > 0) {
      const byArch = new Map<string, { sum: number; count: number }>();
      for (const r of pressureRows) {
        const name = r.topic!.replace(/^Pressure · /, "");
        const entry = byArch.get(name) ?? { sum: 0, count: 0 };
        entry.sum += r.composite ?? 0;
        entry.count += 1;
        byArch.set(name, entry);
      }
      const ranked = Array.from(byArch.entries())
        .map(([name, { sum, count }]) => ({ name, avg: Math.round(sum / count) }))
        .sort((a, b) => b.avg - a.avg);
      bestArchetype = ranked[0] ?? null;
    }

    return {
      weekStartISO: weekStart.toISOString().slice(0, 10),
      weekEndISO: new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10),
      repCount,
      averageComposite,
      dimensions,
      bestArchetype,
      weakestDimension,
    };
  }, {
    weekStartISO: "",
    weekEndISO: "",
    repCount: 0,
    averageComposite: 0,
    dimensions: ALL_DIMENSIONS.map((d) => ({
      dimension: d,
      avg: null,
      delta: null,
    })),
    bestArchetype: null,
    weakestDimension: null,
  });
}

/**
 * Returns the weakest dimension (lowest average) from the user's most
 * recent completed session — or null if they have no reps yet. Used
 * to bias `planTodaysWorkout`'s rep-type selection so tomorrow's
 * workout actually stresses yesterday's weak spot (Direction.md).
 *
 * Logic: pull the last N progressSnapshots rows, group by rep ID via
 * the takenAt timestamp, then use snapshots from the most recent rep.
 * If fewer than 3 dims were scored on that rep, fall back to the lowest
 * across the last N snapshots overall (more robust to partial failures).
 */
export async function getLastSessionWeakestDimension(
  userId: string,
): Promise<SkillDimension | null> {
  return safeDb(async () => {
    // Grab the last 12 snapshots (2 reps' worth of 6-dim each) and pick
    // the lowest score. Simpler than joining back to reps and handles
    // the common case well.
    const rows = await db
      .select({
        dimension: progressSnapshots.dimension,
        score: progressSnapshots.score,
      })
      .from(progressSnapshots)
      .where(eq(progressSnapshots.userId, userId))
      .orderBy(desc(progressSnapshots.takenAt))
      .limit(12);
    if (rows.length === 0) return null;
    let worst: { dimension: SkillDimension; score: number } | null = null;
    for (const r of rows) {
      const dim = r.dimension as SkillDimension;
      if (!ALL_DIMENSIONS.includes(dim)) continue;
      if (!worst || r.score < worst.score) {
        worst = { dimension: dim, score: r.score };
      }
    }
    return worst?.dimension ?? null;
  }, null);
}

/**
 * Per-dimension all-time max (personal bests). Used by the post-rep
 * toast to detect when a just-completed rep set a new PB. Returns an
 * object keyed by dimension name — dimensions with no history yet
 * resolve to `null`.
 */
export async function getUserDimensionMaxes(
  userId: string,
): Promise<Record<SkillDimension, number | null>> {
  return safeDb(async () => {
    const rows = await db
      .select({
        dimension: progressSnapshots.dimension,
        maxScore: sql<number>`MAX(${progressSnapshots.score})`,
      })
      .from(progressSnapshots)
      .where(eq(progressSnapshots.userId, userId))
      .groupBy(progressSnapshots.dimension);

    const result = {} as Record<SkillDimension, number | null>;
    for (const d of ALL_DIMENSIONS) result[d] = null;
    for (const row of rows) {
      const dim = row.dimension as SkillDimension;
      result[dim] = row.maxScore ?? null;
    }
    return result;
  }, ALL_DIMENSIONS.reduce(
    (acc, d) => {
      acc[d] = null;
      return acc;
    },
    {} as Record<SkillDimension, number | null>,
  ));
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
