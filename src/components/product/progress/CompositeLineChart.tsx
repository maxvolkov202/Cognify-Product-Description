"use client";

// Phase 9 — SVG-only composite-over-time line chart. No deps.
//
// Renders a sparkline-style composite trend with axis ticks. Responsive
// via viewBox + preserveAspectRatio. Reduced-motion respected (no
// stroke-dash animations).

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

export type CompositeLineChartProps = {
  points: Array<{ date: string; composite: number | null }>;
  className?: string;
  color?: string;
  height?: number;
};

const DEFAULT_VIEW_W = 600;
const DEFAULT_VIEW_H = 200;
const PADDING = { top: 16, right: 16, bottom: 32, left: 32 };

export default function CompositeLineChart({
  points,
  className,
  color = "#e77cf0",
  height = 200,
}: CompositeLineChartProps) {
  const view = useMemo(() => {
    const valid = points.filter(
      (p): p is { date: string; composite: number } => p.composite != null,
    );
    if (valid.length === 0) {
      return null;
    }
    const composites = valid.map((p) => p.composite);
    const min = Math.min(...composites, 40);
    const max = Math.max(...composites, 100);
    const range = Math.max(10, max - min);
    const w = DEFAULT_VIEW_W;
    const h = DEFAULT_VIEW_H;
    const chartW = w - PADDING.left - PADDING.right;
    const chartH = h - PADDING.top - PADDING.bottom;

    const xs = (i: number) =>
      PADDING.left + (i / Math.max(1, valid.length - 1)) * chartW;
    const ys = (v: number) =>
      PADDING.top + (1 - (v - min) / range) * chartH;

    const pathD = valid
      .map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.composite).toFixed(1)}`)
      .join(" ");
    return {
      w,
      h,
      pathD,
      points: valid.map((p, i) => ({
        x: xs(i),
        y: ys(p.composite),
        composite: p.composite,
        date: p.date,
      })),
      min,
      max,
    };
  }, [points]);

  if (!view) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-800 bg-slate-900/30 p-6 text-center text-sm text-slate-500",
          className,
        )}
      >
        Not enough data yet. Complete a few days to see the trend line.
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label="Composite score over time"
      viewBox={`0 0 ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block w-full", className)}
      style={{ height }}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = PADDING.top + pct * (view.h - PADDING.top - PADDING.bottom);
        const value = Math.round(view.max - pct * (view.max - view.min));
        return (
          <g key={pct}>
            <line
              x1={PADDING.left}
              x2={view.w - PADDING.right}
              y1={y}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={PADDING.left - 6}
              y={y + 4}
              fontSize="10"
              textAnchor="end"
              fill="#475569"
            >
              {value}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <path
        d={view.pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points */}
      {view.points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={color} />
          <title>
            {p.date}: {Math.round(p.composite)}
          </title>
        </g>
      ))}
    </svg>
  );
}
