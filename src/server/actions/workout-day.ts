"use server";

// Phase 3 — muscle-group day lifecycle server actions.
//
// - suggestTodaysMuscleGroup()  → which dim to train today + rationale
// - startMuscleGroupDay()        → idempotent per (user, day_date) insert
// - swapMuscleGroup()            → user override before any rep is logged
//
// All decision logic lives in src/server/lib/workout/assignment.ts; this
// file is the thin DB-fetching wrapper.

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  exercises,
  muscleGroupDays,
  reps,
  workoutSessions,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import {
  MUSCLE_GROUP_IDS,
  type MuscleGroupId,
  type Station,
} from "@/types/domain";
import {
  selectMuscleGroupForToday,
  sampleExercises,
  type CatalogExercise,
  type EngagementSnapshot,
  type RecentDaySnapshot,
  type RecentRepsSnapshot,
  type SelectResult,
} from "@/server/lib/workout/assignment";
import { createWorkoutSession } from "@/server/actions/sessions";

const REP_HISTORY_DAYS = 14;
const RECENT_DAY_LOOKBACK = 30; // enough to cover six dims × past few weeks

function todayISODateUTC(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function logEvent(event: string, payload: Record<string, unknown>): void {
  // Lightweight structured log; ops dashboards parse these. Existing
  // pattern across this codebase (cf. /ops/scoring telemetry queries).
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    }),
  );
}

// ─── World-state fetchers ────────────────────────────────────────────────

async function fetchEngagement(userId: string): Promise<EngagementSnapshot[]> {
  // Aggregate per-(user, exercise.dimension): row count, avg composite of
  // engagement.recent_composite, latest last_trained_at. Returns one row
  // per muscle group present.
  const rows = await db.execute<{
    dimension: string;
    avg_recent: number | null;
    last_trained: Date | null;
    row_count: number;
  }>(drizzleSql`
    SELECT
      e.dimension::text AS dimension,
      AVG(g.recent_composite)::real AS avg_recent,
      MAX(g.last_trained_at) AS last_trained,
      COUNT(g.*)::int AS row_count
    FROM cognify_v2.exercise_engagement g
    JOIN cognify_v2.exercises e ON e.id = g.exercise_id
    WHERE g.user_id = ${userId}
    GROUP BY e.dimension
  `);

  const byDim = new Map<MuscleGroupId, EngagementSnapshot>();
  for (const r of rows) {
    if (!isMuscleGroupId(r.dimension)) continue;
    byDim.set(r.dimension, {
      dimension: r.dimension,
      recentComposite: r.avg_recent,
      lastTrainedAt: r.last_trained ? r.last_trained.toISOString() : null,
      rowCount: r.row_count,
    });
  }
  // Fill in any missing dim with zero-row sentinel for cold-start detection.
  return MUSCLE_GROUP_IDS.map(
    (dim) =>
      byDim.get(dim) ?? {
        dimension: dim,
        recentComposite: null,
        lastTrainedAt: null,
        rowCount: 0,
      },
  );
}

async function fetchRecentRepsAggregates(
  userId: string,
): Promise<RecentRepsSnapshot[]> {
  const rows = await db.execute<{
    dimension: string;
    avg_14: number | null;
    avg_7: number | null;
    avg_prior_7: number | null;
    count_14: number;
  }>(drizzleSql`
    SELECT
      e.dimension::text AS dimension,
      AVG(r.composite_score) FILTER (
        WHERE r.created_at >= NOW() - INTERVAL '14 days'
      )::real AS avg_14,
      AVG(r.composite_score) FILTER (
        WHERE r.created_at >= NOW() - INTERVAL '7 days'
      )::real AS avg_7,
      AVG(r.composite_score) FILTER (
        WHERE r.created_at >= NOW() - INTERVAL '14 days'
          AND r.created_at < NOW() - INTERVAL '7 days'
      )::real AS avg_prior_7,
      COUNT(*) FILTER (
        WHERE r.created_at >= NOW() - INTERVAL '14 days'
      )::int AS count_14
    FROM cognify_v2.reps r
    JOIN cognify_v2.exercises e ON e.id = r.exercise_id
    WHERE r.user_id = ${userId}
      AND r.exercise_id IS NOT NULL
      AND r.created_at >= NOW() - (${REP_HISTORY_DAYS * 2} * INTERVAL '1 day')
    GROUP BY e.dimension
  `);

  const byDim = new Map<MuscleGroupId, RecentRepsSnapshot>();
  for (const r of rows) {
    if (!isMuscleGroupId(r.dimension)) continue;
    byDim.set(r.dimension, {
      dimension: r.dimension,
      avgComposite14d: r.avg_14,
      avgComposite7d: r.avg_7,
      avgCompositePrior7d: r.avg_prior_7,
      count14d: r.count_14,
    });
  }
  return MUSCLE_GROUP_IDS.map(
    (dim) =>
      byDim.get(dim) ?? {
        dimension: dim,
        avgComposite14d: null,
        avgComposite7d: null,
        avgCompositePrior7d: null,
        count14d: 0,
      },
  );
}

