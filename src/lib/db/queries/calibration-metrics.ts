import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  users as usersTable,
  calibrationRuns,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import {
  BAND_DEFINITIONS,
  bandFor,
  type SkillDimension,
  type BandId,
} from "@/types/domain";
import { ALL_DIMENSIONS } from "@/lib/scoring/rubric";

/**
 * Cognify Ch.15 — Calibration observability queries.
 *
 * Three views into the live scoring distribution that operators need
 * to spot drift early:
 *
 *  1. `getFirstRepDistribution()` — every authenticated user's first-
 *     ever rep, bucketed by score band. The DNA spec claims new-user
 *     reps should land in the 60-75 (Competent) band ≥40% of the time;
 *     this view is how we prove that empirically.
 *
 *  2. `getCompositeDistributionByCohort()` — recent-7-day composite
 *     distribution split by cohort (new = first 5 reps; established =
 *     5+ lifetime reps; overall = both). Drift surfaces here as a
 *     histogram shift after a rubric / prompt change.
 *
 *  3. `getInterDimensionCorrelation()` — Pearson correlation between
 *     every pair of dimensions across the recent-7-day rep population.
 *     Off-diagonal cells should stay <0.6 — high correlation means
 *     the LLM is collapsing dimensions into one signal (e.g. scoring
 *     Structure and Conciseness identically), which the edge-case
 *     rules + Ch.11 signals are supposed to prevent.
 *
 * All three queries are read-only against the existing reps +
 * dimension_scores tables. The nightly drift cron + the
 * `calibration_runs` history table from the source plan are deferred
 * until Anthropic credits are restored — they need live calibration
 * harness runs to populate, which today fast-fails into the mock
 * fallback.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ——— First-rep distribution ————————————————————————————————

export type FirstRepDistribution = {
  total: number;
  perBand: { band: BandId; count: number; pct: number }[];
  /** Spec target: ≥40% of first reps land in the Competent band
   *  (60-75). True when the actual percentage meets that bar. */
  competentTargetMet: boolean;
};

