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
  communicationProfile,
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
import {
  selectMuscleGroupForToday,
  planUpcomingDims,
  sampleExercises,
  isAssessmentActive,
  adaptResponseWindow,
  type CatalogExercise,
  type RecentDaySnapshot,
  type SelectResult,
} from "@/server/lib/workout/assignment";
import {
  fetchEngagement,
  fetchRecentRepsAggregates,
  fetchPlateauedDims,
  fetchRecentFocusByDim,
  fetchCompletedExerciseIds,
  type StationRecentFocus,
} from "@/server/lib/workout/day-fetchers";
import { createWorkoutSession } from "@/server/actions/sessions";

const RECENT_DAY_LOOKBACK = 30; // enough to cover six dims × past few weeks

/** PRD v3 Phase 2.1 — exercises per day. The v2 engine runs 3 exercises
 *  × (First Rep + required Retry) ≈ the same session effort as the
 *  legacy 4 single-rep stations (PRD §5.2 prescribes three). */
function stationsPerDay(): number {
  return isTrainingEngineV2Enabled() ? 3 : 4;
}

// PRD v3 Phase 3.5 / I5 / I6 — the action-local raw-SQL fetchers
// (fetchPlateauedDims, fetchRecentFocusByDim, fetchCompletedExerciseIds,
// fetchEngagement, fetchRecentRepsAggregates) live in
// src/server/lib/workout/day-fetchers.ts so the contract harness can
// execute them against the real dev DB ("use server" files may only
// export async functions, which would have made them forgeable actions).

/** I3 — the user's Communication Profile signals, shaped for the
 *  assignment engine: core-skill estimates keyed by muscle group (the
 *  profile stores v3 skill dims — "delivery" maps back to the "pacing"
 *  muscle group) plus the Hidden Skill estimates. The profile is the
 *  LONG-memory estimate that survives training breaks, unlike the
 *  14d/30-rep windows every other fetcher here reads. React.cache'd so
 *  the row loads once per request. Null when the v2 engine is off
 *  (legacy behavior byte-identical), for anonymous users, or when the
 *  user has no profile row yet. */
const fetchProfileSignals = cache(async (
  userId: string,
): Promise<{
  coreByMg: Partial<Record<MuscleGroupId, number>>;
  hiddenSkills: Record<string, { score: number; sampleCount: number }>;
} | null> => {
  if (!isTrainingEngineV2Enabled()) return null;
  if (userId === "anonymous") return null;
  const [row] = await db
    .select({
      coreSkills: communicationProfile.coreSkills,
      hiddenSkills: communicationProfile.hiddenSkills,
    })
    .from(communicationProfile)
    .where(eq(communicationProfile.userId, userId))
    .limit(1);
  if (!row) return null;
  const core = (row.coreSkills ?? {}) as Record<
    string,
    { score: number; sampleCount: number; updatedAt: string }
  >;
  const coreByMg: Partial<Record<MuscleGroupId, number>> = {};
  for (const mg of MUSCLE_GROUP_IDS) {
    const skillDim = muscleGroupToSkillDim(mg);
    if (!skillDim) continue;
    const est = core[skillDim];
    if (est && Number.isFinite(est.score)) coreByMg[mg] = est.score;
  }
  return {
    coreByMg,
    hiddenSkills: (row.hiddenSkills ?? {}) as Record<
      string,
      { score: number; sampleCount: number }
    >,
  };
});

/** I3 — read-time sub-skill stats below this sample count defer to the
 *  profile's long-memory estimate. Mirrors SUB_SKILL_MIN_SAMPLES in
 *  src/lib/db/queries/sub-skills.ts. */
const SUB_SKILL_PROFILE_MIN_SAMPLES = 5;

/** I5 — page.tsx entry point (server component hydration path). Scoped
 *  to the CURRENT user server-side, so the exported action carries no
 *  forgeable userId parameter. */
export async function getStationRecentFocus(): Promise<
  Partial<Record<MuscleGroupId, StationRecentFocus>>
> {
  const user = await currentUser();
  if (!user) return {};
  return safeDb(() => fetchRecentFocusByDim(user.id), {});
}

/** I6 — sampleExercises extras for the Assessment Phase: when the v2
 *  engine is on AND the user is still inside the assessment window,
 *  sampling hard-prefers never-seen exercises. Spread into the
 *  sampleExercises input ({} otherwise = legacy behavior). */
