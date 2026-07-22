import type { DayActivity } from "@/lib/db/queries/progress";

type Props = {
  activity: DayActivity[];
  days?: number;
};

export function StreakHeatmap({ activity, days = 84 }: Props) {
  const byDate = new Map<string, DayActivity>();
  for (const a of activity) byDate.set(a.date, a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: Array<{ date: string; count: number; composite: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const a = byDate.get(iso);
    cells.push({
      date: iso,
      count: a?.count ?? 0,
      composite: a?.composite ?? 0,
    });
  }

  const weeks: Array<Array<(typeof cells)[number]>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    // w-full on the root is load-bearing: the flex-1 week columns can only
    // divide a definite width, so without it the aspect-square cells collapse
    // to min-content (a tiny strip). With it, cells scale to fill the card.
    <div className="w-full">
      {/* Cells scale to fill the card width (each week is a flex-1 column,
          each day an aspect-square that grows with it) so the heatmap reads
          large instead of a strip of tiny fixed squares. */}
      <div className="flex w-full gap-1 sm:gap-1.5" role="img" aria-label="Practice activity heatmap">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-1 flex-col gap-1 sm:gap-1.5">
            {week.map((cell) => (
              <div
                key={cell.date}
                className={`aspect-square w-full rounded-sm ${intensityClass(cell.count)}`}
                title={`${cell.date}: ${cell.count} rep${cell.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
        <span>Less</span>
        {[0, 1, 3, 5, 8].map((n) => (
          <div key={n} className={`size-3 rounded-sm ${intensityClass(n)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// Brand-purple ramp (#b072ff at rising opacity) so the heatmap matches
// the rest of the palette; empty cells use the ink scale so they get a
// dark-mode twin for free.
function intensityClass(count: number): string {
  if (count === 0) return "bg-ink-100 dark:bg-ink-700";
  if (count <= 1) return "bg-brand-purple/25";
  if (count <= 3) return "bg-brand-purple/50";
  if (count <= 5) return "bg-brand-purple/75";
  return "bg-brand-purple";
}
