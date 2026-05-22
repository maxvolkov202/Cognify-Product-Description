import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  exercises,
  muscleGroupDays,
  workoutSessions,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import {
  MUSCLE_GROUP_IDS,
  type MuscleGroupId,
} from "@/types/domain";
import WorkoutShell from "@/components/product/workout-shell/WorkoutShell";
import {
  EMPTY_SHELL_PAYLOAD,
  type ShellStation,
  type WorkoutShellHydratedPayload,
} from "@/lib/workout/types";
import { suggestTodaysMuscleGroup } from "@/server/actions/workout-day";
import { getLastMuscleGroupDay } from "@/lib/db/queries/muscle-group-progress";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";
import { isMuscleGroupWorkoutEnabled } from "@/lib/flags";

export const dynamic = "force-dynamic";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function isMuscleGroupId(s: string): s is MuscleGroupId {
  return (MUSCLE_GROUP_IDS as readonly string[]).includes(s);
}

async function fetchTodaysDayPayload(
  userId: string,
): Promise<WorkoutShellHydratedPayload> {
  const dayDate = todayUTC();

  return safeDb<WorkoutShellHydratedPayload>(async () => {
    const [day] = await db
      .select()
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dayDate, dayDate),
        ),
      )
      .limit(1);

    if (!day || !isMuscleGroupId(day.dimension as string)) {
      // No active day yet → empty shell + suggestion rationale + prior-day
      // banner data for the suggested dim.
      const suggestion = await suggestTodaysMuscleGroup();
      const [lastDay, streak] = await Promise.all([
        getLastMuscleGroupDay(userId, suggestion.suggested),
        getStreakStatus(userId),
      ]);
      return {
        ...EMPTY_SHELL_PAYLOAD,
        rationale: suggestion.rationale,
        dimension: suggestion.suggested,
        lastDay: lastDay
          ? {
              lastComposite: lastDay.lastComposite,
              daysSince: lastDay.daysSince,
            }
          : null,
        streakDays: streak?.streakDays ?? null,
        streakFreezes: streak?.freezesAvailable ?? null,
      };
    }

    const dim = day.dimension as MuscleGroupId;
    const exerciseIds = Array.isArray(day.plannedExerciseIds)
      ? (day.plannedExerciseIds as string[])
      : [];

    const exerciseRows =
      exerciseIds.length > 0
        ? await db
            .select({
              id: exercises.id,
              slug: exercises.slug,
              name: exercises.name,
              description: exercises.description,
              instructions: exercises.instructions,
            })
            .from(exercises)
            .where(drizzleSql`${exercises.id} = ANY(${exerciseIds}::uuid[])`)
        : [];

    const exById = new Map(exerciseRows.map((r) => [r.id, r]));

    const stations: ShellStation[] = exerciseIds.flatMap((id, index) => {
      const ex = exById.get(id);
      if (!ex) return [];
      const status: ShellStation["status"] =
        index < day.completedReps
          ? "complete"
          : index === day.completedReps
            ? "current"
            : "locked";
      const station: ShellStation = {
        index,
        exerciseId: ex.id,
        exerciseSlug: ex.slug,
        exerciseName: ex.name,
        rule: ex.description,
        why: ex.instructions,
        status,
        compositeScore: null,
      };
      return [station];
    });

    // Streak + freezes for Phase 10's header pill.
    const streak = await getStreakStatus(userId);

    // Most recent prior day in the same dim — for Phase 9's banner.
    const [previousDay] = await db
      .select({ composite: muscleGroupDays.compositeAtClose })
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, userId),
          eq(muscleGroupDays.dimension, dim),
          drizzleSql`${muscleGroupDays.id} <> ${day.id}`,
        ),
      )
      .orderBy(desc(muscleGroupDays.dayDate))
      .limit(1);

    // Active workout session for resumption (Phase 7 reads this).
    const [activeSession] = await db
      .select({
        id: workoutSessions.id,
        index: workoutSessions.currentStationIndex,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.muscleGroupDayId, day.id))
      .orderBy(desc(workoutSessions.createdAt))
      .limit(1);

    // Default to prompt-selecting when an active day exists so the
    // picker mounts immediately. The legacy "idle when completedReps=0"
    // branch only fires now when somehow no workout_session has been
    // opened yet (shouldn't happen post-Phase-6 wiring).
    const phase =
      day.status === "complete"
        ? "day-complete"
        : day.completedReps >= 4
          ? "day-complete-prompt"
          : "prompt-selecting";

    return {
      hasActiveDay: true,
      dayId: day.id,
      dimension: dim,
      dayDate: day.dayDate,
      stations,
      sessionPhase: phase,
      currentStationIndex:
        activeSession?.index ?? Math.min(day.completedReps, 3),
      workoutSessionId: activeSession?.id ?? null,
      previousDayComposite: previousDay?.composite ?? null,
      lastDay: previousDay
        ? {
            lastComposite: previousDay.composite,
            // Banner uses a coarse "days since" — for an active day we
            // already have the current date, so compute against the
            // previous day's compositeAtClose (kept simple; Phase 9
            // server query offers the canonical version when needed).
            daysSince: 0,
          }
        : null,
      streakDays: streak?.streakDays ?? null,
      streakFreezes: streak?.freezesAvailable ?? null,
      todaysComposite: day.compositeAtClose,
      rationale: null,
    };
  }, EMPTY_SHELL_PAYLOAD);
}

export default async function WorkoutPage() {
  // Phase 15 — feature-flag gate. Production launches with the flag
  // off; flip FF_MUSCLE_GROUP_WORKOUT=true on Vercel once smoke + KPI
  // gates pass. Off-state renders BetaSoon (legacy WorkoutSession is
  // archived; reanimating it would be its own restore PR).
  if (!isMuscleGroupWorkoutEnabled()) {
    return <BetaSoon />;
  }

  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const payload = await fetchTodaysDayPayload(userId);

  // Lightweight viewed-telemetry log.
  if (process.env.NODE_ENV !== "production") {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "workout_shell.viewed",
        userId,
        muscleGroupDayId: payload.dayId,
        sessionPhase: payload.sessionPhase,
        hasPriorDay: payload.previousDayComposite != null,
      }),
    );
  }

  return <WorkoutShell payload={payload} />;
}

function BetaSoon() {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Workout&apos;s getting a refresh</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          We&apos;re finishing the new muscle-group flow — brain mascot, 4-rep
          days, and progression tracking that ties it all together. Back
          soon.
        </p>
        <p className="text-xs text-slate-500">
          In the meantime, Practice (formerly Skill Lab) is still up for
          targeted drills and custom reps.
        </p>
        <a
          href="/skill-lab"
          className="inline-block mt-2 px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-sm font-medium"
        >
          Go to Practice
        </a>
      </div>
    </div>
  );
}