async function assessmentSampleExtras(
  userId: string,
  recentDays: RecentDaySnapshot[],
): Promise<
  | { assessmentActive: true; completedExerciseIds: Set<string> }
  | Record<string, never>
> {
  if (!isTrainingEngineV2Enabled()) return {};
  if (!isAssessmentActive(recentDays)) return {};
  return {
    assessmentActive: true,
    completedExerciseIds: await fetchCompletedExerciseIds(userId),
  };
}

/** PRD v3 Phase 2.3 — the user's Hidden Skill running averages for one
 *  muscle group, shaped for sampleExercises. Returns undefined when the
 *  v2 engine is off (legacy selection stays byte-identical) or for
 *  anonymous users.
 *  I3 — sub-skills with <5 samples in the 30-rep read-time window fall
 *  back to the Communication Profile's Hidden Skill estimate, so a
 *  break doesn't make every sub-skill look unmeasured. */
async function fetchSubSkillAveragesForDim(
  userId: string,
  dim: MuscleGroupId,
): Promise<Record<string, number | null> | undefined> {
  if (!isTrainingEngineV2Enabled()) return undefined;
  if (userId === "anonymous") return undefined;
  const skillDim = muscleGroupToSkillDim(dim);
  if (!skillDim) return undefined;
  const [stats, profileSignals] = await Promise.all([
    getSubSkillRunningAverages(userId),
    fetchProfileSignals(userId),
  ]);
  const profileHidden = profileSignals?.hiddenSkills ?? {};
  const out: Record<string, number | null> = {};
  for (const id of SUB_SKILLS[skillDim]) {
    const stat = stats[id];
    if (stat && stat.sampleSize >= SUB_SKILL_PROFILE_MIN_SAMPLES) {
      out[id] = stat.avg;
    } else {
      // Profile first (long memory), then whatever thin window signal
      // exists, then null = genuinely never measured anywhere.
      out[id] = profileHidden[id]?.score ?? stat?.avg ?? null;
    }
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

/** Short display label for the Phase 7.3 "Next up" rationale tail. */
function dimShortLabel(dim: MuscleGroupId): string {
  const labels: Record<MuscleGroupId, string> = {
    clarity: "Clarity",
    structure: "Structure",
    conciseness: "Conciseness",
    thinking_quality: "Thinking",
    pacing: "Pacing",
    tone: "Tone",
  };
  return labels[dim];
}

function logEvent(event: string, payload: Record<string, unknown>): void {
  // Lightweight wrapper around the structured logger so dashboards
  // can drop the legacy "event":"..." parse pattern in favor of the
  // central log helper.
  log.info({ event, ...payload });
}

// ─── World-state fetchers ────────────────────────────────────────────────
// (fetchEngagement / fetchRecentRepsAggregates and the other raw-SQL
// fetchers live in day-fetchers.ts — see the import note above.)

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
      constraintTypes: exercises.constraintTypes,
      coachInsight: exercises.coachInsight,
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
    constraintTypes: r.constraintTypes ?? null,
    coachInsight: r.coachInsight ?? null,
  }));
}

// ─── I-7 — adaptive time pressure ────────────────────────────────────────

/** Signals for adaptResponseWindow, shaped per (user, dim). */
type WindowSignals = { dimEstimate: number | null; confidenceBuilder: boolean };

const NO_WINDOW_SIGNALS: WindowSignals = {
  dimEstimate: null,
  confidenceBuilder: false,
};

/** I-7 (PRD §8.5.3 step 4, §8.4.4 time-pressure lever) — the two inputs
 *  to adaptResponseWindow for one dim:
 *
 *  - dimEstimate: the Communication Profile's LONG-memory core-skill
 *    estimate (fetchProfileSignals, I3) — ≥80 tightens the window.
 *  - confidenceBuilder: today's suggestion is a confidence-builder day
 *    for THIS dim — loosens the window. suggestTodaysMuscleGroup is
 *    React.cache'd, and for an already-started day it echoes back
 *    "weakest_recent", so the loosening only applies while the day is
 *    being previewed/created ("where available"); resumed days keep the
 *    profile-driven tightening, which is stable across the day.
 *
 *  {null,false} when the v2 engine is off or the user is anonymous →
 *  adaptResponseWindow returns every window unchanged (legacy behavior
 *  byte-identical). */
