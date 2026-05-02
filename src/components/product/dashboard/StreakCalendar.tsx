import { Flame } from "lucide-react";
import type { DayActivity } from "@/lib/db/queries/progress";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Last N days from getActivityHeatmap. Caller picks the window
   *  (typically 30). Items must be in chronological order; the calendar
   *  renders left-to-right oldest-to-today. */
  activity: readonly DayActivity[];
  /** Current streak length in days — surfaced as a ribbon on the right
   *  side of the calendar header. */
  currentStreakDays: number;
  className?: string;
};

/**
 * DNA Ch.9a — 30-day streak calendar grid.
 *
 * Each square is one day. Filled = a rep happened that day; opacity
 * scales with rep count (1 → 35%, 4+ → 100%). Empty days are rendered
 * as dashed outlines, not invisible — the gaps are part of the data.
 *
 * Today's square is ringed in brand-purple so the user can read the
 * "where am I?" signal at a glance.
 */
export function StreakCalendar({
  activity,
  currentStreakDays,
  className,
}: Props) {
  const today = ymd(new Date());
  const maxCount = Math.max(1, ...activity.map((d) => d.count));

  return (
    <section className={cn("surface-card p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
            <Flame className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Last {activity.length} days
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
            Each square is a day. Filled = you ran reps. Don&rsquo;t break
            the line.
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-2xl font-extrabold tabular-nums text-ink-900">
            {currentStreakDays}
          </span>
          <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
            day{currentStreakDays === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5 sm:grid-cols-[repeat(30,minmax(0,1fr))]">
        {activity.map((day) => {
          const isToday = day.date === today;
          const ratio = day.count > 0 ? day.count / maxCount : 0;
          const filled = day.count > 0;
          return (
            <span
              key={day.date}
              title={`${day.date}: ${day.count} rep${day.count === 1 ? "" : "s"}`}
              className={cn(
                "aspect-square rounded-md transition",
                filled
                  ? "brand-gradient"
                  : "border border-dashed border-ink-200",
                isToday && "ring-2 ring-brand-purple ring-offset-1",
              )}
              style={
                filled
                  ? { opacity: 0.35 + ratio * 0.65 }
                  : undefined
              }
              aria-label={`${day.date}: ${day.count} reps`}
            />
          );
        })}
      </div>
    </section>
  );
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
