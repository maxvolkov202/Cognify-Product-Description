"use server";

// Phase 3 — muscle-group day lifecycle server actions.
//
// - suggestTodaysMuscleGroup()  → which dim to train today + rationale
// - startMuscleGroupDay()        → idempotent per (user, day_date) insert
// - swapMuscleGroup()            → user override before any rep is logged
//
// All decision logic lives in src/server/lib/workout/assignment.ts; this
// file is the thin DB-fetching wrapper.

import { cache } from "react";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  exercises,
  muscleGroupDays,
  reps,
  users,
  workoutSessions,
} from "@/lib/db/schema";
import { isFinalCycleDay } from "@/lib/onboarding/committed-days";
import { isTrainingEngineV2Enabled } from "@/lib/flags";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { todayYmdInTz } from "@/lib/time/user-day";
import { log } from "@/lib/log";
import {
  MUSCLE_GROUP_IDS,
  type MuscleGroupId,
  type Station,
} from "@/types/domain";
import { getSubSkillRunningAverages } from "@/lib/db/queries/sub-skills";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";
import { SUB_SKILLS } from "@/types/sub-skills";
import { detectPlateau } from "@/lib/profile/plateau";
import {
  selectMuscleGroupForToday,
  sampleExercises,
  isAssessmentActive,
  type CatalogExercise,
  type EngagementSnapshot,
  type RecentDaySnapshot,
  type RecentRepsSnapshot,
  type SelectResult,
} from "@/server/lib/workout/assignment";
import { createWorkoutSession } from "@/server/actions/sessions";

const REP_HISTORY_DAYS = 14;
const RECENT_DAY_LOOKBACK = 30; // enough to cover six dims × past few weeks

/** PRD v3 Phase 2.1 — exercises per day. The v2 engine runs 3 exercises
 *  × (First Rep + required Retry) ≈ the same session effort as the
 *  legacy 4 single-rep stations (PRD §5.2 prescribes three). */
function stationsPerDay(): number {
  return isTrainingEngineV2Enabled() ? 3 : 4;
}

/** PRD v3 Phase 3.5 — dims plateaued per detectPlateau() over the last
 *  21 days of progress snapshots. Empty when the v2 engine is off. */
async function fetchPlateauedDims(userId: string): Promise<MuscleGroupId[]> {
  if (!isTrainingEngineV2Enabled()) return [];
  if (userId === "anonymous") return [];
  const rows = await db.execute<{
    dimension: string;
    taken_at: Date;
    score: number;
  }>(drizzleSql`
    SELECT dimension::text AS dimension, taken_at, score
    FROM cognify_v2.progress_snapshots
    WHERE user_id = ${userId}
      AND taken_at >= NOW() - INTERVAL '21 days'
    ORDER BY taken_at ASC
  `);
  const byDim = new Map<string, { at: string; score: number }[]>();
  for (const r of rows) {
    const list = byDim.get(r.dimension) ?? [];
    list.push({ at: r.taken_at.toISOString(), score: r.score });
    byDim.set(r.dimension, list);
  }
  const out: MuscleGroupId[] = [];
  for (const mg of MUSCLE_GROUP_IDS) {
    const skillDim = muscleGroupToSkillDim(mg);
    if (!skillDim) continue;
    const series = byDim.get(skillDim) ?? [];
    if (detectPlateau(series)) out.push(mg);
  }
  return out;
}

/** PRD v3 Phase 2.3 — the user's Hidden Skill running averages for one
 *  muscle group, shaped for sampleExercises. Returns undefined when the
 *  v2 engine is off (legacy selection stays byte-identical) or for
 *  anonymous users. */
async function fetchSubSkillAveragesForDim(
  userId: string,
  dim: MuscleGroupId,
): Promise<Record<string, number | null> | undefined> {
  if (!isTrainingEngineV2Enabled()) return undefined;
  if (userId === "anonymous") return undefined;
  const skillDim = muscleGroupToSkillDim(dim);
  if (!skillDim) return undefined;
  const stats = await getSubSkillRunningAverages(userId);
  const out: Record<string, number | null> = {};
  for (const id of SUB_SKILLS[skillDim]) {
    out[id] = stats[id]?.avg ?? null;
  }
  return out;
}