async function windowSignalsForDim(
  userId: string,
  dim: MuscleGroupId,
): Promise<WindowSignals> {
  if (!isTrainingEngineV2Enabled()) return NO_WINDOW_SIGNALS;
  if (userId === "anonymous") return NO_WINDOW_SIGNALS;
  const [profileSignals, suggest] = await Promise.all([
    fetchProfileSignals(userId),
    _suggestTodaysMuscleGroupImpl(),
  ]);
  return {
    dimEstimate: profileSignals?.coreByMg[dim] ?? null,
    confidenceBuilder:
      suggest.rationaleCode === "confidence_builder" &&
      suggest.suggested === dim,
  };
}

/** I-7 — page.tsx entry point (server-component hydration of an existing
 *  day, which rebuilds stations from raw exercise rows). Scoped to the
 *  CURRENT user server-side, so the exported action carries no forgeable
 *  userId parameter (same contract as getStationRecentFocus). */
export async function getStationWindowSignals(
  dim: MuscleGroupId,
): Promise<WindowSignals> {
  const user = await currentUser();
  if (!user) return NO_WINDOW_SIGNALS;
  return safeDb(() => windowSignalsForDim(user.id, dim), NO_WINDOW_SIGNALS);
}

/** Map sampled catalog exercises to Stations, applying the I-7 adaptive
 *  response window. ONE shared builder for preview / start / self-heal /
 *  swap so every path produces identical stations from identical inputs
 *  (preview↔start identity is a hard requirement). */
function buildStations(
  sampled: CatalogExercise[],
  signals: WindowSignals,
  recentFocus: StationRecentFocus | null,
): Station[] {
  return sampled.map((ex, index) => {
    const adapted = adaptResponseWindow(ex.responseWindow ?? null, signals);
    return {
      index,
      exerciseId: ex.id,
      exerciseSlug: ex.slug,
      exerciseName: ex.name,
      rule: ex.description,
      why: ex.instructions,
      objective: ex.objective,
      responseWindow: adapted.window,
      windowAdjusted: adapted.adjusted,
      constraintTypes: ex.constraintTypes ?? null,
      coachInsight: ex.coachInsight ?? null,
      recentFocus,
    };
  });
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
    const [
      subSkillAverages,
      plateauedDims,
      assessmentExtras,
      recentFocusByDim,
      windowSignals,
    ] = await Promise.all([
      fetchSubSkillAveragesForDim(userId, input.dim),
      fetchPlateauedDims(userId),
      // I6 — assessment days hard-prefer never-seen exercises. Same
      // extras as startMuscleGroupDay (identical seed) so Start lands
      // on the exercises the preview showed.
      assessmentSampleExtras(userId, recentDays),
      // I5 — "last time on this dim" coaching memory per station.
      fetchRecentFocusByDim(userId),
      // I7 — adaptive response window (same signals as start).
      windowSignalsForDim(userId, input.dim),
    ]);
    const sampled = sampleExercises({
      available,
      recentDays,
      n: stationsPerDay(),
      seed: `${userId}:${dayDate}:${input.dim}`,
      ...(subSkillAverages ? { subSkillAverages } : {}),
      // I4 — plateaued dim: invert sub-skill weighting (stimulus change).
      ...(plateauedDims.includes(input.dim) ? { plateaued: true } : {}),
      ...assessmentExtras,
    });
    const stations = buildStations(
      sampled,
      windowSignals,
      recentFocusByDim[input.dim] ?? null,
    );
    return { stations, persisted: false };
  }, { stations: [], persisted: false });
}

