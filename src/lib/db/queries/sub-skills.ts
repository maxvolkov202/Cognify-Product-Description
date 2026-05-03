import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reps, dimensionScores } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { decodeDimensionSignals } from "@/lib/scoring/signals";
import {
  ALL_SUB_SKILLS,
  SUB_SKILL_TO_DIMENSION,
  type SubSkillId,
} from "@/types/sub-skills";
import type { SkillDimension } from "@/types/domain";

/**
 * Per-sub-skill running average from the user's last 30 reps. Reads
 * `dimension_scores.signals` jsonb (Ch.11c shape) via
 * `decodeDimensionSignals`, then computes an exponentially-weighted
 * recent average per sub-skill — most recent rep weighted ~10x the
 * 30th-most-recent.
 *
 * Returns an entry for every sub-skill that has at least one observation
 * in the lookback window. Sub-skills with `sampleSize < SUB_SKILL_MIN_SAMPLES`
 * are still returned so the UI can render a "needs more reps" empty
 * state for them rather than hiding them entirely. The
 * `SubSkillBreakdownCard` decides what to surface.
 *
 * `trend` is the difference between the most-recent-5 average and the
 * older-25 average (positive = improving, negative = regressing). Null
 * when sample size in either window is insufficient for a stable
 * comparison.
 */
export type SubSkillStat = {
  /** Exponentially-weighted average across the lookback window. */
  avg: number;
  /** Total observations of this sub-skill in the window. */
  sampleSize: number;
  /** Newer-window mean minus older-window mean. Null when sample
   *  is too small for a meaningful split. */
  trend: number | null;
};

const SUB_SKILL_LOOKBACK = 30;
const SUB_SKILL_MIN_SAMPLES = 5;
/** Weighted-average decay factor. With 30 reps, the most-recent rep is
 *  weighted exp(0) = 1; the 30th-back rep is weighted exp(-29 * DECAY).
 *  At DECAY=0.08 the 30th rep is weighted ~0.10 of the most recent —
 *  recent reps dominate but ancient reps still contribute a thin tail. */
const DECAY = 0.08;

export async function getSubSkillRunningAverages(
  userId: string,
): Promise<Partial<Record<SubSkillId, SubSkillStat>>> {
  return safeDb<Partial<Record<SubSkillId, SubSkillStat>>>(async () => {
    // CTO-scan H1 — two-step query so we don't truncate a partial rep's
    // dim_scores. Step 1: get the user's 30 most-recent rep IDs (one
    // row per rep, deterministic by createdAt). Step 2: fetch ALL
    // dim_scores rows for those rep IDs. Eliminates the bug where the
    // earlier "limit 180 dim rows then dedup by repId" approach would
    // stop mid-rep on users with legacy enum dim entries (>6 dims/rep).
    const recentReps = await db
      .select({ id: reps.id, createdAt: reps.createdAt })
      .from(reps)
      .where(eq(reps.userId, userId))
      .orderBy(desc(reps.createdAt))
      .limit(SUB_SKILL_LOOKBACK);

    if (recentReps.length === 0) return {};

    const repIds = recentReps.map((r) => r.id);
    // Map repId → ordinal rank (most-recent = 0) for the EWA weighting.
    const repOrder = new Map<string, number>();
    for (let i = 0; i < recentReps.length; i++) {
      repOrder.set(recentReps[i]!.id, i);
    }

    const rows = await db
      .select({
        repId: dimensionScores.repId,
        dimension: dimensionScores.dimension,
        signals: dimensionScores.signals,
      })
      .from(dimensionScores)
      .where(inArray(dimensionScores.repId, repIds));

    if (rows.length === 0) return {};

    // Per-sub-skill collection — paired (rank, score) so we can compute
    // both the weighted average AND the recent/older split for trend.
    const observations = new Map<SubSkillId, { rank: number; score: number }[]>();

    for (const row of rows) {
      const rank = repOrder.get(row.repId);
      if (rank == null) continue;
      const decoded = decodeDimensionSignals(row.signals);
      const sub = decoded.subSkillScores;
      if (!sub) continue;
      for (const [subSkillKey, score] of Object.entries(sub)) {
        if (typeof score !== "number") continue;
        // Defend against on-disk drift: only accept sub-skills that map
        // to the row's dimension (signal extractor mistakes shouldn't
        // poison the running average).
        const subSkill = subSkillKey as SubSkillId;
        if (
          SUB_SKILL_TO_DIMENSION[subSkill] !== (row.dimension as SkillDimension)
        ) {
          continue;
        }
        const arr = observations.get(subSkill) ?? [];
        arr.push({ rank, score });
        observations.set(subSkill, arr);
      }
    }

    const result: Partial<Record<SubSkillId, SubSkillStat>> = {};
    for (const subSkill of ALL_SUB_SKILLS) {
      const obs = observations.get(subSkill);
      if (!obs || obs.length === 0) continue;
      // Exponentially-weighted average: weight = exp(-DECAY * rank).
      let weightedSum = 0;
      let totalWeight = 0;
      for (const { rank, score } of obs) {
        const w = Math.exp(-DECAY * rank);
        weightedSum += score * w;
        totalWeight += w;
      }
      const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // Trend: newer-5 mean minus older-25 mean. Requires ≥3 in each
      // bucket for the comparison to be meaningful.
      const newer = obs.filter((o) => o.rank < 5).map((o) => o.score);
      const older = obs.filter((o) => o.rank >= 5).map((o) => o.score);
      const trend =
        newer.length >= 3 && older.length >= 3
          ? mean(newer) - mean(older)
          : null;

      result[subSkill] = {
        avg: Math.round(avg * 10) / 10,
        sampleSize: obs.length,
        trend: trend != null ? Math.round(trend * 10) / 10 : null,
      };
    }
    return result;
  }, {});
}

