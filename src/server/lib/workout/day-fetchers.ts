// Harness extension (wave 3) — the Daily Workout's action-local raw-SQL
// fetchers, moved out of src/server/actions/workout-day.ts.
//
// Why a separate module: these run through db.execute (postgres-js raw
// path — NO drizzle column mapping), which returns timestamptz columns
// as STRINGS. That exact class silently broke dim selection once
// already: fetchPlateauedDims called .toISOString() on a string, threw
// on every call, and safeDb ate it — plateau detection never fired
// (findings F-3/F-4, "the fallback is the lie"). The contract harness
// (scripts/contract-queries.ts) now executes each of these against the
// real dev DB — but "use server" files may only export async functions,
// and exporting these from workout-day.ts would have minted server
// actions with a forgeable userId parameter. A plain server module
// keeps them importable without widening the action surface.
//
// workout-day.ts imports everything here; behavior is unchanged.

import { cache } from "react";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { isTrainingEngineV2Enabled } from "@/lib/flags";
import { MUSCLE_GROUP_IDS, type MuscleGroupId } from "@/types/domain";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";
import { detectPlateau } from "@/lib/profile/plateau";
import type {
  EngagementSnapshot,
  RecentRepsSnapshot,
} from "@/server/lib/workout/assignment";

const REP_HISTORY_DAYS = 14;

function isMuscleGroupId(s: string): s is MuscleGroupId {
  return (MUSCLE_GROUP_IDS as readonly string[]).includes(s);
}

/** I5 (PRD §8.6.4) — per-dimension "the coach remembers last time"
 *  signal for the Insight screen. */
export type StationRecentFocus = { text: string; verdict: string | null };

/** PRD v3 Phase 3.5 — dims plateaued per detectPlateau() over the last
 *  21 days of progress snapshots. Empty when the v2 engine is off.
 *  React.cache'd (I4): the suggest path AND every exercise-sampling path
 *  read it, so dedupe within a request. */
export const fetchPlateauedDims = cache(async (
  userId: string,
): Promise<MuscleGroupId[]> => {
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
    // db.execute returns timestamptz as a STRING (postgres-js raw path —
    // no drizzle column mapping). .toISOString() on it threw on every
    // call and safeDb ate it: plateau detection has never fired. Same
    // class as F-3/F-4 ("the fallback is the lie").
    list.push({ at: new Date(r.taken_at as unknown as string).toISOString(), score: r.score });
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
});

/** I5 — the user's most recent coaching_events row per dimension, keyed
 *  by muscle group (coaching_events stores skill dims — "delivery" maps
 *  back to the "pacing" muscle group). ONE DISTINCT ON query for the
 *  whole day, React.cache'd per request. Empty when the v2 engine is
 *  off, for anonymous users, or before any Coach's Focus was delivered. */
export const fetchRecentFocusByDim = cache(async (
  userId: string,
): Promise<Partial<Record<MuscleGroupId, StationRecentFocus>>> => {
  if (!isTrainingEngineV2Enabled()) return {};
  if (userId === "anonymous") return {};
  const rows = await db.execute<{
    dimension: string;
    focus_text: string;
    implemented_verdict: string | null;
  }>(drizzleSql`
    SELECT DISTINCT ON (dimension)
      dimension::text AS dimension,
      focus_text,
      implemented_verdict
    FROM cognify_v2.coaching_events
    WHERE user_id = ${userId}
    ORDER BY dimension, created_at DESC
  `);
  const bySkillDim = new Map(rows.map((r) => [r.dimension, r]));
  const out: Partial<Record<MuscleGroupId, StationRecentFocus>> = {};
  for (const mg of MUSCLE_GROUP_IDS) {
    const skillDim = muscleGroupToSkillDim(mg);
    if (!skillDim) continue;
    const row = bySkillDim.get(skillDim);
    if (row) {
      out[mg] = { text: row.focus_text, verdict: row.implemented_verdict };
    }
  }
  return out;
});

/** I6 (PRD §8.5.3 step 2) — every exercise id the user has logged a rep
 *  against, ever. Only queried while the Assessment Phase is active (a
 *  bounded window), so the DISTINCT stays cheap. React.cache'd. */
export const fetchCompletedExerciseIds = cache(async (
  userId: string,
): Promise<Set<string>> => {
  if (userId === "anonymous") return new Set<string>();
  const rows = await db.execute<{ exercise_id: string }>(drizzleSql`
    SELECT DISTINCT exercise_id
    FROM cognify_v2.reps
    WHERE user_id = ${userId} AND exercise_id IS NOT NULL
  `);
  return new Set(rows.map((r) => r.exercise_id));
});

export async function fetchEngagement(
  userId: string,
): Promise<EngagementSnapshot[]> {
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
      lastTrainedAt: r.last_trained
        ? new Date(r.last_trained as unknown as string).toISOString()
        : null,
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

export async function fetchRecentRepsAggregates(
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
