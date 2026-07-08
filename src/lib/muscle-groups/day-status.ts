// Phase 10 — muscle-group day status lifecycle.
//
// Pure decision logic lives at the top: tests can drive `decideStatus`
// without a DB. The IO-touching `closeOutDay` below threads the
// decision through DB writes (status update + freeze consume +
// notification insert + idempotency guard) and is safeDb-wrapped so
// outages degrade gracefully.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  muscleGroupDays,
  userNotifications,
  users,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { consumeStreakFreeze } from "@/lib/db/queries/streak-freeze";

// ─── Pure decision logic ────────────────────────────────────────────────

/** End-states for a closed-out muscle-group day. */
export type DayEndStatus =
  | "complete" // all planned exercises done → baseline set, streak preserved
  | "partial" // some but not all done → streak preserved, no baseline
  | "missed" // 0 reps + no freeze available → streak resets
  | "frozen_skip" // 0 reps + freeze auto-consumed → streak preserved
  | "complete_graduated"; // complete + graduation rep done → bonus XP awarded

export type DecideStatusInput = {
  completedReps: number;
  hasGraduated: boolean;
  freezeAvailable: boolean;
  /** PRD v3 — day-complete threshold. Derived from the day's planned
   *  exercise count (3 in the v2 engine, 4 legacy). Defaults to 4 so
   *  historical call sites/tests keep their behavior. */
  targetReps?: number;
};

export type DecideStatusOutput = {
  status: DayEndStatus;
  /** Streak preserved? (false → resets on this close-out) */
  preservesStreak: boolean;
  /** Should the close-out consume a freeze? */
  consumesFreeze: boolean;
  /** Was a new baseline set today? */
  setsBaseline: boolean;
  /** Notification kind to insert. */
  notificationKind:
    | "day_complete"
    | "day_partial"
    | "day_missed"
    | "freeze_consumed";
};

/** PRD v3 — derive a day's completion target from its planned exercise
 *  list (3 in the v2 engine, 4 legacy). Falls back to 4 for malformed
 *  rows so legacy days close out unchanged. */
export function dayTargetReps(plannedExerciseIds: unknown): number {
  return Array.isArray(plannedExerciseIds) && plannedExerciseIds.length > 0
    ? plannedExerciseIds.length
    : 4;
}

/**
 * Resolve the end-state without touching the DB. Phase 10 DoD asks
 * tests to cover all five end-states + idempotent re-run.
 */
export function decideStatus(input: DecideStatusInput): DecideStatusOutput {
  const target = input.targetReps ?? 4;
  if (input.completedReps >= target) {
    if (input.hasGraduated) {
      return {
        status: "complete_graduated",
        preservesStreak: true,
        consumesFreeze: false,
        setsBaseline: true,
        notificationKind: "day_complete",
      };
    }
    return {
      status: "complete",
      preservesStreak: true,
      consumesFreeze: false,
      setsBaseline: true,
      notificationKind: "day_complete",
    };
  }
  if (input.completedReps >= 1) {
    return {
      status: "partial",
      preservesStreak: true,
      consumesFreeze: false,
      setsBaseline: false,
      notificationKind: "day_partial",
    };
  }
  // 0 reps — missed unless a freeze rescues it.
  if (input.freezeAvailable) {
    return {
      status: "frozen_skip",
      preservesStreak: true,
      consumesFreeze: true,
      setsBaseline: false,
      notificationKind: "freeze_consumed",
    };
  }
  return {
    status: "missed",
    preservesStreak: false,
    consumesFreeze: false,
    setsBaseline: false,
    notificationKind: "day_missed",
  };
}

// ─── DB-touching wrapper ────────────────────────────────────────────────

export type CloseOutResult =
  | {
      ok: true;
      dayId: string;
      status: DayEndStatus;
      freezeConsumed: boolean;
      notificationId: string | null;
      idempotentSkip?: false;
    }
  | { ok: true; dayId: string; idempotentSkip: true }
  | { ok: false; reason: "not_found" | "db_unavailable" };