export type SuggestResult = SelectResult & {
  /** Latest matching muscle_group_day if one already exists for today. */
  existingDayId: string | null;
  /** PRD v3 Phase 7.3 — the next 2 planned focus dims (simulated). */
  upcoming?: MuscleGroupId[];
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

    const [engagement, recentReps, recentDays, userRow, profileSignals] =
      await Promise.all([
        fetchEngagement(userId),
        fetchRecentRepsAggregates(userId),
        fetchRecentDays(userId),
        db
          .select({ committedDays: users.committedDays, tz: users.tz })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
        // I3 — long-memory Communication Profile estimates (null = v2
        // engine off / anon / no profile row → legacy behavior).
        fetchProfileSignals(userId),
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
      // PRD v3 Phase 7.2 — confidence management, same v2-engine gate.
      confidenceBoostEnabled: assessmentEnabled,
      // I3 — profile fallback: the dim ranking survives training breaks.
      ...(profileSignals ? { profileFallback: profileSignals.coreByMg } : {}),
    });

    // PRD v3 Phase 7.3 — project the next two focus days so the user
    // sees where the week is headed ("Trust the Coach" needs a visible
    // plan, not day-by-day surprise). Ride the rationale line — no new
    // UI surface required.
    let upcoming: MuscleGroupId[] | undefined;
    if (assessmentEnabled) {
      upcoming = planUpcomingDims(
        {
          today,
          engagement,
          recentReps,
          recentDays,
          seed: `${userId}:${dayDate}`,
          assessmentEnabled,
          weightedRotationEnabled: assessmentEnabled,
          plateauedDims,
          ...(profileSignals
            ? { profileFallback: profileSignals.coreByMg }
            : {}),
        },
        result.suggested,
        2,
      );
      if (upcoming.length === 2) {
        result.rationale = `${result.rationale} Next up: ${dimShortLabel(upcoming[0]!)}, then ${dimShortLabel(upcoming[1]!)}.`;
      }
    }

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
  /** practice_sessions.id backing that session — the ONLY id that may be
   *  passed to saveRep/insertPendingRep (reps.session_id FK). */
  practiceSessionId: string | null;
  alreadyExisted: boolean;
  /** Station index the caller should drop the user into when (re)starting.
   *  0 for a brand-new day; for a resumed day it's the first not-yet-
   *  completed station (clamped to the last index) so exiting mid-day and
   *  coming back lands on the right rep instead of restarting at rep 1.
   *  Mirrors the server-render resume math in app/(app)/workout/page.tsx. */
  resumeStationIndex: number;
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
    practiceSessionId: null,
    alreadyExisted: false,
    resumeStationIndex: 0,
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

      // I5 — decorate the hydrated stations with the day-dim's most
      // recent Coach's Focus (hydrateStations only sees exercise ids).
      // I7 — apply the adaptive response window on resume too (the
      // profile-driven tightening is stable across the day; the
      // confidence-builder loosening is only knowable pre-start).
      const existingIsMg = isMuscleGroupId(existing.dimension as string);
      const [existingFocusByDim, existingWindowSignals] = await Promise.all([
        fetchRecentFocusByDim(userId),
        existingIsMg
          ? windowSignalsForDim(userId, existing.dimension as MuscleGroupId)
          : Promise.resolve(NO_WINDOW_SIGNALS),
      ]);
      const existingDimFocus = existingIsMg
        ? (existingFocusByDim[existing.dimension as MuscleGroupId] ?? null)
        : null;
      stations = stations.map((s) => {
        const adapted = adaptResponseWindow(
          s.responseWindow,
          existingWindowSignals,
        );
        return {
          ...s,
          recentFocus: existingDimFocus,
          responseWindow: adapted.window,
          windowAdjusted: adapted.adjusted,
        };
      });

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
          const [healAverages, healPlateaued, healAssessment] =
            await Promise.all([
              fetchSubSkillAveragesForDim(userId, existingDim),
              fetchPlateauedDims(userId),
              assessmentSampleExtras(userId, recentDays),
            ]);
          const resampled = sampleExercises({
            available,
            recentDays,
            n: stationsPerDay(),
            seed: `${userId}:${dayDate}:${existingDim}:heal`,
            ...(healAverages ? { subSkillAverages: healAverages } : {}),
            ...(healPlateaued.includes(existingDim)
              ? { plateaued: true }
              : {}),
            ...healAssessment,
          });
          if (resampled.length > 0) {
            const freshIds = resampled.map((s) => s.id);
            await db
              .update(muscleGroupDays)
              .set({ plannedExerciseIds: freshIds })
              .where(eq(muscleGroupDays.id, existing.id));
            stations = buildStations(
              resampled,
              existingWindowSignals,
              existingDimFocus,
            );
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
        .select({
          id: workoutSessions.id,
          practiceSessionId: workoutSessions.practiceSessionId,
          currentStationIndex: workoutSessions.currentStationIndex,
        })
        .from(workoutSessions)
        .where(eq(workoutSessions.muscleGroupDayId, existing.id))
        .orderBy(desc(workoutSessions.createdAt))
        .limit(1);
      let workoutSessionId = activeSession?.id ?? null;
      let practiceSessionId = activeSession?.practiceSessionId ?? null;
      if (!workoutSessionId) {
        const created = await createWorkoutSession(existing.id);
        workoutSessionId = created.workoutSessionId;
        practiceSessionId = created.persisted ? created.sessionId : null;
      }

      // Resume position: prefer the persisted session index (the exact
      // station the user was on when they left), falling back to the
      // count of completed reps. Clamp into range so a stale/over-count
      // index can't push past the last station. This lands the user on the
      // station whose loop is still owed — the right place to drop back in.
      // Close to, but not always byte-identical to, the landing card's
      // status math in workout/page.tsx (that derives purely from
      // completed_reps, so it can differ by one mid-rep); resuming here is
      // still strictly better than the old hard-coded station 0.
      const lastStationIdx = Math.max(0, stations.length - 1);
      const rawResume =
        activeSession?.currentStationIndex ?? existing.completedReps ?? 0;
      const resumeStationIndex = Math.min(
        Math.max(0, rawResume),
        lastStationIdx,
      );

      return {
        dayId: existing.id,
        dimension: existing.dimension as MuscleGroupId,
        stations,
        workoutSessionId,
        practiceSessionId,
        alreadyExisted: true,
        resumeStationIndex,
        persisted: true,
      };
    }

    const chosenDim = input.dim ?? (await suggestTodaysMuscleGroup()).suggested;

    // Sample 4 exercises from the dim, deduped against recent days.
    const [available, recentDays] = await Promise.all([
      fetchCatalogExercises(chosenDim),
      fetchRecentDays(userId),
    ]);
    const [
      subSkillAverages,
      plateauedDims,
      startAssessment,
      startFocusByDim,
      startWindowSignals,
    ] = await Promise.all([
      fetchSubSkillAveragesForDim(userId, chosenDim),
      fetchPlateauedDims(userId),
      assessmentSampleExtras(userId, recentDays),
      fetchRecentFocusByDim(userId),
      // I7 — same signals as previewTodaysWorkoutPlan, so preview and
      // start produce identical stations (window included).
      windowSignalsForDim(userId, chosenDim),
    ]);
    const sampled = sampleExercises({
      available,
      recentDays,
      n: stationsPerDay(),
      seed: `${userId}:${dayDate}:${chosenDim}`,
      ...(subSkillAverages ? { subSkillAverages } : {}),
      // I4 — plateaued dim: invert sub-skill weighting (stimulus change).
      // Same inputs as previewTodaysWorkoutPlan (identical seed) so Start
      // lands on the exercises the preview showed.
      ...(plateauedDims.includes(chosenDim) ? { plateaued: true } : {}),
      // I6 — assessment days hard-prefer never-seen exercises.
      ...startAssessment,
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

    const stations = buildStations(
      sampled,
      startWindowSignals,
      startFocusByDim[chosenDim] ?? null,
    );

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
      practiceSessionId: sessionResult.persisted ? sessionResult.sessionId : null,
      alreadyExisted: false,
      // Brand-new day → always station 0.
      resumeStationIndex: 0,
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
    const [
      swapAverages,
      swapPlateaued,
      swapAssessment,
      swapFocusByDim,
      swapWindowSignals,
    ] = await Promise.all([
      fetchSubSkillAveragesForDim(userId, input.newDim),
      fetchPlateauedDims(userId),
      assessmentSampleExtras(userId, recentDays),
      fetchRecentFocusByDim(userId),
      // I7 — adaptive window for the swapped-to dim.
      windowSignalsForDim(userId, input.newDim),
    ]);
    const sampled = sampleExercises({
      available,
      recentDays,
      n: stationsPerDay(),
      seed: `${userId}:${day.dayDate}:${input.newDim}:swap`,
      ...(swapAverages ? { subSkillAverages: swapAverages } : {}),
      ...(swapPlateaued.includes(input.newDim) ? { plateaued: true } : {}),
      ...swapAssessment,
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

    const stations = buildStations(
      sampled,
      swapWindowSignals,
      swapFocusByDim[input.newDim] ?? null,
    );

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
      constraintTypes: exercises.constraintTypes,
      coachInsight: exercises.coachInsight,
    })
    .from(exercises)
    .where(inArray(exercises.id, exerciseIds));

  const byId = new Map(rows.map((r) => [r.id, r]));
  return exerciseIds
    .map((id, index): Station | null => {
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
        // Raw catalog window; the existing-day caller applies the I-7
        // adaptation (hydrateStations has no user context).
        responseWindow: row.responseWindow ?? null,
        windowAdjusted: null,
        constraintTypes: row.constraintTypes ?? null,
        coachInsight: row.coachInsight ?? null,
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
