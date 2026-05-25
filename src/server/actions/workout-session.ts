"use server";

// Phase 7 — server-side persistence for the workout session state
// machine. The reducer in src/lib/workout/session-machine.ts decides
// transitions; these actions persist them so a refresh / new device
// resumes exactly where the user left off.

import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  muscleGroupDays,
  reps,
  workoutSessions,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import type { SessionPhase } from "@/lib/workout/types";

// ─── State persistence ───────────────────────────────────────────────────

export type UpdateWorkoutSessionStateInput = {
  workoutSessionId: string;
  state: SessionPhase;
  currentStationIndex: number;
  pausedAt?: Date | null;
  resumedAt?: Date | null;
};

export async function updateWorkoutSessionState(
  input: UpdateWorkoutSessionStateInput,
): Promise<{ persisted: boolean }> {
  return safeDb<{ persisted: boolean }>(async () => {
    await db
      .update(workoutSessions)
      .set({
        state: input.state,
        currentStationIndex: input.currentStationIndex,
        ...(input.pausedAt !== undefined ? { pausedAt: input.pausedAt } : {}),
        ...(input.resumedAt !== undefined
          ? { resumedAt: input.resumedAt }
          : {}),
      })
      .where(eq(workoutSessions.id, input.workoutSessionId));
    return { persisted: true };
  }, { persisted: false });
}

// ─── Resume snapshot ─────────────────────────────────────────────────────

export type ActiveWorkoutSessionSnapshot = {
  workoutSessionId: string;
  muscleGroupDayId: string;
  state: string;
  currentStationIndex: number;
  pausedAt: Date | null;
  resumedAt: Date | null;
} | null;

export async function getActiveWorkoutSession(): Promise<ActiveWorkoutSessionSnapshot> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  return safeDb<ActiveWorkoutSessionSnapshot>(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db
      .select({
        id: workoutSessions.id,
        muscleGroupDayId: workoutSessions.muscleGroupDayId,
        state: workoutSessions.state,
        currentStationIndex: workoutSessions.currentStationIndex,
        pausedAt: workoutSessions.pausedAt,
        resumedAt: workoutSessions.resumedAt,
      })
      .from(workoutSessions)
      .innerJoin(
        muscleGroupDays,
        eq(workoutSessions.muscleGroupDayId, muscleGroupDays.id),
      )
      .where(
        and(
          eq(workoutSessions.userId, userId),
          eq(muscleGroupDays.dayDate, today),
        ),
      )
      .orderBy(desc(workoutSessions.createdAt))
      .limit(1);

    if (!row) return null;
    return {
      workoutSessionId: row.id,
      muscleGroupDayId: row.muscleGroupDayId,
      state: row.state,
      currentStationIndex: row.currentStationIndex,
      pausedAt: row.pausedAt,
      resumedAt: row.resumedAt,
    };
  }, null);
}

// ─── Day close-out ───────────────────────────────────────────────────────

export type CompleteWorkoutDayInput = {
  workoutSessionId: string;
  muscleGroupDayId: string;
  composite: number | null;
};

export async function completeWorkoutSession(
  input: CompleteWorkoutDayInput,
): Promise<{ persisted: boolean }> {
  return safeDb<{ persisted: boolean }>(async () => {
    // 1. Mark the muscle_group_day complete with the final composite.
    await db
      .update(muscleGroupDays)
      .set({
        status: "complete",
        compositeAtClose: input.composite,
        completedAt: new Date(),
      })
      .where(eq(muscleGroupDays.id, input.muscleGroupDayId));

    // 2. Mark the workout_session at the closing state.
    await db
      .update(workoutSessions)
      .set({
        state: "day-complete",
        currentStationIndex: 4,
      })
      .where(eq(workoutSessions.id, input.workoutSessionId));

    return { persisted: true };
  }, { persisted: false });
}

// ─── Graduation rep ──────────────────────────────────────────────────────

export type RecordGraduationRepInput = {
  workoutSessionId: string;
  repId: string;
};

