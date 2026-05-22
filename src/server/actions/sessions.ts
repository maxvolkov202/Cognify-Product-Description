"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { practiceSessions, workoutSessions } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import type { ModeId } from "@/types/domain";

type CreateSessionResult = { sessionId: string; persisted: boolean };
type FinalizeSessionResult = { persisted: boolean };

export type CreateWorkoutSessionResult = {
  sessionId: string; // practice_sessions.id
  workoutSessionId: string | null; // cognify_v2.workout_sessions.id
  persisted: boolean;
};

export async function createSession(
  mode: ModeId,
): Promise<CreateSessionResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const fallback: CreateSessionResult = {
    sessionId: randomUUID(),
    persisted: false,
  };

  return safeDb<CreateSessionResult>(async () => {
    const [session] = await db
      .insert(practiceSessions)
      .values({
        userId,
        mode,
        startedAt: new Date(),
      })
      .returning({ id: practiceSessions.id });
    return { sessionId: session!.id, persisted: true };
  }, fallback);
}

/**
 * Phase 3 — open a workout session bound to a muscle-group day.
 *
 * Creates the practice_sessions row (mode='daily_workout') AND the
 * cognify_v2.workout_sessions row pointing at the muscle_group_day in
 * one logical step. Returns both ids so callers can attach reps to
 * the practice session while still carrying the workout-session ref
 * for state-machine persistence (Phase 7).
 *
 * Idempotency is the muscle_group_day's responsibility — this just
 * opens a new session. Multiple resumes of the same day produce
 * multiple workout_sessions rows by design (the latest one is the
 * "active" one).
 */
export async function createWorkoutSession(
  muscleGroupDayId: string,
): Promise<CreateWorkoutSessionResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const fallback: CreateWorkoutSessionResult = {
    sessionId: randomUUID(),
    workoutSessionId: null,
    persisted: false,
  };

  return safeDb<CreateWorkoutSessionResult>(async () => {
    const [practice] = await db
      .insert(practiceSessions)
      .values({
        userId,
        mode: "daily_workout",
        startedAt: new Date(),
      })
      .returning({ id: practiceSessions.id });
    const practiceSessionId = practice!.id;

    const [workout] = await db
      .insert(workoutSessions)
      .values({
        muscleGroupDayId,
        practiceSessionId,
        userId,
        currentStationIndex: 0,
        state: "idle",
      })
      .returning({ id: workoutSessions.id });

    return {
      sessionId: practiceSessionId,
      workoutSessionId: workout!.id,
      persisted: true,
    };
  }, fallback);
}

export async function finalizeSession(
  sessionId: string,
  compositeScore: number,
): Promise<FinalizeSessionResult> {
  const fallback: FinalizeSessionResult = { persisted: false };
  return safeDb<FinalizeSessionResult>(async () => {
    await db
      .update(practiceSessions)
      .set({ endedAt: new Date(), compositeScore })
      .where(eq(practiceSessions.id, sessionId));
    return { persisted: true };
  }, fallback);
}
