import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session/current-user";
import { RUBRIC_VERSION } from "@/lib/scoring/rubric";
import {
  getSkillTrends,
  getCurrentSkillScores,
  getActivityHeatmap,
  getRecentReps,
  getStreakDays,
  getPressureRepStats,
  getDailyCompositeTrend,
  getUserDimensionMaxes,
  getWeeklyRepSummary,
} from "@/lib/db/queries/progress";
import { SkillRadar } from "@/components/product/SkillRadar";
import { ImprovementCurve } from "@/components/product/ImprovementCurve";
import { PrintButton } from "@/components/product/PrintButton";
import { DIMENSION_LABELS } from "@/types/domain";
import type { SkillDimension } from "@/types/domain";

export const metadata = {
  title: "Progress report",
};

export default async function ReportPage() {
  const user = await currentUser();
  if (!user) redirect("/signin");

  const [
    trends,
    currentScores,
    activity,
    recentReps,
    streakDays,
    pressureStats,
    dailyCompositeTrend,
    dimensionMaxes,
    weeklySummary,
  ] = await Promise.all([
    getSkillTrends(user.id, 90),
    getCurrentSkillScores(user.id),
    getActivityHeatmap(user.id, 90),
    getRecentReps(user.id, 20),
    getStreakDays(user.id),
    getPressureRepStats(user.id, 90),
    getDailyCompositeTrend(user.id, 90),
    getUserDimensionMaxes(user.id),
    getWeeklyRepSummary(user.id),
  ]);

  const totalReps = activity.reduce((sum, a) => sum + a.count, 0);
  const avgComposite =
    recentReps.length > 0
      ? Math.round(
          recentReps.reduce((s, r) => s + r.compositeScore, 0) /
            recentReps.length,
        )
      : null;

  const peakComposite =
    dailyCompositeTrend.reduce((m, p) => Math.max(m, p.composite), 0) || null;

  const now = new Date();
  const displayName = user.name || user.email || "Trainee";

  return (
    <div className="print-report mx-auto max-w-3xl px-6 py-10 text-ink-900">
      <div className="no-print mb-6 flex items-center justify-between gap-4 rounded-xl border border-ink-200 bg-ink-50/70 px-4 py-3 text-sm">
        <div>
          <p className="font-bold text-ink-900">Progress report — print preview</p>
          <p className="text-xs text-ink-500">
            Use Print → Save as PDF in your browser for a downloadable copy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link
            href="/progress"
            className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300"
          >
            Back to progress
          </Link>
        </div>
      </div>

      <header className="border-b border-ink-200 pb-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
          Cognify · Progress report
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">
          {displayName}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Generated{" "}
          {now.toLocaleDateString(undefined, {
            dateStyle: "long",
          })}{" "}
          · Rubric {RUBRIC_VERSION}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-4 gap-4">
        <ReportStat label="Total reps" value={totalReps} />
        <ReportStat
          label="Streak"
          value={streakDays}
          suffix={streakDays === 1 ? "day" : "days"}
        />
        <ReportStat
          label="Recent avg composite"
          value={avgComposite ?? "—"}
        />
        <ReportStat
          label="Peak composite"
          value={peakComposite ?? "—"}
        />
      </section>

      {dailyCompositeTrend.length >= 2 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold text-ink-900">
            Trajectory (last 90 days)
          </h2>
          <div className="mt-4">
            <ImprovementCurve
              points={dailyCompositeTrend}
              peakComposite={peakComposite}
            />
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-6 md:grid-cols-[auto_1fr]">
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">
            Current shape
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Six-dimension radar, latest scores.
          </p>
          <div className="mt-3 flex justify-center">
            <SkillRadar scores={currentScores} size={260} />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">
            Per-dimension personal bests
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Highest score ever recorded on each dimension.
          </p>
          <ul className="mt-3 space-y-2">
            {(Object.keys(dimensionMaxes) as SkillDimension[]).map((d) => (
              <li
                key={d}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-ink-700">
                  {DIMENSION_LABELS[d]}
                </span>
                <span className="brand-gradient-text font-extrabold tabular-nums">
                  {dimensionMaxes[d] ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {weeklySummary.repCount > 0 && (
        <section className="mt-8 border-t border-ink-200 pt-6">
          <h2 className="text-lg font-extrabold text-ink-900">
            This week
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {weeklySummary.weekStartISO} → {weeklySummary.weekEndISO} · Rubric{" "}
            {RUBRIC_VERSION}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <ReportStat label="Reps" value={weeklySummary.repCount} />
            <ReportStat label="Avg composite" value={weeklySummary.averageComposite} />
            <ReportStat
              label="Weakest"
              value={
                weeklySummary.weakestDimension
                  ? DIMENSION_LABELS[weeklySummary.weakestDimension]
                  : "—"
              }
            />
          </div>
          {weeklySummary.dimensions.some((d) => d.delta != null) && (
            <ul className="mt-4 grid gap-1.5 text-xs text-ink-700">
              {weeklySummary.dimensions
                .filter((d) => d.delta !== null)
                .map((d) => (
                  <li
                    key={d.dimension}
                    className="flex items-center justify-between rounded border border-ink-100 px-3 py-1.5"
                  >
                    <span className="font-semibold">
                      {DIMENSION_LABELS[d.dimension]}
                    </span>
                    <span className="tabular-nums">
                      {d.avg ?? "—"}{" "}
                      <span
                        className={
                          (d.delta ?? 0) > 0
                            ? "text-emerald-600"
                            : (d.delta ?? 0) < 0
                              ? "text-amber-700"
                              : "text-ink-400"
                        }
                      >
                        ({(d.delta ?? 0) >= 0 ? "+" : ""}
                        {d.delta ?? 0} vs last week)
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {pressureStats.count > 0 && (
        <section className="mt-8 border-t border-ink-200 pt-6">
          <h2 className="text-lg font-extrabold text-ink-900">
            Pressure performance (last 90 days)
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {pressureStats.count} pressure reps · avg composite{" "}
            {pressureStats.avgComposite ?? "—"}
          </p>
          {pressureStats.byArchetype.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {pressureStats.byArchetype.map((a) => (
                <li
                  key={a.archetypeName}
                  className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2"
                >
                  <span className="font-semibold text-ink-700">
                    {a.archetypeName}
                  </span>
                  <span className="tabular-nums text-ink-900">
                    {a.avgComposite} avg · {a.count} reps
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-8 border-t border-ink-200 pt-6">
        <h2 className="text-lg font-extrabold text-ink-900">
          Recent reps (latest {recentReps.length})
        </h2>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-[10px] font-extrabold uppercase tracking-wider text-ink-500">
              <th className="py-2">Date</th>
              <th className="py-2">Prompt</th>
              <th className="py-2 text-right">Composite</th>
            </tr>
          </thead>
          <tbody>
            {recentReps.map((r) => (
              <tr key={r.id} className="border-b border-ink-100">
                <td className="py-2 pr-3 text-xs text-ink-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 pr-3 text-ink-800">{r.promptText}</td>
                <td className="py-2 text-right font-bold tabular-nums text-ink-900">
                  {Math.round(r.compositeScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {trends.length > 0 && (
        <p className="mt-10 border-t border-ink-200 pt-4 text-[11px] leading-relaxed text-ink-500">
          Generated by Cognify · Rubric {RUBRIC_VERSION}. Trend data reflects
          the last 90 days of reps. Personal bests are all-time maxima. All
          scoring is transcript-anchored and per-rep pinned to the rubric
          version above for historical stability.
        </p>
      )}
    </div>
  );
}

function ReportStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1 text-xl font-extrabold text-ink-900">
        <span className="tabular-nums">{value}</span>
        {suffix && <span className="text-xs font-medium text-ink-500">{suffix}</span>}
      </p>
    </div>
  );
}
