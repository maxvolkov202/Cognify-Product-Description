import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reps, dimensionScores, users as usersTable } from "@/lib/db/schema";
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
