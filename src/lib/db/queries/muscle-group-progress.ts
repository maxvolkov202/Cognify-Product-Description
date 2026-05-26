// Phase 9 — muscle-group progression queries.
//
// Three read-only queries powering the day-start banner, the
// end-of-day retrospective, and the /progress/muscle-groups timeline.
// All use safeDb so DB outages degrade gracefully (null / empty
// arrays) instead of throwing.

import { and, desc, eq, inArray, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  dimensionScores,
  exercises,
  muscleGroupDays,
  reps,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { MuscleGroupId } from "@/types/domain";

export type LastMuscleGroupDay = {
  lastDate: string;
  lastComposite: number | null;
  /** Average per-dim score across the 4 (+ optional graduation) reps of
   *  the prior day. NULL for the dim we're training; this is for the
   *  banner's "you scored X in this dim last time" pull. */
  lastDimAvg: number | null;
  daysSince: number;
};

export async function getLastMuscleGroupDay(
  userId: string,
  dim: MuscleGroupId,
): Promise<LastMuscleGroupDay | null> {
  return safeDb<LastMuscleGroupDay | null>(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db
      .select({
        dayDate: muscleGroupDays.dayDate,
        composite: muscleGroupDays.compositeAtClose,
      })
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dimension, dim),
          eq(muscleGroupDays.status, "complete"),
          drizzleSql`${muscleGroupDays.dayDate} < ${today}`,
        ),
      )
      .orderBy(desc(muscleGroupDays.dayDate))
      .limit(1);

    if (!row) return null;

    const last = new Date(row.dayDate + "T00:00:00Z");
    const now = new Date(today + "T00:00:00Z");
    const daysSince = Math.max(
      0,
      Math.round((now.getTime() - last.getTime()) / 86_400_000),
    );

    return {
      lastDate: row.dayDate,
      lastComposite: row.composite,
      // lastDimAvg is the user's avg composite in the same dim across
      // the reps of the prior day. We don't store it on the day row;
      // for the banner we just expose lastComposite (close enough).
      lastDimAvg: row.composite,
      daysSince,
    };
  }, null);
}

export type MuscleGroupTimelineRow = {
  dayId: string;
  dayDate: string;
  dimension: MuscleGroupId;
  composite: number | null;
  completedReps: number;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    repId: string | null;
    composite: number | null;
    /** True when this was the graduation rep. */
    isGraduationRep: boolean;
    /** Wall-clock duration of the rep, in ms. NULL when the rep wasn't
     *  saved (e.g., session abandoned mid-record). */
    durationMs: number | null;
  }>;
};

export async function getMuscleGroupTimeline(
  userId: string,
  dim: MuscleGroupId | null,
  limit = 60,
): Promise<MuscleGroupTimelineRow[]> {
  return safeDb<MuscleGroupTimelineRow[]>(async () => {
    // Fetch days the user has done in this dim (or all dims if null).
    const dayRows = dim
      ? await db
          .select()
          .from(muscleGroupDays)
          .where(
            and(
              eq(muscleGroupDays.userId, userId),
              eq(muscleGroupDays.dimension, dim),
            ),
          )
          .orderBy(desc(muscleGroupDays.dayDate))
          .limit(limit)
      : await db
          .select()
          .from(muscleGroupDays)
          .where(eq(muscleGroupDays.userId, userId))
          .orderBy(desc(muscleGroupDays.dayDate))
          .limit(limit);

    if (dayRows.length === 0) return [];

    // Pull all the reps linked to these days in one query.
    const dayIds = dayRows.map((d) => d.id);
    const repRows = await db
      .select({
        id: reps.id,
        muscleGroupDayId: reps.muscleGroupDayId,
        exerciseId: reps.exerciseId,
        composite: reps.compositeScore,
        durationMs: reps.durationMs,
        isGraduationRep: reps.isGraduationRep,
      })
      .from(reps)
      .where(inArray(reps.muscleGroupDayId, dayIds));

    // Pull exercise names in one query.
    const exerciseIds = Array.from(
      new Set(repRows.map((r) => r.exerciseId).filter((id): id is string => !!id)),
    );
    const exerciseRows = exerciseIds.length
      ? await db
          .select({
            id: exercises.id,
            name: exercises.name,
          })
          .from(exercises)
          .where(inArray(exercises.id, exerciseIds))
      : [];
    const exNameById = new Map(exerciseRows.map((r) => [r.id, r.name]));

    const repsByDay = new Map<string, typeof repRows>();
    for (const r of repRows) {
      if (!r.muscleGroupDayId) continue;
      if (!repsByDay.has(r.muscleGroupDayId)) {
        repsByDay.set(r.muscleGroupDayId, []);
      }
      repsByDay.get(r.muscleGroupDayId)!.push(r);
    }

    return dayRows.map((day) => {
      const dayReps = repsByDay.get(day.id) ?? [];
      const planned = Array.isArray(day.plannedExerciseIds)
        ? (day.plannedExerciseIds as string[])
        : [];
      // Order reps by the day's planned exercise order, then append
      // graduation reps at the end.
      const ordered = planned
        .map((exerciseId) => {
          const rep = dayReps.find(
            (r) => r.exerciseId === exerciseId && !r.isGraduationRep,
          );
          return {
            exerciseId,
            exerciseName: exNameById.get(exerciseId) ?? "Exercise",
            repId: rep?.id ?? null,
            composite: rep?.composite ?? null,
            isGraduationRep: false,
            durationMs: rep?.durationMs ?? null,
          };
        })
        .concat(
          dayReps
            .filter((r) => r.isGraduationRep)
            .map((r) => ({
              exerciseId: r.exerciseId ?? "graduation",
              exerciseName:
                (r.exerciseId && exNameById.get(r.exerciseId)) ||
                "Graduation rep",
              repId: r.id,
              composite: r.composite,
              isGraduationRep: true,
              durationMs: r.durationMs,
            })),
        );
      return {
        dayId: day.id,
        dayDate: day.dayDate,
        dimension: day.dimension as MuscleGroupId,
        composite: day.compositeAtClose,
        completedReps: day.completedReps,
        exercises: ordered,
      };
    });
  }, []);
}

