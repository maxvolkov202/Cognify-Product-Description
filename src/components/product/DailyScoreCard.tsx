import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DailyCompositePoint } from "@/lib/db/queries/progress";

type Props = {
  points: DailyCompositePoint[];
};

/**
 * Today's snapshot — composite + rep count + delta vs yesterday.
 *
 * Reads the tail of getDailyCompositeTrend so we don't hit the DB twice.
 * Falls back gracefully:
 *   - No reps today → "No reps today" nudge.
 *   - Only one day of history → shows today's number with no delta pill.
 *
 * Lives on /progress above the weekly narrative — answers the question
 * "how did I do today" at a glance, before the user scrolls into the
 * longer trend views.
 */
export function DailyScoreCard({ points }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const todayPoint = points.find((p) => p.date === today);
  const yesterdayPoint = points.find((p) => p.date === yesterday);

  const delta =
    todayPoint && yesterdayPoint
      ? todayPoint.composite - yesterdayPoint.composite
      : null;

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            <Calendar className="size-3.5" strokeWidth={2.5} />
            Today
          </div>
          {todayPoint ? (
            <>
              <div className="mt-1 flex items-baseline gap-3">
                <p className="brand-gradient-text text-5xl font-extrabold tabular-nums">
                  {todayPoint.composite}
                </p>
                {delta !== null && <DeltaPill delta={delta} />}
              </div>
              <p className="mt-1 text-sm text-ink-600">
                Composite across {todayPoint.repCount}{" "}
                {todayPoint.repCount === 1 ? "rep" : "reps"} today.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-extrabold text-ink-400">—</p>
              <p className="mt-1 text-sm text-ink-600">
                No reps today yet. A 10-minute session will land here.
              </p>
            </>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-4 text-center md:gap-6">
          <TinyStat
            label="Yesterday"
            value={yesterdayPoint?.composite ?? null}
            suffix={
              yesterdayPoint
                ? `${yesterdayPoint.repCount} rep${yesterdayPoint.repCount === 1 ? "" : "s"}`
                : undefined
            }
          />
          <TinyStat
            label="7-day avg"
            value={sevenDayAverage(points)}
          />
        </div>
      </div>
    </div>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const rounded = Math.round(delta);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-bold text-ink-700">
        <Minus className="size-3" strokeWidth={3} />
        0
      </span>
    );
  }
  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
        <TrendingUp className="size-3" strokeWidth={3} />+{rounded}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
      <TrendingDown className="size-3" strokeWidth={3} />
      {rounded}
    </span>
  );
}

function TinyStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
        {value ?? "—"}
      </p>
      {suffix && <p className="text-[10px] text-ink-500">{suffix}</p>}
    </div>
  );
}

function sevenDayAverage(points: DailyCompositePoint[]): number | null {
  if (points.length === 0) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const recent = points.filter((p) => new Date(p.date) >= cutoff);
  if (recent.length === 0) return null;
  const sum = recent.reduce((s, p) => s + p.composite, 0);
  return Math.round(sum / recent.length);
}