export async function recordGraduationRep(
  input: RecordGraduationRepInput,
): Promise<{ persisted: boolean }> {
  return safeDb<{ persisted: boolean }>(async () => {
    await db
      .update(reps)
      .set({ isGraduationRep: true })
      .where(eq(reps.id, input.repId));

    await db
      .update(workoutSessions)
      .set({ graduationRepId: input.repId })
      .where(eq(workoutSessions.id, input.workoutSessionId));

    return { persisted: true };
  }, { persisted: false });
}

// ─── Phase 9 — comparison fetcher for the day-complete retrospective ──

import {
  getDayRepsBreakdown,
  getMuscleGroupComparison,
  type DayRepBreakdown,
  type MuscleGroupComparison,
} from "@/lib/db/queries/muscle-group-progress";
import type { MuscleGroupId } from "@/types/domain";

export type FetchRetrospectiveResult = MuscleGroupComparison | null;

export async function fetchDayRetrospective(input: {
  dayId: string;
  dim: MuscleGroupId;
}): Promise<FetchRetrospectiveResult> {
  const user = await currentUser();
  if (!user?.id) return null;
  return getMuscleGroupComparison(user.id, input.dim, input.dayId);
}

/** HC-4 — end-of-day summary. Returns the prior-day comparison +
 *  the per-rep breakdown so the summary can render mini-bars + a
 *  per-dim trend line across the 4 (or 5 with graduation) reps. */
export type FetchDaySummaryResult = {
  comparison: MuscleGroupComparison | null;
  reps: DayRepBreakdown[];
} | null;

export async function fetchDaySummary(input: {
  dayId: string;
  dim: MuscleGroupId;
}): Promise<FetchDaySummaryResult> {
  const user = await currentUser();
  if (!user?.id) return null;
  const [comparison, repsBreakdown] = await Promise.all([
    getMuscleGroupComparison(user.id, input.dim, input.dayId),
    getDayRepsBreakdown(input.dayId),
  ]);
  return { comparison, reps: repsBreakdown };
}

// ─── Rep tagging on completion ───────────────────────────────────────────

/** When a rep is logged via the normal pipeline, the session runtime
 *  calls this to tag it with the muscle_group_day_id + exercise_id +
 *  station index. Keeps the existing rep-insert path untouched. */
export type TagWorkoutRepInput = {
  repId: string;
  muscleGroupDayId: string;
  /** May be null on degraded paths (rep insert raced / lost it). The
   *  function self-heals by looking up the day's planned_exercise_ids
   *  at the rep's station index — so engagement signal still lands. */
  exerciseId: string | null;
  scoreFailure: boolean;
};