/**
 * HC-4 — per-rep breakdown for the end-of-day summary. Returns each
 * rep on the day with its composite + per-dim scores in chronological
 * order (rep 1 → rep 4 + optional graduation rep).
 */
export type DayRepBreakdown = {
  repId: string;
  repIndex: number; // chronological 0..N-1
  composite: number;
  perDim: Partial<Record<string, number>>;
  isGraduationRep: boolean;
};

export async function getDayRepsBreakdown(
  dayId: string,
): Promise<DayRepBreakdown[]> {
  return safeDb<DayRepBreakdown[]>(async () => {
    const repRows = await db
      .select({
        id: reps.id,
        composite: reps.compositeScore,
        createdAt: reps.createdAt,
        isGraduationRep: reps.isGraduationRep,
      })
      .from(reps)
      .where(eq(reps.muscleGroupDayId, dayId))
      .orderBy(reps.createdAt);
    if (repRows.length === 0) return [];

    const repIds = repRows.map((r) => r.id);
    const dimRows = await db
      .select({
        repId: dimensionScores.repId,
        dimension: dimensionScores.dimension,
        score: dimensionScores.score,
      })
      .from(dimensionScores)
      .where(inArray(dimensionScores.repId, repIds));

    const dimsByRep = new Map<string, Partial<Record<string, number>>>();
    for (const r of dimRows) {
      if (!dimsByRep.has(r.repId)) dimsByRep.set(r.repId, {});
      dimsByRep.get(r.repId)![r.dimension] = r.score;
    }

    return repRows.map((r, i) => ({
      repId: r.id,
      repIndex: i,
      composite: Math.round(r.composite ?? 0),
      perDim: dimsByRep.get(r.id) ?? {},
      isGraduationRep: r.isGraduationRep ?? false,
    }));
  }, []);
}

export type MuscleGroupComparison = {
  todayComposite: number | null;
  todayPerDim: Partial<Record<string, number>>;
  lastComposite: number | null;
  lastPerDim: Partial<Record<string, number>>;
  deltaComposite: number | null;
  deltaPerDim: Partial<Record<string, number>>;
  daysSince: number | null;
};

export async function getMuscleGroupComparison(
  userId: string,
  dim: MuscleGroupId,
  currentDayId: string,
): Promise<MuscleGroupComparison | null> {
  return safeDb<MuscleGroupComparison | null>(async () => {
    const [currentDay] = await db
      .select({
        id: muscleGroupDays.id,
        dayDate: muscleGroupDays.dayDate,
        composite: muscleGroupDays.compositeAtClose,
      })
      .from(muscleGroupDays)
      .where(eq(muscleGroupDays.id, currentDayId))
      .limit(1);
    if (!currentDay) return null;

    const [previousDay] = await db
      .select({
        id: muscleGroupDays.id,
        dayDate: muscleGroupDays.dayDate,
        composite: muscleGroupDays.compositeAtClose,
      })
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dimension, dim),
          drizzleSql`${muscleGroupDays.dayDate} < ${currentDay.dayDate}`,
          eq(muscleGroupDays.status, "complete"),
        ),
      )
      .orderBy(desc(muscleGroupDays.dayDate))
      .limit(1);

    // Per-dim aggregates from the reps of each day.
    async function dimAvgsFor(dayId: string) {
      const rows = await db.execute<{
        dimension: string;
        avg_score: number | null;
      }>(drizzleSql`
        SELECT ds.dimension::text AS dimension,
               AVG(ds.score)::real AS avg_score
        FROM cognify_v2.dimension_scores ds
        JOIN cognify_v2.reps r ON r.id = ds.rep_id
        WHERE r.muscle_group_day_id = ${dayId}::uuid
        GROUP BY ds.dimension
      `);
      const out: Partial<Record<string, number>> = {};
      for (const r of rows) {
        if (r.avg_score != null) out[r.dimension] = r.avg_score;
      }
      return out;
    }

    // Two independent SELECTs — parallelize (audit IN-2). Previously
    // serial waits made the day-complete summary's perceived latency
    // ~2x the underlying SQL cost.
    const [todayPerDim, lastPerDim] = await Promise.all([
      dimAvgsFor(currentDay.id),
      previousDay
        ? dimAvgsFor(previousDay.id)
        : Promise.resolve({} as Partial<Record<string, number>>),
    ]);
    const deltaPerDim: Partial<Record<string, number>> = {};
    for (const d of Object.keys(todayPerDim)) {
      if (lastPerDim[d] != null) {
        deltaPerDim[d] = (todayPerDim[d] ?? 0) - (lastPerDim[d] ?? 0);
      }
    }

    const today = new Date(currentDay.dayDate + "T00:00:00Z");
    const last = previousDay
      ? new Date(previousDay.dayDate + "T00:00:00Z")
      : null;
    const daysSince = last
      ? Math.max(0, Math.round((today.getTime() - last.getTime()) / 86_400_000))
      : null;

    return {
      todayComposite: currentDay.composite,
      todayPerDim,
      lastComposite: previousDay?.composite ?? null,
      lastPerDim,
      deltaComposite:
        currentDay.composite != null && previousDay?.composite != null
          ? currentDay.composite - previousDay.composite
          : null,
      deltaPerDim,
      daysSince,
    };
  }, null);
}