// Resolve the user's local YYYY-MM-DD for keying `muscle_group_days.day_date`.
// MUST match the rest-day banner + rollover cron, which both key off user-local
// time. UTC-keyed days drift across the user's midnight (e.g. a Pacific user
// training Sun 6pm PT writes Mon UTC, then Monday morning the row gets read
// as "today already done"). getUserProfile is React.cached so this adds zero
// roundtrips when the caller's render already loaded the profile.
async function todayDateForUser(userId: string): Promise<string> {
  const profile = await getUserProfile(userId);
  return todayYmdInTz(profile?.tz ?? "UTC");
}

function logEvent(event: string, payload: Record<string, unknown>): void {
  // Lightweight wrapper around the structured logger so dashboards
  // can drop the legacy "event":"..." parse pattern in favor of the
  // central log helper.
  log.info({ event, ...payload });
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
      objective: exercises.objective,
      hiddenSkills: exercises.hiddenSkills,
      responseWindow: exercises.responseWindow,
    })
    .from(exercises)
    .where(
      and(
        eq(exercises.dimension, dim),
        eq(exercises.isActive, true),
        // PRD v3 Phase 4 — application exercises live in the same table;
        // Daily Workout only samples core-skill (application-less) rows.
        isNull(exercises.application),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    dimension: r.dimension as MuscleGroupId,
    description: r.description,
    instructions: r.instructions,
    sortOrder: r.sortOrder,
    objective: r.objective ?? null,
    hiddenSkills: r.hiddenSkills ?? null,
    responseWindow: r.responseWindow ?? null,
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
  const dayDate = await todayDateForUser(userId);

  return safeDb<{ stations: Station[]; persisted: false }>(async () => {
    const [available, recentDays] = await Promise.all([
      fetchCatalogExercises(input.dim),
      fetchRecentDays(userId),
    ]);
    const subSkillAverages = await fetchSubSkillAveragesForDim(
      userId,
      input.dim,
    );
    const sampled = sampleExercises({
      available,
      recentDays,
      n: stationsPerDay(),
      seed: `${userId}:${dayDate}:${input.dim}`,
      ...(subSkillAverages ? { subSkillAverages } : {}),
    });
    const stations: Station[] = sampled.map((ex, index) => ({
      index,
      exerciseId: ex.id,
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      rule: ex.description,
      why: ex.instructions,
      objective: ex.objective,
      responseWindow: ex.responseWindow,
    }));
    return { stations, persisted: false };
  }, { stations: [], persisted: false });
}

export type SuggestResult = SelectResult & {
  /** Latest matching muscle_group_day if one already exists for today. */
  existingDayId: string | null;
};

// "use server" requires exports to be raw async functions, so we wrap an
// inner cache()'d impl rather than `export const ... = cache(...)`. The
// dashboard + workout page + startMuscleGroupDay all call this within a
// single request — without dedupe each call re-runs 4 heavy aggregates.
const _suggestTodaysMuscleGroupImpl = cache(async (): Promise<SuggestResult> => {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const today = new Date();
  const dayDate = await todayDateForUser(userId);

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

    const [engagement, recentReps, recentDays, userRow] = await Promise.all([
      fetchEngagement(userId),
      fetchRecentRepsAggregates(userId),
      fetchRecentDays(userId),
      db
        .select({ committedDays: users.committedDays, tz: users.tz })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    // Phase D — weakness day. If today is the user's final committed day
    // of the week (their weekly "cap" day), override the normal selector
    // with the weakest dim from this week's reps. The cycle = committed
    // days in this calendar week; the final committed day = the day with
    // no committed days after it this week.
    //
    // CTO review B-4 — pass user.tz so the weekday is resolved in the
    // user's local time, not server-local. A 8pm-Thursday rep in PT
    // would otherwise be evaluated as Friday on a UTC server.
    const committedDaysMask = userRow[0]?.committedDays ?? 31;
    const userTz = userRow[0]?.tz ?? "UTC";
    // PRD v3 Phase 2.4 — during the Assessment Phase the balanced
    // rotation owns every day; the weekly weakness-day override waits
    // until a baseline exists (PRD §8.4.2).
    const assessmentEnabled = isTrainingEngineV2Enabled();
    const inAssessment = assessmentEnabled && isAssessmentActive(recentDays);
    if (!inAssessment && isFinalCycleDay(committedDaysMask, today, userTz)) {
      // Pick the weakest dim from reps this week.
      const weeklyDimScores = recentReps
        .filter((r) => (r.count14d ?? 0) > 0 && r.avgComposite7d != null)
        .map((r) => ({
          dim: r.dimension,
          score: r.avgComposite7d as number,
        }))
        .sort((a, b) => a.score - b.score);
      if (weeklyDimScores.length > 0 && weeklyDimScores[0]) {
        const weakest = weeklyDimScores[0];
        logEvent("assignment.weakness_day", {
          userId,
          dim: weakest.dim,
          score: weakest.score,
          allDimScores: weeklyDimScores,
        });
        return {
          suggested: weakest.dim,
          alternates: pickStaticAlternates(weakest.dim),
          rationale: `${weakest.dim}'s your weakest this week — let's top it off.`,
          rationaleCode: "weakest_recent",
          existingDayId: null,
        };
      }
    }

    const plateauedDims = inAssessment ? [] : await fetchPlateauedDims(userId);
    const result = selectMuscleGroupForToday({
      today,
      engagement,
      recentReps,
      recentDays,
      seed: `${userId}:${dayDate}`,
      assessmentEnabled,
      weightedRotationEnabled: assessmentEnabled,
      plateauedDims,
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
});

export async function suggestTodaysMuscleGroup(): Promise<SuggestResult> {
  return _suggestTodaysMuscleGroupImpl();
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
  const dayDate = await todayDateForUser(userId);

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
          const healAverages = await fetchSubSkillAveragesForDim(
            userId,
            existingDim,
          );
          const resampled = sampleExercises({
            available,
            recentDays,
            n: stationsPerDay(),
            seed: `${userId}:${dayDate}:${existingDim}:heal`,
            ...(healAverages ? { subSkillAverages: healAverages } : {}),
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
              objective: ex.objective,
              responseWindow: ex.responseWindow,
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
    const subSkillAverages = await fetchSubSkillAveragesForDim(
      userId,
      chosenDim,
    );
    const sampled = sampleExercises({
      available,
      recentDays,
      n: stationsPerDay(),
      seed: `${userId}:${dayDate}:${chosenDim}`,
      ...(subSkillAverages ? { subSkillAverages } : {}),
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

    // ON CONFLICT DO NOTHING so a concurrent double-tap of "Start" (or
    // a page reload mid-FCP) doesn't 500 with a UNIQUE violation on
    // (user_id, day_date). If we lose the race, re-SELECT the winner's
    // row and treat the call as idempotent.
    let [inserted] = await db
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
      .onConflictDoNothing({
        target: [muscleGroupDays.userId, muscleGroupDays.dayDate],
      })
      .returning({ id: muscleGroupDays.id });
    if (!inserted) {
      const [winner] = await db
        .select({ id: muscleGroupDays.id })
        .from(muscleGroupDays)
        .where(
          and(
            eq(muscleGroupDays.userId, userId),
            eq(muscleGroupDays.dayDate, dayDate),
          ),
        )
        .limit(1);
      inserted = winner;
    }

    const stations: Station[] = sampled.map((ex, index) => ({
      index,
      exerciseId: ex.id,
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      rule: ex.description,
      why: ex.instructions,
      objective: ex.objective,
      responseWindow: ex.responseWindow,
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
    const swapAverages = await fetchSubSkillAveragesForDim(
      userId,
      input.newDim,
    );
    const sampled = sampleExercises({
      available,
      recentDays,
      n: stationsPerDay(),
      seed: `${userId}:${day.dayDate}:${input.newDim}:swap`,
      ...(swapAverages ? { subSkillAverages: swapAverages } : {}),
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
      objective: ex.objective,
      responseWindow: ex.responseWindow,
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
      objective: exercises.objective,
      responseWindow: exercises.responseWindow,
    })
    .from(exercises)
    .where(inArray(exercises.id, exerciseIds));

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
        objective: row.objective ?? null,
        responseWindow: row.responseWindow ?? null,
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