async function fetchRecentDays(userId: string): Promise<RecentDaySnapshot[]> {
  const rows = await db
    .select({
      id: muscleGroupDays.id,
      dimension: muscleGroupDays.dimension,
      dayDate: muscleGroupDays.dayDate,
      plannedExerciseIds: muscleGroupDays.plannedExerciseIds,
      compositeAtClose: muscleGroupDays.compositeAtClose,
    })
    .from(muscleGroupDays)
    .where(eq(muscleGroupDays.userId, userId))
    .orderBy(desc(muscleGroupDays.dayDate))
    .limit(RECENT_DAY_LOOKBACK);

  return rows
    .filter((r) => isMuscleGroupId(r.dimension as string))
    .map((r) => ({
      dayId: r.id,
      dimension: r.dimension as MuscleGroupId,
      dayDate: r.dayDate,
      plannedExerciseIds: Array.isArray(r.plannedExerciseIds)
        ? (r.plannedExerciseIds as string[])
        : [],
      compositeAtClose: r.compositeAtClose,
    }));
}

async function fetchCatalogExercises(
  dim: MuscleGroupId,
): Promise<CatalogExercise[]> {
  const rows = await db
    .select({
      id: exercises.id,
      slug: exercises.slug,
      name: exercises.name,
      dimension: exercises.dimension,
      description: exercises.description,
      instructions: exercises.instructions,
      sortOrder: exercises.sortOrder,
    })
    .from(exercises)
    .where(and(eq(exercises.dimension, dim), eq(exercises.isActive, true)));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    dimension: r.dimension as MuscleGroupId,
    description: r.description,
    instructions: r.instructions,
    sortOrder: r.sortOrder,
  }));
}

// ─── Public actions ──────────────────────────────────────────────────────

/**
 * Preview the 4 exercises that startMuscleGroupDay() would create today
 * for the given dim — without persisting anything. Uses the SAME seed
 * as the real action, so tapping Start lands on the identical 4
 * exercises the preview just showed.
 *
 * Used by the workout page to reveal "Today's Training" before the user
 * starts the workout.
 */
export async function previewTodaysWorkoutPlan(input: {
  dim: MuscleGroupId;
}): Promise<{ stations: Station[]; persisted: false }> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const dayDate = todayISODateUTC(new Date());

  return safeDb<{ stations: Station[]; persisted: false }>(async () => {
    const [available, recentDays] = await Promise.all([
      fetchCatalogExercises(input.dim),
      fetchRecentDays(userId),
    ]);
    const sampled = sampleExercises({
      available,
      recentDays,
      n: 4,
      seed: `${userId}:${dayDate}:${input.dim}`,
    });
    const stations: Station[] = sampled.map((ex, index) => ({
      index,
      exerciseId: ex.id,
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      rule: ex.description,
      why: ex.instructions,
    }));
    return { stations, persisted: false };
  }, { stations: [], persisted: false });
}

export type SuggestResult = SelectResult & {
  /** Latest matching muscle_group_day if one already exists for today. */
  existingDayId: string | null;
};

export async function suggestTodaysMuscleGroup(): Promise<SuggestResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const today = new Date();
  const dayDate = todayISODateUTC(today);

  const fallback: SuggestResult = {
    suggested: "clarity",
    alternates: ["structure", "conciseness"],
    rationale: "Clarity is the highest-leverage muscle — we'll start here.",
    rationaleCode: "cold_start",
    existingDayId: null,
  };

  return safeDb<SuggestResult>(async () => {
    // Already have a day for today? Echo that back as the suggestion.
    const [existing] = await db
      .select({
        id: muscleGroupDays.id,
        dimension: muscleGroupDays.dimension,
      })
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dayDate, dayDate),
        ),
      )
      .limit(1);

    if (existing && isMuscleGroupId(existing.dimension as string)) {
      return {
        suggested: existing.dimension as MuscleGroupId,
        alternates: pickStaticAlternates(existing.dimension as MuscleGroupId),
        rationale: "Today's muscle group is already in progress.",
        rationaleCode: "weakest_recent",
        existingDayId: existing.id,
      };
    }

    const [engagement, recentReps, recentDays] = await Promise.all([
      fetchEngagement(userId),
      fetchRecentRepsAggregates(userId),
      fetchRecentDays(userId),
    ]);

    const result = selectMuscleGroupForToday({
      today,
      engagement,
      recentReps,
      recentDays,
      seed: `${userId}:${dayDate}`,
    });

    if (result.rationaleCode === "cold_start") {
      logEvent("assignment.fallback.cold_start", { userId });
    }
    const hasSparseDim = engagement.some(
      (e) =>
        e.rowCount < 3 &&
        (recentReps.find((r) => r.dimension === e.dimension)?.count14d ?? 0) >
          0,
    );
    if (hasSparseDim) {
      logEvent("assignment.fallback.sparse_engagement", { userId });
    }
    logEvent("workout.assignment.suggested", {
      userId,
      dim: result.suggested,
      rationaleCode: result.rationaleCode,
      alternates: result.alternates,
    });

    return { ...result, existingDayId: null };
  }, fallback);
}

