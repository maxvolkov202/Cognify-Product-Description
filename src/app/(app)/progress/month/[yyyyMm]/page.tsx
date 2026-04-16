import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Sparkles, Target, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import {
  getSkillTrends,
  getRepsForDateRange,
} from "@/lib/db/queries/progress";
import { buildMonthlyReport } from "@/lib/insights/narrative";
import { DIMENSION_LABELS } from "@/types/domain";

type Params = { yyyyMm: string };

const YM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export default async function MonthlyReportPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { yyyyMm } = await params;
  if (!YM_RE.test(yyyyMm)) notFound();

  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  const [yearStr, monthStr] = yyyyMm.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const monthLabel = start.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  // 90-day trend window ensures we cover full month even for long months.
  const [trends, reps] = await Promise.all([
    getSkillTrends(userId, 90),
    getRepsForDateRange(userId, start.toISOString(), end.toISOString()),
  ]);

  const report = buildMonthlyReport(
    yyyyMm,
    trends,
    reps.map((r) => ({
      createdAt: r.createdAt,
      composite: r.compositeScore,
    })),
  );

  // Day-by-day composites within the month for the mini calendar grid.
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDay = new Map<number, { count: number; avg: number }>();
  for (const r of reps) {
    const day = new Date(r.createdAt).getDate();
    const cur = byDay.get(day) ?? { count: 0, avg: 0 };
    cur.avg = (cur.avg * cur.count + r.compositeScore) / (cur.count + 1);
    cur.count += 1;
    byDay.set(day, cur);
  }

  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);
  const prevYm = toYearMonth(prevMonth);
  const nextYm = toYearMonth(nextMonth);
  const nextIsFuture = nextMonth > new Date();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/progress"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3" />
        Progress
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Monthly report
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            {monthLabel}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/progress/month/${prevYm}`}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300"
          >
            ← {prettyYm(prevYm)}
          </Link>
          {!nextIsFuture && (
            <Link
              href={`/progress/month/${nextYm}`}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300"
            >
              {prettyYm(nextYm)} →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 surface-card p-6">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          <Sparkles className="size-3 text-brand-purple" strokeWidth={3} />
          Summary
        </p>
        <p className="mt-2 text-base leading-relaxed text-ink-800">
          {report.narrative}
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<Calendar className="size-4 text-white" />}
          label="Reps"
          value={report.repCount.toString()}
        />
        <StatCard
          icon={<TrendingUp className="size-4 text-white" />}
          label="Avg composite"
          value={report.repCount > 0 ? Math.round(report.avgComposite).toString() : "—"}
        />
        <StatCard
          icon={<Sparkles className="size-4 text-white" />}
          label="Top dimension"
          value={
            report.topDimension
              ? DIMENSION_LABELS[report.topDimension.dimension]
              : "—"
          }
          suffix={
            report.topDimension
              ? `avg ${Math.round(report.topDimension.avg)}`
              : undefined
          }
        />
        <StatCard
          icon={<Target className="size-4 text-white" />}
          label="Opportunity"
          value={
            report.weakest ? DIMENSION_LABELS[report.weakest.dimension] : "—"
          }
          suffix={
            report.weakest ? `avg ${Math.round(report.weakest.avg)}` : undefined
          }
        />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        {/* Month calendar grid */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-extrabold text-ink-900">
            Day by day
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Each square shows your average composite that day.
          </p>
          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const entry = byDay.get(day);
              const composite = entry?.avg ?? 0;
              const count = entry?.count ?? 0;
              const bg =
                count === 0
                  ? "border-2 border-dashed border-ink-200 bg-white text-ink-400"
                  : composite >= 80
                    ? "bg-success text-white"
                    : composite >= 60
                      ? "bg-success/60 text-white"
                      : "bg-amber-400 text-ink-900";
              return (
                <div
                  key={day}
                  className={`grid aspect-square place-items-center rounded-lg text-[11px] font-bold ${bg}`}
                  title={
                    count === 0
                      ? `Day ${day}: no reps`
                      : `Day ${day}: ${count} rep${count === 1 ? "" : "s"}, avg ${Math.round(composite)}`
                  }
                >
                  {count === 0 ? day : Math.round(composite)}
                </div>
              );
            })}
          </div>
        </section>

        {/* Most improved + full dimension breakdown */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-extrabold text-ink-900">
            Dimension movement
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Early-month vs late-month average per dimension.
          </p>
          <ul className="mt-4 space-y-3">
            {trends.map((t) => {
              const points = t.points.filter((p) => {
                const date = p.takenAt;
                return date >= start && date < end;
              });
              if (points.length < 2) return null;
              const third = Math.max(1, Math.floor(points.length / 3));
              const sorted = [...points].sort(
                (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
              );
              const early = sorted.slice(0, third);
              const late = sorted.slice(-third);
              const earlyAvg =
                early.reduce((s, p) => s + p.score, 0) / early.length;
              const lateAvg =
                late.reduce((s, p) => s + p.score, 0) / late.length;
              const delta = lateAvg - earlyAvg;
              const deltaStr =
                delta > 0 ? `+${Math.round(delta)}` : Math.round(delta).toString();
              const color =
                delta >= 3
                  ? "text-success"
                  : delta <= -3
                    ? "text-danger"
                    : "text-ink-500";
              return (
                <li
                  key={t.dimension}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-ink-700">
                    {DIMENSION_LABELS[t.dimension]}
                  </span>
                  <span className="tabular-nums text-ink-500">
                    {Math.round(earlyAvg)} → {Math.round(lateAvg)}
                  </span>
                  <span className={`font-bold tabular-nums ${color}`}>
                    {deltaStr}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        <span className="brand-gradient grid size-6 place-items-center rounded-md">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-lg font-extrabold text-ink-900">
        {value}
      </p>
      {suffix && <p className="text-[11px] text-ink-500">{suffix}</p>}
    </div>
  );
}

function toYearMonth(d: Date): string {
  const m = d.getMonth() + 1;
  return `${d.getFullYear()}-${m.toString().padStart(2, "0")}`;
}

function prettyYm(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, 1);
  return d.toLocaleString("en-US", { month: "short" });
}
