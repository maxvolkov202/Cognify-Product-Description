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
    <div>
      <div className="flex gap-1" role="img" aria-label="Practice activity heatmap">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell) => (
              <div
                key={cell.date}
                className="size-3 rounded-sm"
                style={{ backgroundColor: intensityColor(cell.count) }}
                title={`${cell.date}: ${cell.count} rep${cell.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-500">
        <span>Less</span>
        {[0, 1, 3, 5, 8].map((n) => (
          <div
            key={n}
            className="size-3 rounded-sm"
            style={{ backgroundColor: intensityColor(n) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function intensityColor(count: number): string {
  if (count === 0) return "#eef0f5";
  if (count <= 1) return "#d4d1ff";
  if (count <= 3) return "#a8a0ff";
  if (count <= 5) return "#8a7cff";
  return "#6956ff";
}