export type StartMuscleGroupDayResult = {
  dayId: string;
  dimension: MuscleGroupId;
  stations: Station[];
  /** workout_sessions.id for the active session. Used by Phase 6 to FK
   *  prompt_selection_events. NULL when the action falls back. */
  workoutSessionId: string | null;
  alreadyExisted: boolean;
  persisted: boolean;
};

export async function startMuscleGroupDay(input: {
  dim?: MuscleGroupId;
} = {}): Promise<StartMuscleGroupDayResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const today = new Date();
  const dayDate = todayISODateUTC(today);

  const fallback: StartMuscleGroupDayResult = {
    dayId: randomUUID(),
    dimension: input.dim ?? "clarity",
    stations: [],
    workoutSessionId: null,
    alreadyExisted: false,
    persisted: false,
  };

  return safeDb<StartMuscleGroupDayResult>(async () => {
    // Idempotency: a row already exists for (user, today) → return it.
    const [existing] = await db
      .select()
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dayDate, dayDate),
        ),
      )
      .limit(1);

    if (existing) {
      const plannedIds = (existing.plannedExerciseIds as string[]) ?? [];
      let stations = await hydrateStations(plannedIds);

      // Orphan-day self-heal: planned IDs point at exercises that no
      // longer exist (catalog re-seeded with fresh UUIDs while this
      // day was open). Re-sample 4 exercises in the same dim, update
      // the row in place, and continue. Safe because no reps can have
      // been logged against orphaned exercise IDs.
      if (plannedIds.length > 0 && stations.length === 0) {
        const existingDim = existing.dimension as MuscleGroupId;
        if (isMuscleGroupId(existingDim)) {
          const [available, recentDays] = await Promise.all([
            fetchCatalogExercises(existingDim),
            fetchRecentDays(userId),
          ]);
          const resampled = sampleExercises({
            available,
            recentDays,
            n: 4,
            seed: `${userId}:${dayDate}:${existingDim}:heal`,
          });
          if (resampled.length > 0) {
            const freshIds = resampled.map((s) => s.id);
            await db
              .update(muscleGroupDays)
              .set({ plannedExerciseIds: freshIds })
              .where(eq(muscleGroupDays.id, existing.id));
            stations = resampled.map((ex, index) => ({
              index,
              exerciseId: ex.id,
              exerciseSlug: ex.slug,
              exerciseName: ex.name,
              rule: ex.description,
              why: ex.instructions,
            }));
            logEvent("workout.day.self_healed", {
              userId,
              dayId: existing.id,
              dim: existingDim,
              fromIds: plannedIds,
              toIds: freshIds,
            });
          }
        }
      }

      // Reuse the most-recent workout_session for this day if one
      // exists; otherwise open a fresh one (handles resume on a new
      // device or after the session was abandoned mid-day).
      const [activeSession] = await db
        .select({ id: workoutSessions.id })
        .from(workoutSessions)
        .where(eq(workoutSessions.muscleGroupDayId, existing.id))
        .orderBy(desc(workoutSessions.createdAt))
        .limit(1);
      const sessionId =
        activeSession?.id ?? (await createWorkoutSession(existing.id))
          .workoutSessionId;
      return {
        dayId: existing.id,
        dimension: existing.dimension as MuscleGroupId,
        stations,
        workoutSessionId: sessionId,
        alreadyExisted: true,
        persisted: true,
      };
    }

    const chosenDim = input.dim ?? (await suggestTodaysMuscleGroup()).suggested;

    // Sample 4 exercises from the dim, deduped against recent days.
    const [available, recentDays] = await Promise.all([
      fetchCatalogExercises(chosenDim),
      fetchRecentDays(userId),
    ]);
    const sampled = sampleExercises({
      available,
      recentDays,
      n: 4,
      seed: `${userId}:${dayDate}:${chosenDim}`,
    });

    if (sampled.length === 0) {
      // No exercises in the catalog for this dim — defensive empty day.
      throw new Error(`No active exercises in catalog for dim=${chosenDim}`);
    }

    // Look up the user's most recent same-dim day (for previous_day_id).
    const [previousDay] = await db
      .select({ id: muscleGroupDays.id })
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dimension, chosenDim),
        ),
      )
      .orderBy(desc(muscleGroupDays.dayDate))
      .limit(1);

    const plannedIds = sampled.map((s) => s.id);

    const [inserted] = await db
      .insert(muscleGroupDays)
      .values({
        userId,
        dayDate,
        dimension: chosenDim,
        plannedExerciseIds: plannedIds,
        completedReps: 0,
        status: "planned",
        previousDayId: previousDay?.id ?? null,
      })
      .returning({ id: muscleGroupDays.id });

    const stations: Station[] = sampled.map((ex, index) => ({
      index,
      exerciseId: ex.id,
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      rule: ex.description,
      why: ex.instructions,
    }));

    // Open the workout_session for the new day so the rest of the
    // pipeline (prompt-selection events, rep recording state) has a
    // session id to FK against.
    const sessionResult = await createWorkoutSession(inserted!.id);

    logEvent("workout.day.started", {
      userId,
      dayId: inserted!.id,
      dim: chosenDim,
      exerciseIds: plannedIds,
      workoutSessionId: sessionResult.workoutSessionId,
    });

    return {
      dayId: inserted!.id,
      dimension: chosenDim,
      stations,
      workoutSessionId: sessionResult.workoutSessionId,
      alreadyExisted: false,
      persisted: true,
    };
  }, fallback);
}