export async function tagWorkoutRep(
  input: TagWorkoutRepInput,
): Promise<{ persisted: boolean }> {
  // CTO review B-2 — every rep in prod had exercise_id=NULL because
  // safeDb was swallowing failures silently. Layered fix: (a) try/catch
  // outside safeDb so we see structured logs, (b) self-heal exerciseId
  // by joining muscle_group_days when the caller passes null, (c) log
  // every invocation with inputs so we can grep tag_workout_rep.* in
  // prod and see whether the call site is even firing.
  console.log(
    JSON.stringify({
      event: "tag_workout_rep.invoked",
      ts: new Date().toISOString(),
      repId: input.repId,
      muscleGroupDayId: input.muscleGroupDayId,
      exerciseId: input.exerciseId,
      scoreFailure: input.scoreFailure,
    }),
  );

  try {
    const result = await safeDb<{ persisted: boolean }>(async () => {
      // Self-heal: if exerciseId is missing, recover it from the day's
      // planned list using the workout_sessions.current_station_index.
      // This makes the engagement upsert robust even if the client lost
      // the FK between insertPendingRep and the rep-complete dispatch.
      let resolvedExerciseId = input.exerciseId;
      if (!resolvedExerciseId) {
        const [healed] = await db.execute<{
          exercise_id: string | null;
        }>(drizzleSql`
          SELECT (mgd.planned_exercise_ids ->> ws.current_station_index)::text
                   AS exercise_id
          FROM cognify_v2.muscle_group_days mgd
          JOIN cognify_v2.workout_sessions ws
            ON ws.muscle_group_day_id = mgd.id
          WHERE mgd.id = ${input.muscleGroupDayId}
          ORDER BY ws.created_at DESC
          LIMIT 1
        `);
        resolvedExerciseId = healed?.exercise_id ?? null;
        console.warn(
          JSON.stringify({
            event: "tag_workout_rep.self_heal_exercise_id",
            ts: new Date().toISOString(),
            repId: input.repId,
            muscleGroupDayId: input.muscleGroupDayId,
            healedTo: resolvedExerciseId,
          }),
        );
      }

      await db
        .update(reps)
        .set({
          muscleGroupDayId: input.muscleGroupDayId,
          ...(resolvedExerciseId ? { exerciseId: resolvedExerciseId } : {}),
          scoreFailureFlag: input.scoreFailure,
        })
        .where(eq(reps.id, input.repId));

      // Increment completedReps on the day.
      await db.execute(drizzleSql`
        UPDATE cognify_v2.muscle_group_days
        SET completed_reps = completed_reps + 1
        WHERE id = ${input.muscleGroupDayId}
      `);

      // Skip engagement upsert if we still couldn't resolve an exerciseId.
      // The rep is tagged with the day, but engagement is exercise-keyed
      // so we can't write the row. Log loudly so the gap is debuggable.
      if (!resolvedExerciseId) {
        console.error(
          JSON.stringify({
            event: "tag_workout_rep.no_exercise_id",
            ts: new Date().toISOString(),
            repId: input.repId,
            muscleGroupDayId: input.muscleGroupDayId,
            note: "engagement upsert skipped — could not resolve exercise_id",
          }),
        );
        return { persisted: true };
      }

      // CTO review B-1 — score-failure reps must NOT pollute
      // avg_composite. Trace: prev avg=80, count=1, fail rep arrives
      // with composite_score=NULL → previous SQL folded in 0-score
      // sample → new avg=40. Anti-rotation signal got nuked by every
      // scoring hiccup. Fix: when recent_composite IS NULL, leave
      // avg_composite and completed_count unchanged.
      await db.execute(drizzleSql`
        INSERT INTO cognify_v2.exercise_engagement (
          exercise_id, user_id, shown_count, completed_count,
          avg_composite, recent_composite, last_trained_at, last_event_at
        )
        SELECT
          ${resolvedExerciseId}::uuid,
          r.user_id,
          0,
          CASE WHEN r.composite_score IS NULL THEN 0 ELSE 1 END,
          r.composite_score,
          r.composite_score,
          r.created_at,
          NOW()
        FROM cognify_v2.reps r
        WHERE r.id = ${input.repId}
        ON CONFLICT (exercise_id, user_id) DO UPDATE SET
          completed_count = cognify_v2.exercise_engagement.completed_count
            + CASE WHEN EXCLUDED.recent_composite IS NULL THEN 0 ELSE 1 END,
          avg_composite = CASE
            WHEN EXCLUDED.recent_composite IS NULL
              THEN cognify_v2.exercise_engagement.avg_composite
            ELSE (
              COALESCE(cognify_v2.exercise_engagement.avg_composite, 0)
                * cognify_v2.exercise_engagement.completed_count
              + EXCLUDED.recent_composite
            ) / NULLIF(cognify_v2.exercise_engagement.completed_count + 1, 0)
          END,
          recent_composite = COALESCE(
            EXCLUDED.recent_composite,
            cognify_v2.exercise_engagement.recent_composite
          ),
          last_trained_at = GREATEST(
            cognify_v2.exercise_engagement.last_trained_at,
            EXCLUDED.last_trained_at
          ),
          last_event_at = NOW()
      `);

      return { persisted: true };
    }, { persisted: false });

    if (!result.persisted) {
      console.warn(
        JSON.stringify({
          event: "tag_workout_rep.degraded",
          ts: new Date().toISOString(),
          repId: input.repId,
          muscleGroupDayId: input.muscleGroupDayId,
          exerciseId: input.exerciseId,
          note: "safeDb returned fallback — see prior error log for cause",
        }),
      );
    }
    return result;
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "tag_workout_rep.threw",
        ts: new Date().toISOString(),
        repId: input.repId,
        muscleGroupDayId: input.muscleGroupDayId,
        exerciseId: input.exerciseId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      }),
    );
    return { persisted: false };
  }
}