function mean(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Bucket the running averages by dimension. Useful for the
 *  `SubSkillBreakdownCard` accordion which renders one section per dim. */
export type SubSkillBreakdown = Partial<
  Record<
    SkillDimension,
    {
      sampleSize: number;
      subSkills: { id: SubSkillId; stat: SubSkillStat }[];
      /** Weakest sub-skill within the dim (lowest avg) — null when no
       *  sub-skill in this dim has SUB_SKILL_MIN_SAMPLES observations. */
      weakest: { id: SubSkillId; stat: SubSkillStat } | null;
    }
  >
>;

export function bucketByDimension(
  stats: Partial<Record<SubSkillId, SubSkillStat>>,
): SubSkillBreakdown {
  const out: SubSkillBreakdown = {};
  for (const [subSkillKey, stat] of Object.entries(stats)) {
    if (!stat) continue;
    const subSkill = subSkillKey as SubSkillId;
    const dim = SUB_SKILL_TO_DIMENSION[subSkill];
    const bucket = out[dim] ?? {
      sampleSize: 0,
      subSkills: [] as { id: SubSkillId; stat: SubSkillStat }[],
      weakest: null,
    };
    bucket.subSkills.push({ id: subSkill, stat });
    bucket.sampleSize += stat.sampleSize;
    out[dim] = bucket;
  }
  for (const dim of Object.keys(out) as SkillDimension[]) {
    const bucket = out[dim]!;
    bucket.subSkills.sort((a, b) => a.stat.avg - b.stat.avg);
    const eligible = bucket.subSkills.filter(
      (s) => s.stat.sampleSize >= SUB_SKILL_MIN_SAMPLES,
    );
    bucket.weakest = eligible.length > 0 ? eligible[0]! : null;
  }
  return out;
}

/** True when ANY sub-skill has at least the minimum sample size — used
 *  by the dashboard to decide whether to render the breakdown card or
 *  fall back to the dimension-only WeakestLinkCard. */
export function hasMeaningfulSubSkillData(
  stats: Partial<Record<SubSkillId, SubSkillStat>>,
): boolean {
  for (const stat of Object.values(stats)) {
    if (stat && stat.sampleSize >= SUB_SKILL_MIN_SAMPLES) return true;
  }
  return false;
}
