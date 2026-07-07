"use server";

// Phase 7 — server-side persistence for the workout session state
// machine. The reducer in src/lib/workout/session-machine.ts decides
// transitions; these actions persist them so a refresh / new device
// resumes exactly where the user left off.

import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  muscleGroupDays,
  reps,
  users,
  workoutSessions,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { SessionPhaseSchema, type SessionPhase } from "@/lib/workout/types";
import { log, serializeErr } from "@/lib/log";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";

// ─── Auth/ownership helpers ──────────────────────────────────────────────

class OwnershipError extends Error {
  constructor(public reason: "unauthenticated" | "not_found" | "forbidden") {
    super(reason);
  }
}

async function assertUser(): Promise<{ id: string }> {
  const user = await currentUser();
  if (!user) throw new OwnershipError("unauthenticated");
  return { id: user.id };
}

async function assertOwnsSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  const [row] = await db
    .select({ userId: workoutSessions.userId })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);
  if (!row) throw new OwnershipError("not_found");
  if (row.userId !== userId) throw new OwnershipError("forbidden");
}

async function assertOwnsDay(dayId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: muscleGroupDays.userId })
    .from(muscleGroupDays)
    .where(eq(muscleGroupDays.id, dayId))
    .limit(1);
  if (!row) throw new OwnershipError("not_found");
  if (row.userId !== userId) throw new OwnershipError("forbidden");
}

async function assertOwnsRep(repId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: reps.userId })
    .from(reps)
    .where(eq(reps.id, repId))
    .limit(1);
  if (!row) throw new OwnershipError("not_found");
  if (row.userId !== userId) throw new OwnershipError("forbidden");
}

// ─── Input schemas ───────────────────────────────────────────────────────

const updateStateSchema = z.object({
  workoutSessionId: z.string().uuid(),
  state: SessionPhaseSchema,
  currentStationIndex: z.number().int().min(0).max(20),
  pausedAt: z.date().nullable().optional(),
  resumedAt: z.date().nullable().optional(),
});

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
  try {
    const user = await assertUser();
    const validated = updateStateSchema.parse(input);
    await assertOwnsSession(validated.workoutSessionId, user.id);
    return safeDb<{ persisted: boolean }>(async () => {
      await db
        .update(workoutSessions)
        .set({
          state: validated.state,
          currentStationIndex: validated.currentStationIndex,
          ...(validated.pausedAt !== undefined
            ? { pausedAt: validated.pausedAt }
            : {}),
          ...(validated.resumedAt !== undefined
            ? { resumedAt: validated.resumedAt }
            : {}),
        })
        .where(eq(workoutSessions.id, validated.workoutSessionId));
      return { persisted: true };
    }, { persisted: false });
  } catch (err) {
    // Ownership / validation failures degrade quietly to non-persistence.
    // The client treats { persisted: false } as a hint to refetch — same
    // shape as a DB outage.
    if (err instanceof OwnershipError || err instanceof z.ZodError) {
      log.warn({
        event: "workout_session.update_state.rejected",
        reason: err instanceof OwnershipError ? err.reason : "invalid_input",
      });
      return { persisted: false };
    }
    throw err;
  }
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

const completeSchema = z.object({
  workoutSessionId: z.string().uuid(),
  muscleGroupDayId: z.string().uuid(),
  composite: z.number().min(0).max(100).nullable(),
});

export async function completeWorkoutSession(
  input: CompleteWorkoutDayInput,
): Promise<{ persisted: boolean }> {
  try {
    const user = await assertUser();
    const validated = completeSchema.parse(input);
    await Promise.all([
      assertOwnsSession(validated.workoutSessionId, user.id),
      assertOwnsDay(validated.muscleGroupDayId, user.id),
    ]);
    return safeDb<{ persisted: boolean }>(async () => {
      await db
        .update(muscleGroupDays)
        .set({
          status: "complete",
          compositeAtClose: validated.composite,
          completedAt: new Date(),
        })
        .where(eq(muscleGroupDays.id, validated.muscleGroupDayId));

      await db
        .update(workoutSessions)
        .set({
          state: "day-complete",
          currentStationIndex: 4,
        })
        .where(eq(workoutSessions.id, validated.workoutSessionId));

      return { persisted: true };
    }, { persisted: false });
  } catch (err) {
    if (err instanceof OwnershipError || err instanceof z.ZodError) {
      log.warn({
        event: "workout_session.complete.rejected",
        reason: err instanceof OwnershipError ? err.reason : "invalid_input",
      });
      return { persisted: false };
    }
    throw err;
  }
}

