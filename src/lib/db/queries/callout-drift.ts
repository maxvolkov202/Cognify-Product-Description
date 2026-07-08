/**
 * Phase 7 surface — read helpers for cognify_v2.callout_drift_reports.
 *
 * The weekly cron writes one row per (week_start, dimension, sub_skill,
 * verdict). The /ops/calibration/drift page reads recent weeks + flags
 * problem dims so operators can act on dim-level rubric tweaks.
 */

import { desc, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { calloutDriftReports } from "@/lib/db/schema";

export type DriftRow = {
  id: string;
  weekStart: string;
  dimension: string;
  subSkill: string | null;
  verdict: string;
  count: number;
  totalForGroup: number;
  wrongRate: number;
  flagged: boolean;
  createdAt: Date;
};

/** Pull the last N weeks of drift rows, newest first. */
export async function getRecentDrift(weeks: number = 8): Promise<DriftRow[]> {
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: calloutDriftReports.id,
      weekStart: calloutDriftReports.weekStart,
      dimension: calloutDriftReports.dimension,
      subSkill: calloutDriftReports.subSkill,
      verdict: calloutDriftReports.verdict,
      count: calloutDriftReports.count,
      totalForGroup: calloutDriftReports.totalForGroup,
      wrongRate: calloutDriftReports.wrongRate,
      flagged: calloutDriftReports.flagged,
      createdAt: calloutDriftReports.createdAt,
    })
    .from(calloutDriftReports)
    .where(gte(calloutDriftReports.createdAt, cutoff))
    .orderBy(
      desc(calloutDriftReports.weekStart),
      desc(calloutDriftReports.flagged),
      desc(calloutDriftReports.wrongRate),
    );
  return rows as DriftRow[];
}

export type DriftSummary = {
  totalRows: number;
  flaggedRows: number;
  weeksObserved: number;
  /** Most-recent week_start seen in the table, ISO date. Null when empty. */
  latestWeek: string | null;
};

export function summarizeDrift(rows: DriftRow[]): DriftSummary {
  if (rows.length === 0) {
    return { totalRows: 0, flaggedRows: 0, weeksObserved: 0, latestWeek: null };
  }
  const weeks = new Set(rows.map((r) => r.weekStart));
  const latest = rows[0]?.weekStart ?? null;
  return {
    totalRows: rows.length,
    flaggedRows: rows.filter((r) => r.flagged).length,
    weeksObserved: weeks.size,
    latestWeek: latest,
  };
}

/** Group rows by week_start → dimension → array of rows, so the page can
 *  render one panel per week with per-dim breakdowns. */
export function groupDriftByWeekAndDim(
  rows: DriftRow[],
): Array<{
  weekStart: string;
  perDimension: Array<{
    dimension: string;
    rows: DriftRow[];
    flagged: boolean;
    /** Aggregated wrong rate across all sub-skills within the dim. */
    wrongCount: number;
    totalForDim: number;
  }>;
}> {
  const byWeek = new Map<string, Map<string, DriftRow[]>>();
  for (const r of rows) {
    const wk = byWeek.get(r.weekStart) ?? new Map<string, DriftRow[]>();
    const dim = wk.get(r.dimension) ?? [];
    dim.push(r);
    wk.set(r.dimension, dim);
    byWeek.set(r.weekStart, wk);
  }

  return Array.from(byWeek.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekStart, dims]) => ({
      weekStart,
      perDimension: Array.from(dims.entries())
        .map(([dimension, dimRows]) => {
          const flagged = dimRows.some((r) => r.flagged);
          const wrongCount = dimRows
            .filter((r) => r.verdict === "wrong" || r.verdict === "not_relevant")
            .reduce((acc, r) => acc + r.count, 0);
          const totalForDim = dimRows[0]?.totalForGroup ?? 0;
          return { dimension, rows: dimRows, flagged, wrongCount, totalForDim };
        })
        .sort((a, b) => {
          if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
          return b.wrongCount - a.wrongCount;
        }),
    }));
}