export async function getFirstRepDistribution(): Promise<FirstRepDistribution> {
  return safeDb<FirstRepDistribution>(async () => {
    // For each authenticated user, find the OLDEST rep. We pull all
    // reps ranked by (userId, createdAt asc) and dedup by userId in
    // memory. Cheap enough at our current scale; if/when this gets
    // expensive a window function (ROW_NUMBER) would land it in one
    // round-trip.
    const rows = await db
      .select({
        userId: reps.userId,
        composite: reps.compositeScore,
        createdAt: reps.createdAt,
      })
      .from(reps)
      .innerJoin(usersTable, eq(reps.userId, usersTable.id))
      .orderBy(asc(reps.createdAt));

    const seen = new Set<string>();
    const composites: number[] = [];
    for (const r of rows) {
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      if (r.composite != null) composites.push(r.composite);
    }

    const counts = new Map<BandId, number>();
    for (const b of BAND_DEFINITIONS) counts.set(b.id, 0);
    for (const c of composites) {
      const band = bandFor(c);
      counts.set(band.id, (counts.get(band.id) ?? 0) + 1);
    }
    const total = composites.length;
    const perBand = BAND_DEFINITIONS.map((b) => {
      const count = counts.get(b.id) ?? 0;
      return {
        band: b.id,
        count,
        pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    });

    const competentCount = counts.get("competent") ?? 0;
    const competentTargetMet =
      total > 0 && competentCount / total >= 0.4;

    return { total, perBand, competentTargetMet };
  }, {
    total: 0,
    perBand: BAND_DEFINITIONS.map((b) => ({
      band: b.id,
      count: 0,
      pct: 0,
    })),
    competentTargetMet: false,
  });
}

// ——— Composite distribution by cohort ————————————————————————

export type CohortId = "new" | "established" | "all";

export type CompositeDistribution = {
  cohort: CohortId;
  total: number;
  perBand: { band: BandId; count: number; pct: number }[];
};

/** Bucket recent-7-day reps by cohort and band. `cohort` decides which
 *  reps count: "new" = users on their first 5 reps, "established" =
 *  users with 5+ lifetime reps, "all" = both. */
export async function getCompositeDistributionByCohort(
  cohort: CohortId,
): Promise<CompositeDistribution> {
  return safeDb<CompositeDistribution>(async () => {
    const since = new Date(Date.now() - SEVEN_DAYS_MS);

    // Two queries: lifetime rep count per user (for the cohort gate)
    // and recent reps with composite. Combined client-side to keep the
    // SQL portable across drizzle's joins.
    const lifetimeRows = await db
      .select({
        userId: reps.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(reps)
      .groupBy(reps.userId);
    const lifetimeMap = new Map<string, number>(
      lifetimeRows.map((r) => [r.userId, r.count]),
    );

    const recentRows = await db
      .select({
        userId: reps.userId,
        composite: reps.compositeScore,
      })
      .from(reps)
      .where(and(gte(reps.createdAt, since)));

    const composites: number[] = [];
    for (const r of recentRows) {
      if (r.composite == null) continue;
      const lifetime = lifetimeMap.get(r.userId) ?? 0;
      if (cohort === "new" && lifetime > 5) continue;
      if (cohort === "established" && lifetime <= 5) continue;
      composites.push(r.composite);
    }

    const counts = new Map<BandId, number>();
    for (const b of BAND_DEFINITIONS) counts.set(b.id, 0);
    for (const c of composites) {
      counts.set(bandFor(c).id, (counts.get(bandFor(c).id) ?? 0) + 1);
    }
    const total = composites.length;
    const perBand = BAND_DEFINITIONS.map((b) => {
      const count = counts.get(b.id) ?? 0;
      return {
        band: b.id,
        count,
        pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    });

    return { cohort, total, perBand };
  }, {
    cohort,
    total: 0,
    perBand: BAND_DEFINITIONS.map((b) => ({
      band: b.id,
      count: 0,
      pct: 0,
    })),
  });
}

// ——— Inter-dimension correlation matrix ————————————————————

export type InterDimensionCorrelation = {
  dimensions: readonly SkillDimension[];
  /** rows[i][j] is the Pearson correlation between dimensions[i] and
   *  dimensions[j] across the recent-7-day rep population. Diagonals
   *  are 1.0; the matrix is symmetric. Null cells when one of the dims
   *  has too few observations to compute. */
  matrix: (number | null)[][];
  /** Sample size used for the correlation. */
  sampleSize: number;
};

export async function getInterDimensionCorrelation(): Promise<InterDimensionCorrelation> {
  return safeDb<InterDimensionCorrelation>(async () => {
    const since = new Date(Date.now() - SEVEN_DAYS_MS);

    // Pull recent reps with all six dim scores joined. Group by repId
    // so we can build a per-rep vector across dims.
    const rows = await db
      .select({
        repId: dimensionScores.repId,
        dimension: dimensionScores.dimension,
        score: dimensionScores.score,
        createdAt: reps.createdAt,
      })
      .from(dimensionScores)
      .innerJoin(reps, eq(dimensionScores.repId, reps.id))
      .where(gte(reps.createdAt, since))
      .orderBy(desc(reps.createdAt));

    // Build per-rep vector — { dim → score }.
    const perRep = new Map<string, Partial<Record<SkillDimension, number>>>();
    for (const r of rows) {
      const dim = r.dimension as SkillDimension;
      if (!ALL_DIMENSIONS.includes(dim)) continue;
      const vec = perRep.get(r.repId) ?? {};
      vec[dim] = r.score;
      perRep.set(r.repId, vec);
    }

    // Per-dim arrays of scores from reps that have BOTH dims populated
    // (for each pair). Pearson requires paired observations.
    const matrix: (number | null)[][] = ALL_DIMENSIONS.map(() =>
      ALL_DIMENSIONS.map(() => null),
    );
    for (let i = 0; i < ALL_DIMENSIONS.length; i++) {
      for (let j = 0; j < ALL_DIMENSIONS.length; j++) {
        if (i === j) {
          matrix[i]![j] = 1;
          continue;
        }
        if (j < i) {
          // Symmetric — fill from the lower triangle once we've
          // computed the upper.
          matrix[i]![j] = matrix[j]![i] ?? null;
          continue;
        }
        const dimA = ALL_DIMENSIONS[i]!;
        const dimB = ALL_DIMENSIONS[j]!;
        const xs: number[] = [];
        const ys: number[] = [];
        for (const vec of perRep.values()) {
          const a = vec[dimA];
          const b = vec[dimB];
          if (typeof a === "number" && typeof b === "number") {
            xs.push(a);
            ys.push(b);
          }
        }
        matrix[i]![j] = pearson(xs, ys);
      }
    }

    return {
      dimensions: ALL_DIMENSIONS,
      matrix,
      sampleSize: perRep.size,
    };
  }, {
    dimensions: ALL_DIMENSIONS,
    matrix: ALL_DIMENSIONS.map(() => ALL_DIMENSIONS.map(() => null)),
    sampleSize: 0,
  });
}

// ——— Drift-cron history ————————————————————————————————

export type DriftRunRow = {
  ranAt: Date;
  runId: string;
  refRepId: string;
  expectedComposite: number | null;
  actualComposite: number | null;
  deltaComposite: number | null;
  status: string | null;
  modelVersion: string | null;
  alertSentAt: Date | null;
};

export type DriftRunSummary = {
  runId: string;
  ranAt: Date;
  totalReps: number;
  okCount: number;
  driftCount: number;
  fallbackCount: number;
  errorCount: number;
  /** Average absolute composite delta across the run's ref reps. Null
   *  when no ref rep produced a real composite. */
  avgAbsDelta: number | null;
  /** Worst composite drift (largest |delta|) in the run. */
  worstDelta: number | null;
  /** Ch.C1 — when an alert webhook fired for this run, or null if no
   *  alert was sent (either because thresholds weren't met or because
   *  CALIBRATION_ALERT_WEBHOOK_URL was unconfigured). */
  alertSentAt: Date | null;
};

/** Last `limit` calibration runs grouped + summarized. Drives the
 *  /ops/calibration drift-history section. Returns most-recent first. */
export async function getRecentDriftRuns(
  limit = 7,
): Promise<DriftRunSummary[]> {
  return safeDb<DriftRunSummary[]>(async () => {
    const rows = await db
      .select({
        ranAt: calibrationRuns.ranAt,
        runId: calibrationRuns.runId,
        refRepId: calibrationRuns.refRepId,
        expectedComposite: calibrationRuns.expectedComposite,
        actualComposite: calibrationRuns.actualComposite,
        deltaComposite: calibrationRuns.deltaComposite,
        status: calibrationRuns.status,
        modelVersion: calibrationRuns.modelVersion,
        alertSentAt: calibrationRuns.alertSentAt,
      })
      .from(calibrationRuns)
      .orderBy(desc(calibrationRuns.ranAt))
      .limit(limit * 30);

    // Group by runId; preserve most-recent-first run order.
    const byRun = new Map<string, DriftRunRow[]>();
    const runOrder: string[] = [];
    for (const r of rows) {
      if (!byRun.has(r.runId)) {
        runOrder.push(r.runId);
        if (runOrder.length > limit) {
          // Already past the requested run cap — drop the rest.
          break;
        }
      }
      const arr = byRun.get(r.runId) ?? [];
      arr.push(r as DriftRunRow);
      byRun.set(r.runId, arr);
    }

    const summaries: DriftRunSummary[] = [];
    for (const runId of runOrder.slice(0, limit)) {
      const runRows = byRun.get(runId) ?? [];
      if (runRows.length === 0) continue;
      const ranAt = runRows.reduce<Date>(
        (latest, r) => (r.ranAt > latest ? r.ranAt : latest),
        runRows[0]!.ranAt,
      );
      const realDeltas = runRows
        .map((r) => r.deltaComposite)
        .filter((d): d is number => typeof d === "number");
      const avgAbsDelta =
        realDeltas.length > 0
          ? Math.round(
              (realDeltas.reduce((s, v) => s + Math.abs(v), 0) /
                realDeltas.length) *
                10,
            ) / 10
          : null;
      const worstDelta =
        realDeltas.length > 0
          ? realDeltas.reduce<number>(
              (worst, d) => (Math.abs(d) > Math.abs(worst) ? d : worst),
              realDeltas[0]!,
            )
          : null;
      const alertSentAt =
        runRows.find((r) => r.alertSentAt != null)?.alertSentAt ?? null;
      summaries.push({
        runId,
        ranAt,
        totalReps: runRows.length,
        okCount: runRows.filter((r) => r.status === "ok").length,
        driftCount: runRows.filter((r) => r.status === "drift").length,
        fallbackCount: runRows.filter((r) => r.status === "fallback").length,
        errorCount: runRows.filter((r) => r.status === "error").length,
        avgAbsDelta,
        worstDelta,
        alertSentAt,
      });
    }

    return summaries;
  }, []);
}

/**
 * Phase B follow-up — per-exercise scoring drift slice.
 *
 * Aggregates scoring_telemetry rows (Phase 8 added exercise_id +
 * muscle_group_day_id) by exercise. Surfaces:
 *   - rep count, mean composite, p50 composite — for spotting drift
 *     vs the exercise's own historical mean.
 *   - mock-fallback rate — caller can flag exercises that fail-open
 *     more often than the global rate.
 *   - p95 model latency — for catching the prompt-bloat case where
 *     adding the <exercise/> block + RAG dim hint pushed an exercise's
 *     latency above the 8s budget.
 *
 * Window: last 30d. Rows with NULL exercise_id (legacy Skill Lab /
 * scenario reps) excluded — they're already covered by the all-rep
 * /ops/calibration page.
 */
export type PerExerciseDriftRow = {
  exerciseId: string;
  slug: string;
  name: string;
  dimension: string;
  repCount: number;
  meanComposite: number | null;
  p50Composite: number | null;
  mockFallbackRate: number; // 0..1
  p95ModelDurationMs: number | null;
  lastSeenAt: Date | null;
};

const PER_EXERCISE_WINDOW_DAYS = 30;

export async function getPerExerciseDrift(): Promise<PerExerciseDriftRow[]> {
  return safeDb<PerExerciseDriftRow[]>(async () => {
    const since = new Date(
      Date.now() - PER_EXERCISE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    // Single grouped query — pulls all stats per exercise in one
    // round-trip. percentile_cont() for p50/p95 is index-friendly enough
    // here because the exercise_id index narrows the scan first.
    const rows = await db.execute<{
      exercise_id: string;
      slug: string;
      name: string;
      dimension: string;
      rep_count: string;
      mean_composite: number | null;
      p50_composite: number | null;
      mock_fallback_count: string;
      p95_model_ms: number | null;
      last_seen_at: Date | null;
    }>(sql`
      SELECT
        t.exercise_id::text AS exercise_id,
        e.slug,
        e.name,
        e.dimension::text AS dimension,
        COUNT(*)::text AS rep_count,
        AVG(t.composite_score)::float AS mean_composite,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY t.composite_score)::float AS p50_composite,
        SUM(CASE WHEN t.model_used = 'mock-fallback-v1' THEN 1 ELSE 0 END)::text AS mock_fallback_count,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY t.model_duration_ms)::float AS p95_model_ms,
        MAX(t.created_at) AS last_seen_at
      FROM cognify_v2.scoring_telemetry t
      JOIN cognify_v2.exercises e ON e.id = t.exercise_id
      WHERE t.exercise_id IS NOT NULL
        AND t.created_at >= ${since}
      GROUP BY t.exercise_id, e.slug, e.name, e.dimension
      ORDER BY COUNT(*) DESC
    `);

    return rows.map((r) => {
      const count = parseInt(r.rep_count, 10);
      const mockCount = parseInt(r.mock_fallback_count, 10);
      return {
        exerciseId: r.exercise_id,
        slug: r.slug,
        name: r.name,
        dimension: r.dimension,
        repCount: count,
        meanComposite:
          r.mean_composite != null ? Math.round(r.mean_composite) : null,
        p50Composite:
          r.p50_composite != null ? Math.round(r.p50_composite) : null,
        mockFallbackRate: count > 0 ? mockCount / count : 0,
        p95ModelDurationMs:
          r.p95_model_ms != null ? Math.round(r.p95_model_ms) : null,
        lastSeenAt: r.last_seen_at,
      };
    });
  }, []);
}

function pearson(xs: number[], ys: number[]): number | null {
  // Need at least 5 paired observations for the correlation to be at
  // all stable; below that the noise dominates.
  if (xs.length < 5 || xs.length !== ys.length) return null;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let k = 0; k < n; k++) {
    const dx = xs[k]! - meanX;
    const dy = ys[k]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX <= 0 || denY <= 0) return null;
  const r = num / Math.sqrt(denX * denY);
  return Math.round(r * 1000) / 1000;
}