export async function closeOutDay(
  userId: string,
  dayId: string,
  nowUtc: Date = new Date(),
): Promise<CloseOutResult> {
  return safeDb<CloseOutResult>(
    async () => {
      const [day] = await db
        .select()
        .from(muscleGroupDays)
        .where(
          and(
            eq(muscleGroupDays.id, dayId),
            eq(muscleGroupDays.userId, userId),
          ),
        )
        .limit(1);
      if (!day) return { ok: false as const, reason: "not_found" };

      // Idempotency guard — bail if already closed out.
      if (day.closedOutAt != null) {
        return { ok: true as const, dayId, idempotentSkip: true };
      }

      // Pull freeze balance for the missed-day branch.
      const [u] = await db
        .select({ freezes: users.streakFreezes })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const freezeAvailable = (u?.freezes ?? 0) > 0;

      const decision = decideStatus({
        completedReps: day.completedReps ?? 0,
        hasGraduated: day.graduatedAt != null,
        freezeAvailable,
        targetReps: dayTargetReps(day.plannedExerciseIds),
      });

      // Apply freeze consume *before* writing the day so retry on
      // partial failure doesn't double-spend.
      let freezeConsumed = false;
      let freezeAppliedDate: string | null = null;
      if (decision.consumesFreeze) {
        await consumeStreakFreeze(userId);
        freezeConsumed = true;
        freezeAppliedDate = day.dayDate;
      }

      await db
        .update(muscleGroupDays)
        .set({
          status: decision.status,
          closedOutAt: nowUtc,
          ...(freezeAppliedDate ? { freezeAppliedDate } : {}),
        })
        .where(eq(muscleGroupDays.id, dayId));

      const [inserted] = await db
        .insert(userNotifications)
        .values({
          userId,
          kind: decision.notificationKind,
          payload: {
            dayId,
            dimension: day.dimension,
            status: decision.status,
            preservesStreak: decision.preservesStreak,
            completedReps: day.completedReps,
          },
        })
        .returning({ id: userNotifications.id });

      // Lightweight structured log; ops dashboards parse these.
      console.log(
        JSON.stringify({
          ts: nowUtc.toISOString(),
          event:
            decision.status === "missed"
              ? "day_missed"
              : decision.status === "frozen_skip"
                ? "streak_freeze_consumed"
                : decision.status === "partial"
                  ? "day_partial"
                  : "day_completed",
          userId,
          dayId,
          dimension: day.dimension,
          repsDone: day.completedReps,
          graduated: day.graduatedAt != null,
          hadFreeze: freezeAvailable,
        }),
      );

      return {
        ok: true as const,
        dayId,
        status: decision.status,
        freezeConsumed,
        notificationId: inserted?.id ?? null,
      };
    },
    { ok: false as const, reason: "db_unavailable" },
  );
}

// ─── On-rep-save status bump ────────────────────────────────────────────

/**
 * Called from reps.ts after a rep is saved. Bumps the day's status
 * from `planned` → `in_progress` after the first rep, then to a
 * provisional `partial`/`complete` based on the running count. The
 * authoritative end-state is sealed by closeOutDay() at rollover.
 */
export async function bumpDayStatusOnRepSave(
  dayId: string,
  isGraduationRep: boolean,
): Promise<void> {
  await safeDb(async () => {
    const [day] = await db
      .select({
        completedReps: muscleGroupDays.completedReps,
        status: muscleGroupDays.status,
        plannedExerciseIds: muscleGroupDays.plannedExerciseIds,
      })
      .from(muscleGroupDays)
      .where(eq(muscleGroupDays.id, dayId))
      .limit(1);
    if (!day) return false;

    const reps = day.completedReps ?? 0;
    const target = dayTargetReps(day.plannedExerciseIds);
    let nextStatus = day.status;
    if (reps >= target) nextStatus = "complete";
    else if (reps >= 1) nextStatus = "in_progress";

    const patch: Record<string, unknown> = { status: nextStatus };
    if (isGraduationRep) {
      patch.graduatedAt = new Date();
    }
    await db
      .update(muscleGroupDays)
      .set(patch)
      .where(eq(muscleGroupDays.id, dayId));
    return true;
  }, false);
}