// ─── Graduation rep ──────────────────────────────────────────────────────

export type RecordGraduationRepInput = {
  workoutSessionId: string;
  repId: string;
};

const graduationSchema = z.object({
  workoutSessionId: z.string().uuid(),
  repId: z.string().uuid(),
});

export async function recordGraduationRep(
  input: RecordGraduationRepInput,
): Promise<{ persisted: boolean }> {
  try {
    const user = await assertUser();
    const validated = graduationSchema.parse(input);
    await Promise.all([
      assertOwnsSession(validated.workoutSessionId, user.id),
      assertOwnsRep(validated.repId, user.id),
    ]);
    return safeDb<{ persisted: boolean }>(async () => {
      await db
        .update(reps)
        .set({ isGraduationRep: true })
        .where(eq(reps.id, validated.repId));

      await db
        .update(workoutSessions)
        .set({ graduationRepId: validated.repId })
        .where(eq(workoutSessions.id, validated.workoutSessionId));

      return { persisted: true };
    }, { persisted: false });
  } catch (err) {
    if (err instanceof OwnershipError || err instanceof z.ZodError) {
      log.warn({
        event: "workout_session.graduation.rejected",
        reason: err instanceof OwnershipError ? err.reason : "invalid_input",
      });
      return { persisted: false };
    }
    throw err;
  }
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
 *  per-dim trend line across the 4 (or 5 with graduation) reps.
 *  PRD v3 Phase 2.7 adds the progression stats the celebratory
 *  Workout Complete screen shows (C16/C17): all-time reps, streak. */
export type FetchDaySummaryResult = {
  comparison: MuscleGroupComparison | null;
  reps: DayRepBreakdown[];
  /** users.lifetime_reps AFTER today's session (C17). Null if lookup failed. */
  lifetimeReps: number | null;
  streakDays: number | null;
} | null;

export async function fetchDaySummary(input: {
  dayId: string;
  dim: MuscleGroupId;
}): Promise<FetchDaySummaryResult> {
  const user = await currentUser();
  if (!user?.id) return null;
  const [comparison, repsBreakdown, userRow, streak] = await Promise.all([
    getMuscleGroupComparison(user.id, input.dim, input.dayId),
    getDayRepsBreakdown(input.dayId),
    safeDb(async () => {
      const [u] = await db
        .select({ lifetimeReps: users.lifetimeReps })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      return u ?? null;
    }, null),
    getStreakStatus(user.id),
  ]);
  return {
    comparison,
    reps: repsBreakdown,
    lifetimeReps: userRow?.lifetimeReps ?? null,
    streakDays: streak?.streakDays ?? null,
  };
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
  /** PRD v3 engine — attempt position in the exercise loop. Retry/again
   *  attempts are tagged + counted for engagement, but do NOT increment
   *  the day's completed_reps: the day target counts EXERCISES, and the
   *  exercise already counted when its First Rep landed. Omitted →
   *  "first" (legacy callers). */
  attemptKind?: "first" | "retry" | "again";
};

const tagWorkoutRepSchema = z.object({
  repId: z.string().uuid(),
  muscleGroupDayId: z.string().uuid(),
  exerciseId: z.string().uuid().nullable(),
  scoreFailure: z.boolean(),
  attemptKind: z.enum(["first", "retry", "again"]).optional(),
});

export async function tagWorkoutRep(
  input: TagWorkoutRepInput,
): Promise<{ persisted: boolean }> {
  // Auth + ownership: the rep must belong to the caller. Without this
  // any logged-in user could tag another user's rep with a different
  // exercise + day, polluting their engagement signal.
  try {
    const user = await assertUser();
    tagWorkoutRepSchema.parse(input);
    await Promise.all([
      assertOwnsRep(input.repId, user.id),
      assertOwnsDay(input.muscleGroupDayId, user.id),
    ]);
  } catch (err) {
    if (err instanceof OwnershipError || err instanceof z.ZodError) {
      log.warn({
        event: "tag_workout_rep.rejected",
        reason: err instanceof OwnershipError ? err.reason : "invalid_input",
        repId: input.repId,
      });
      return { persisted: false };
    }
    throw err;
  }

  // CTO review B-2 — every rep in prod had exercise_id=NULL because
  // safeDb was swallowing failures silently. Layered fix: (a) try/catch
  // outside safeDb so we see structured logs, (b) self-heal exerciseId
  // by joining muscle_group_days when the caller passes null, (c) log
  // every invocation with inputs so we can grep tag_workout_rep.* in
  // prod and see whether the call site is even firing.
  log.info({
    event: "tag_workout_rep.invoked",
    repId: input.repId,
    muscleGroupDayId: input.muscleGroupDayId,
    exerciseId: input.exerciseId,
    scoreFailure: input.scoreFailure,
  });

  try {
    const result = await safeDb<{ persisted: boolean }>(async () => {
      // Wrap the three writes in a transaction so a mid-flight failure
      // doesn't leave completed_reps incremented without the engagement
      // upsert (which would let a client retry double-count the counter).
      return await db.transaction(async (tx) => {
        // Self-heal: if exerciseId is missing, recover it from the day's
        // planned list using the workout_sessions.current_station_index.
        let resolvedExerciseId = input.exerciseId;
        if (!resolvedExerciseId) {
          const [healed] = await tx.execute<{
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
          log.warn({
            event: "tag_workout_rep.self_heal_exercise_id",
            repId: input.repId,
            muscleGroupDayId: input.muscleGroupDayId,
            healedTo: resolvedExerciseId,
          });
        }

        await tx
          .update(reps)
          .set({
            muscleGroupDayId: input.muscleGroupDayId,
            ...(resolvedExerciseId ? { exerciseId: resolvedExerciseId } : {}),
            scoreFailureFlag: input.scoreFailure,
          })
          .where(eq(reps.id, input.repId));

        // Recount completedReps on the day — FIRST attempts only, one per
        // DISTINCT exercise. The old `+= 1` double-counted whenever a
        // station's first rep was re-recorded (leave mid-loop → resume →
        // fresh first attempt), so interrupted days "completed" with
        // exercises skipped (Phase 12 F-7). Recounting inside the same
        // tx (the rep row above already carries day+exercise ids) is
        // idempotent under resumes and replays. Graduation reps are
        // bonus reps — they never advance the day target.
        const isRetryAttempt =
          input.attemptKind === "retry" || input.attemptKind === "again";
        if (!isRetryAttempt) {
          if (resolvedExerciseId) {
            await tx.execute(drizzleSql`
              UPDATE cognify_v2.muscle_group_days
              SET completed_reps = (
                SELECT COUNT(DISTINCT r.exercise_id)::int
                FROM cognify_v2.reps r
                WHERE r.muscle_group_day_id = ${input.muscleGroupDayId}
                  AND r.attempt_kind = 'first'
                  AND r.is_graduation_rep = false
                  AND r.exercise_id IS NOT NULL
              )
              WHERE id = ${input.muscleGroupDayId}
            `);
          } else {
            // Degraded path (exercise unresolved): keep the legacy
            // increment rather than dropping the rep from the count.
            await tx.execute(drizzleSql`
              UPDATE cognify_v2.muscle_group_days
              SET completed_reps = completed_reps + 1
              WHERE id = ${input.muscleGroupDayId}
            `);
          }
        }

        // Skip engagement upsert if we still couldn't resolve an exerciseId.
        if (!resolvedExerciseId) {
          log.error({
            event: "tag_workout_rep.no_exercise_id",
            repId: input.repId,
            muscleGroupDayId: input.muscleGroupDayId,
            note: "engagement upsert skipped — could not resolve exercise_id",
          });
          return { persisted: true };
        }

        // CTO review B-1 — score-failure reps must NOT pollute
        // avg_composite. When recent_composite IS NULL, leave
        // avg_composite and completed_count unchanged.
        await tx.execute(drizzleSql`
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
      });
    }, { persisted: false });

    if (!result.persisted) {
      log.warn({
        event: "tag_workout_rep.degraded",
        repId: input.repId,
        muscleGroupDayId: input.muscleGroupDayId,
        exerciseId: input.exerciseId,
        note: "safeDb returned fallback — see prior error log for cause",
      });
    }
    return result;
  } catch (err) {
    log.error({
      event: "tag_workout_rep.threw",
      repId: input.repId,
      muscleGroupDayId: input.muscleGroupDayId,
      exerciseId: input.exerciseId,
      err: serializeErr(err),
    });
    return { persisted: false };
  }
}
