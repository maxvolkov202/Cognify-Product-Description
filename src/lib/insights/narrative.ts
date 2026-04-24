import type { SkillTrend } from "@/lib/db/queries/progress";
import { DIMENSION_LABELS, type SkillDimension } from "@/types/domain";

/**
 * Pure functions that turn raw dimension/composite history into 3 narrative
 * sentences for the dashboard's "This week" card and /progress "Story" tab.
 *
 * No LLM. No randomness. Deterministic — same inputs produce same outputs,
 * which matters for telemetry and caching.
 */

export type NarrativeInsight = {
  kind: "improvement" | "strength" | "steady" | "regression" | "opportunity";
  dimension: SkillDimension | null;
  text: string;
};

type DailyDim = {
  dimension: SkillDimension;
  /** Average for reps this ISO week (Monday → now, UTC). */
  avg7: number;
  /** Average for reps in the preceding ISO week. Used for delta. */
  avgPrevWeek: number;
  count7: number;
  latest: number;
};

export function buildNarrativeInsights(
  trends: SkillTrend[],
  compositeRecent?: number | null,
): NarrativeInsight[] {
  // Week starts Monday UTC — matches getWeeklyRepSummary() so the
  // dashboard's "This week" card and /progress's weekly panel agree.
  // Rolling-7-day windows misfire on day 7 (a rep from exactly 7 days ago
  // falls just outside depending on the hour-of-day of both timestamps),
  // so a strict ISO-week boundary gives the user deterministic semantics.
  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - dayOfWeek);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

  const perDim: DailyDim[] = trends.map((t) => {
    const last7 = t.points.filter((p) => p.takenAt >= thisWeekStart);
    const last14 = t.points.filter(
      (p) => p.takenAt >= lastWeekStart && p.takenAt < thisWeekStart,
    );
    const avg = (arr: { score: number }[]) =>
      arr.length === 0
        ? 0
        : arr.reduce((s, x) => s + x.score, 0) / arr.length;
    return {
      dimension: t.dimension,
      avg7: avg(last7),
      avgPrevWeek: avg(last14),
      count7: last7.length,
      latest: t.points[t.points.length - 1]?.score ?? 0,
    };
  });

  const hasThisWeekData = perDim.some((d) => d.count7 > 0);
  if (!hasThisWeekData) {
    // Distinguish "never trained" from "haven't trained this week yet".
    // Dashboard's outer hasAnyReps check already filters brand-new users
    // into a dedicated empty state, but this narrative is also reached
    // via /progress where `trends` may carry prior-week data.
    const hasEverTrained = trends.some((t) => t.points.length > 0);
    return [
      {
        kind: "opportunity",
        dimension: null,
        text: hasEverTrained
          ? "No reps this week yet. A 10-minute workout puts you back on the board."
          : "Log your first rep to start seeing your weekly story here.",
      },
    ];
  }

  const insights: NarrativeInsight[] = [];

  // 1. Biggest mover (improvement OR regression)
  const movers = perDim
    .filter((d) => d.count7 > 0 && d.avgPrevWeek > 0)
    .map((d) => ({
      ...d,
      delta: d.avg7 - d.avgPrevWeek,
      pctDelta: d.avgPrevWeek > 0 ? ((d.avg7 - d.avgPrevWeek) / d.avgPrevWeek) * 100 : 0,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const topMover = movers[0];
  if (topMover && Math.abs(topMover.delta) >= 3) {
    if (topMover.delta > 0) {
      insights.push({
        kind: "improvement",
        dimension: topMover.dimension,
        text: `${DIMENSION_LABELS[topMover.dimension]} is up ${Math.round(topMover.pctDelta)}% from the week before — average ${Math.round(topMover.avgPrevWeek)} → ${Math.round(topMover.avg7)}.`,
      });
    } else {
      insights.push({
        kind: "regression",
        dimension: topMover.dimension,
        text: `${DIMENSION_LABELS[topMover.dimension]} slipped ${Math.abs(Math.round(topMover.pctDelta))}% from last week (${Math.round(topMover.avgPrevWeek)} → ${Math.round(topMover.avg7)}). Worth a focus rep.`,
      });
    }
  }

  // 2. Current strength (highest recent avg, if ≥75)
  const ranked = [...perDim]
    .filter((d) => d.count7 > 0)
    .sort((a, b) => b.avg7 - a.avg7);
  const strongest = ranked[0];
  if (
    strongest &&
    strongest.avg7 >= 75 &&
    strongest.dimension !== topMover?.dimension
  ) {
    insights.push({
      kind: "strength",
      dimension: strongest.dimension,
      text: `${DIMENSION_LABELS[strongest.dimension]} is your strongest dimension this week — averaging ${Math.round(strongest.avg7)}.`,
    });
  }

  // 3. Biggest opportunity (lowest recent avg that isn't already flagged)
  const weakest = [...ranked].reverse()[0];
  if (
    weakest &&
    weakest.dimension !== topMover?.dimension &&
    weakest.dimension !== strongest?.dimension
  ) {
    insights.push({
      kind: "opportunity",
      dimension: weakest.dimension,
      text: `${DIMENSION_LABELS[weakest.dimension]} is holding steady around ${Math.round(weakest.avg7)} — your biggest opportunity to move the composite.`,
    });
  }

  // If we somehow didn't fill 3, top up with a steady-state fact.
  while (insights.length < 3 && ranked.length > 0) {
    const fill = ranked.find(
      (d) => !insights.some((i) => i.dimension === d.dimension),
    );
    if (!fill) break;
    insights.push({
      kind: "steady",
      dimension: fill.dimension,
      text: `${DIMENSION_LABELS[fill.dimension]} is steady at ${Math.round(fill.avg7)} this week.`,
    });
  }

  // Prepend a composite summary if we have one
  if (typeof compositeRecent === "number" && compositeRecent > 0) {
    insights.unshift({
      kind: "steady",
      dimension: null,
      text: `Your recent composite is ${Math.round(compositeRecent)}.`,
    });
  }

  return insights.slice(0, 4);
}

// ——— Monthly report summary ——————————————————————————————
export type MonthlyReport = {
  yearMonth: string;
  repCount: number;
  avgComposite: number;
  topDimension: { dimension: SkillDimension; avg: number } | null;
  mostImproved: {
    dimension: SkillDimension;
    delta: number;
    earlyAvg: number;
    lateAvg: number;
  } | null;
  weakest: { dimension: SkillDimension; avg: number } | null;
  narrative: string;
};

export function buildMonthlyReport(
  yearMonth: string,
  trends: SkillTrend[],
  repComposites: { createdAt: Date; composite: number }[],
): MonthlyReport {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const inMonth = (d: Date) => d >= start && d < end;

  const reps = repComposites.filter((r) => inMonth(r.createdAt));
  const avgComposite =
    reps.length === 0
      ? 0
      : reps.reduce((s, r) => s + r.composite, 0) / reps.length;

  const perDimStats = trends.map((t) => {
    const monthPoints = t.points.filter((p) => inMonth(p.takenAt));
    const avg =
      monthPoints.length === 0
        ? 0
        : monthPoints.reduce((s, x) => s + x.score, 0) / monthPoints.length;
    // Early vs late split (first third vs last third of points in month)
    const sorted = [...monthPoints].sort(
      (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
    );
    const third = Math.max(1, Math.floor(sorted.length / 3));
    const early = sorted.slice(0, third);
    const late = sorted.slice(-third);
    const earlyAvg =
      early.length === 0
        ? 0
        : early.reduce((s, x) => s + x.score, 0) / early.length;
    const lateAvg =
      late.length === 0 ? 0 : late.reduce((s, x) => s + x.score, 0) / late.length;
    return {
      dimension: t.dimension,
      avg,
      earlyAvg,
      lateAvg,
      delta: lateAvg - earlyAvg,
      count: monthPoints.length,
    };
  });

  const present = perDimStats.filter((s) => s.count > 0);

  const topDimension =
    present.length === 0
      ? null
      : present.reduce((a, b) => (a.avg > b.avg ? a : b));
  const weakest =
    present.length === 0
      ? null
      : present.reduce((a, b) => (a.avg < b.avg ? a : b));
  const mostImproved =
    present.length === 0
      ? null
      : present.reduce((a, b) => (a.delta > b.delta ? a : b));

  const monthLabel = start.toLocaleString("en-US", { month: "long" });

  const narrativeBits: string[] = [];
  if (reps.length > 0) {
    narrativeBits.push(
      `In ${monthLabel} you completed ${reps.length} rep${reps.length === 1 ? "" : "s"}. Composite averaged ${Math.round(avgComposite)}.`,
    );
  } else {
    narrativeBits.push(
      `No reps logged in ${monthLabel} yet. Start a workout to begin building your report.`,
    );
  }
  if (mostImproved && mostImproved.delta >= 3) {
    narrativeBits.push(
      `${DIMENSION_LABELS[mostImproved.dimension]} improved from ${Math.round(mostImproved.earlyAvg)} to ${Math.round(mostImproved.lateAvg)}.`,
    );
  }
  if (weakest && weakest.avg < 70) {
    narrativeBits.push(
      `${DIMENSION_LABELS[weakest.dimension]} is still your biggest opportunity at avg ${Math.round(weakest.avg)}.`,
    );
  }
  if (topDimension && topDimension.avg >= 75 && topDimension !== weakest) {
    narrativeBits.push(
      `${DIMENSION_LABELS[topDimension.dimension]} is your strongest dimension at avg ${Math.round(topDimension.avg)}.`,
    );
  }

  return {
    yearMonth,
    repCount: reps.length,
    avgComposite,
    topDimension: topDimension
      ? { dimension: topDimension.dimension, avg: topDimension.avg }
      : null,
    mostImproved:
      mostImproved && mostImproved.count >= 3
        ? {
            dimension: mostImproved.dimension,
            delta: mostImproved.delta,
            earlyAvg: mostImproved.earlyAvg,
            lateAvg: mostImproved.lateAvg,
          }
        : null,
    weakest: weakest ? { dimension: weakest.dimension, avg: weakest.avg } : null,
    narrative: narrativeBits.join(" "),
  };
}
