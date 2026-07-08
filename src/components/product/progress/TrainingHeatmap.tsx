"use client";

// Phase 9 — SVG day-of-week × time-of-day heatmap. 7 rows × 4 cols
// (early/morning/afternoon/evening). Each cell shaded by count.

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

export type HeatmapPoint = {
  /** Day of week, 0 = Sunday. */
  dow: number;
  /** Hour of day, 0..23. */
  hour: number;
};

export type TrainingHeatmapProps = {
  points: HeatmapPoint[];
  className?: string;
  color?: string;
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BUCKETS = [
  { label: "Early", from: 4, to: 8 },
  { label: "Morning", from: 8, to: 12 },
  { label: "Afternoon", from: 12, to: 17 },
  { label: "Evening", from: 17, to: 24 },
];

export default function TrainingHeatmap({
  points,
  className,
  color = "#7fd6c8",
}: TrainingHeatmapProps) {
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: BUCKETS.length }, () => 0),
    );
    for (const p of points) {
      const colIdx = BUCKETS.findIndex(
        (b) => p.hour >= b.from && p.hour < b.to,
      );
      if (colIdx >= 0 && p.dow >= 0 && p.dow < 7) {
        g[p.dow]![colIdx]!++;
      }
    }
    const max = Math.max(1, ...g.flat());
    return { cells: g, max };
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-800 bg-slate-900/30 p-6 text-center text-sm text-slate-500",
          className,
        )}
      >
        Not enough rep data yet to build a training-time heatmap.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-800 bg-slate-900/30 p-3",
        className,
      )}
      role="figure"
      aria-label="Training time heatmap by day of week"
    >
      <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-1 text-[10px] text-slate-500">
        <div />
        {BUCKETS.map((b) => (
          <div key={b.label} className="text-center">
            {b.label}
          </div>
        ))}
        {grid.cells.map((row, dow) => (
          <Row key={dow} dow={dow} row={row} max={grid.max} color={color} />
        ))}
      </div>
    </div>
  );
}

function Row({
  dow,
  row,
  max,
  color,
}: {
  dow: number;
  row: number[];
  max: number;
  color: string;
}) {
  return (
    <>
      <div className="text-right pr-1 self-center text-slate-400">
        {DOW_LABELS[dow]}
      </div>
      {row.map((count, i) => {
        const intensity = count === 0 ? 0 : 0.15 + 0.85 * (count / max);
        return (
          <div
            key={i}
            className="aspect-square min-h-[32px] rounded"
            style={{
              backgroundColor: color,
              opacity: intensity,
            }}
            title={`${DOW_LABELS[dow]} ${["Early", "Morning", "Afternoon", "Evening"][i]}: ${count}`}
          />
        );
      })}
    </>
  );
}