export type SwapResult =
  | { ok: true; dayId: string; dimension: MuscleGroupId; stations: Station[] }
  | { ok: false; reason: "not_found" | "already_started" | "no_catalog" };

export async function swapMuscleGroup(input: {
  dayId: string;
  newDim: MuscleGroupId;
}): Promise<SwapResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  return safeDb<SwapResult>(async () => {
    const [day] = await db
      .select()
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.id, input.dayId),
          eq(muscleGroupDays.userId, userId),
        ),
      )
      .limit(1);
    if (!day) return { ok: false as const, reason: "not_found" };

    // Reject if any rep has already been logged for this day.
    const [repCount] = await db
      .select({ n: drizzleSql<number>`COUNT(*)::int` })
      .from(reps)
      .where(eq(reps.muscleGroupDayId, day.id));
    if ((repCount?.n ?? 0) > 0) {
      return { ok: false as const, reason: "already_started" };
    }

    const available = await fetchCatalogExercises(input.newDim);
    if (available.length === 0) {
      return { ok: false as const, reason: "no_catalog" };
    }
    const recentDays = await fetchRecentDays(userId);
    const sampled = sampleExercises({
      available,
      recentDays,
      n: 4,
      seed: `${userId}:${day.dayDate}:${input.newDim}:swap`,
    });

    const plannedIds = sampled.map((s) => s.id);
    await db
      .update(muscleGroupDays)
      .set({
        dimension: input.newDim,
        plannedExerciseIds: plannedIds,
      })
      .where(eq(muscleGroupDays.id, day.id));

    logEvent("workout.assignment.overridden", {
      userId,
      dayId: day.id,
      fromDim: day.dimension,
      toDim: input.newDim,
    });

    const stations: Station[] = sampled.map((ex, index) => ({
      index,
      exerciseId: ex.id,
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      rule: ex.description,
      why: ex.instructions,
    }));

    return {
      ok: true as const,
      dayId: day.id,
      dimension: input.newDim,
      stations,
    };
  }, { ok: false as const, reason: "not_found" });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

async function hydrateStations(exerciseIds: string[]): Promise<Station[]> {
  if (exerciseIds.length === 0) return [];
  const rows = await db
    .select({
      id: exercises.id,
      slug: exercises.slug,
      name: exercises.name,
      description: exercises.description,
      instructions: exercises.instructions,
    })
    .from(exercises)
    .where(drizzleSql`${exercises.id} = ANY(${exerciseIds}::uuid[])`);

  const byId = new Map(rows.map((r) => [r.id, r]));
  return exerciseIds
    .map((id, index) => {
      const row = byId.get(id);
      if (!row) return null;
      return {
        index,
        exerciseId: row.id,
        exerciseSlug: row.slug,
        exerciseName: row.name,
        rule: row.description,
        why: row.instructions,
      } satisfies Station;
    })
    .filter((s): s is Station => s !== null);
}

function isMuscleGroupId(s: string): s is MuscleGroupId {
  return (MUSCLE_GROUP_IDS as readonly string[]).includes(s);
}

function pickStaticAlternates(exclude: MuscleGroupId): MuscleGroupId[] {
  return MUSCLE_GROUP_IDS.filter((d) => d !== exclude).slice(0, 2);
}

// ─── Silence unused-import lints when downstream features land ───────────
void gte;
void isNull;
