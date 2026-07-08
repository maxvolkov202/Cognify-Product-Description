import Link from "next/link";
import { and, desc, eq, inArray, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  exercises,
  muscleGroupDays,
  users,
  workoutSessions,
} from "@/lib/db/schema";
import {
  VERTICALS,
  IMPROVEMENT_GOALS,
} from "@/lib/onboarding/constants";
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
import {
  suggestTodaysMuscleGroup,
  previewTodaysWorkoutPlan,
  getStationRecentFocus,
  getStationWindowSignals,
} from "@/server/actions/workout-day";
import { adaptResponseWindow } from "@/server/lib/workout/assignment";
import { getLastMuscleGroupDay } from "@/lib/db/queries/muscle-group-progress";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";
import {
  isMuscleGroupWorkoutEnabled,
  isTrainingEngineV2Enabled,
} from "@/lib/flags";
import { getUserProfile } from "@/lib/db/queries/user";
import { todayYmdInTz } from "@/lib/time/user-day";

export const dynamic = "force-dynamic";

function isMuscleGroupId(s: string): s is MuscleGroupId {
  return (MUSCLE_GROUP_IDS as readonly string[]).includes(s);
}

async function fetchPersonalizationContext(userId: string): Promise<{
  hasPersonalizationProfile: boolean;
  personalizationSummary: string | null;
}> {
  return safeDb(async () => {
    const [u] = await db
      .select({
        vertical: users.vertical,
        improvementGoals: users.improvementGoals,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u || !u.vertical) {
      return { hasPersonalizationProfile: false, personalizationSummary: null };
    }
    const verticalLabel =
      VERTICALS.find((v) => v.id === u.vertical)?.label ?? u.vertical;
    const goals = Array.isArray(u.improvementGoals)
      ? (u.improvementGoals as string[])
      : [];
    const topGoalLabel = goals[0]
      ? IMPROVEMENT_GOALS.find((g) => g.id === goals[0])?.label
      : null;
    const summary = topGoalLabel
      ? `${verticalLabel} · ${topGoalLabel}`
      : verticalLabel;
    return {
      hasPersonalizationProfile: true,
      personalizationSummary: summary,
    };
  }, { hasPersonalizationProfile: false, personalizationSummary: null });
}

async function fetchTodaysDayPayload(
  userId: string,
): Promise<WorkoutShellHydratedPayload> {
  // Key day rows by user-local date so 6pm PT trains as "today PT" not
  // "tomorrow UTC". getUserProfile is React.cached.
  const profile = await getUserProfile(userId);
  const dayDate = todayYmdInTz(profile?.tz ?? "UTC");

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
      // banner data for the suggested dim + preview of the 4 exercises
      // that startMuscleGroupDay() will create (same seed → identical
      // exercises). Surfaces "Today's Training" before the user taps.
      const suggestion = await suggestTodaysMuscleGroup();
      const [lastDay, streak, preview] = await Promise.all([
        getLastMuscleGroupDay(userId, suggestion.suggested),
        getStreakStatus(userId),
        previewTodaysWorkoutPlan({ dim: suggestion.suggested }),
      ]);
      return {
        ...EMPTY_SHELL_PAYLOAD,
        rationale: suggestion.rationale,
        dimension: suggestion.suggested,
        stations: preview.stations.map((s) => ({
          ...s,
          status: "locked" as const,
          compositeScore: null,
        })),
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
              objective: exercises.objective,
              responseWindow: exercises.responseWindow,
              constraintTypes: exercises.constraintTypes,
              coachInsight: exercises.coachInsight,
            })
            .from(exercises)
            .where(inArray(exercises.id, exerciseIds))
        : [];

    // Orphan-day self-heal: if planned exercise IDs reference rows that
    // no longer exist (catalog re-seeded with new UUIDs while a prior
    // day was open), fall through to the no-active-day branch so the
    // Start CTA reappears. startMuscleGroupDay will then re-sample +
    // update the existing row so the next render is clean.
    if (exerciseIds.length > 0 && exerciseRows.length === 0) {
      console.warn(
        JSON.stringify({
          event: "workout.day.orphaned",
          userId,
          dayId: day.id,
          plannedCount: exerciseIds.length,
          resolvedCount: 0,
        }),
      );
      const suggestion = await suggestTodaysMuscleGroup();
      const [lastDay, streak, preview] = await Promise.all([
        getLastMuscleGroupDay(userId, suggestion.suggested),
        getStreakStatus(userId),
        previewTodaysWorkoutPlan({ dim: suggestion.suggested }),
      ]);
      return {
        ...EMPTY_SHELL_PAYLOAD,
        rationale: suggestion.rationale,
        dimension: suggestion.suggested,
        stations: preview.stations.map((s) => ({
          ...s,
          status: "locked" as const,
          compositeScore: null,
        })),
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

    const exById = new Map(exerciseRows.map((r) => [r.id, r]));

    // I5 (PRD §8.6.4) — the coach's most recent focus on this day's dim,
    // shown as one quiet "last time" line on the Insight screen. Scoped
    // to the current user server-side; {} when the v2 engine is off.
    // I7 — adaptive time-pressure signals for this dim, so the resumed
    // day rebuilds the SAME adapted windows the server actions produce
    // (this mapping hydrates from raw exercise rows).
    const [recentFocusByDim, windowSignals] = await Promise.all([
      getStationRecentFocus(),
      getStationWindowSignals(dim),
    ]);
    const dimRecentFocus = recentFocusByDim[dim] ?? null;

    const stations: ShellStation[] = exerciseIds.flatMap((id, index) => {
      const ex = exById.get(id);
      if (!ex) return [];
      const status: ShellStation["status"] =
        index < day.completedReps
          ? "complete"
          : index === day.completedReps
            ? "current"
            : "locked";
      const adaptedWindow = adaptResponseWindow(
        ex.responseWindow ?? null,
        windowSignals,
      );
      const station: ShellStation = {
        index,
        exerciseId: ex.id,
        exerciseSlug: ex.slug,
        exerciseName: ex.name,
        rule: ex.description,
        why: ex.instructions,
        status,
        compositeScore: null,
        objective: ex.objective ?? null,
        constraintTypes: ex.constraintTypes ?? null,
        responseWindow: adaptedWindow.window,
        windowAdjusted: adaptedWindow.adjusted,
        coachInsight: ex.coachInsight ?? null,
        recentFocus: dimRecentFocus,
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
        practiceSessionId: workoutSessions.practiceSessionId,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.muscleGroupDayId, day.id))
      .orderBy(desc(workoutSessions.createdAt))
      .limit(1);

    // Re-entry behavior: any active (incomplete) day always lands the
    // user back on the "Ready to train" landing card. They tap Start to
    // resume — the on-start handler calls the idempotent
    // startMuscleGroupDay, which reuses the existing day and drops them
    // back into the picker at the current station. This avoids the
    // surprise of "I clicked Workout and the recording UI just appears."
    //   - complete day → day-complete (retrospective)
    //   - all planned exercises logged but not finalized → day-complete-prompt
    //   - otherwise → idle landing (Start resumes)
    // PRD v3 Phase 2.1 — the target derives from the day's planned
    // exercise list (3 in the v2 engine, 4 legacy) instead of a
    // hard-coded 4, so both loop variants close out correctly.
    const dayTarget = exerciseIds.length > 0 ? exerciseIds.length : 4;
    const phase =
      day.status === "complete"
        ? "day-complete"
        : day.completedReps >= dayTarget
          ? "day-complete-prompt"
          : "idle";

    return {
      hasActiveDay: true,
      dayId: day.id,
      dimension: dim,
      dayDate: day.dayDate,
      stations,
      sessionPhase: phase,
      currentStationIndex:
        activeSession?.index ?? Math.min(day.completedReps, dayTarget - 1),
      workoutSessionId: activeSession?.id ?? null,
      practiceSessionId: activeSession?.practiceSessionId ?? null,
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
      // Filled in by the parent (WorkoutPage) using fetchPersonalizationContext.
      hasPersonalizationProfile: false,
      personalizationSummary: null,
      // Filled in by the parent (WorkoutPage) from isTrainingEngineV2Enabled().
      loopVariant: "v1",
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
  const [payload, personalization] = await Promise.all([
    fetchTodaysDayPayload(userId),
    user
      ? fetchPersonalizationContext(user.id)
      : Promise.resolve({
          hasPersonalizationProfile: false,
          personalizationSummary: null,
        }),
  ]);
  payload.hasPersonalizationProfile = personalization.hasPersonalizationProfile;
  payload.personalizationSummary = personalization.personalizationSummary;
  // PRD v3 engine — resolve the learning-loop variant server-side so the
  // pure session machine never reads env vars.
  payload.loopVariant = isTrainingEngineV2Enabled() ? "v2" : "v1";

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

  // Phase D — rest-day banner has moved to /dashboard (it surfaces
  // *before* the user opens the workout, where they're deciding what
  // to do). Inside /workout the user already committed; no banner.

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
          In the meantime, Skill Lab is still up for targeted training
          and custom reps.
        </p>
        <Link
          href="/skill-lab"
          className="inline-flex min-h-[44px] items-center mt-2 px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-sm font-medium"
        >
          Go to Skill Lab
        </Link>
      </div>
    </div>
  );
}
