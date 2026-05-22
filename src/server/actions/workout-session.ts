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
  exerciseId: string;
  scoreFailure: boolean;
};

export async function tagWorkoutRep(
  input: TagWorkoutRepInput,
): Promise<{ persisted: boolean }> {
  return safeDb<{ persisted: boolean }>(async () => {
    await db
      .update(reps)
      .set({
        muscleGroupDayId: input.muscleGroupDayId,
        exerciseId: input.exerciseId,
        scoreFailureFlag: input.scoreFailure,
      })
      .where(eq(reps.id, input.repId));

    // Increment completedReps on the day.
    await db.execute(drizzleSql`
      UPDATE cognify_v2.muscle_group_days
      SET completed_reps = completed_reps + 1
      WHERE id = ${input.muscleGroupDayId}
    `);

    return { persisted: true };
  }, { persisted: false });
}
