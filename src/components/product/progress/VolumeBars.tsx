"use client";

// Phase 9 — SVG volume bars (count of reps completed per day window).

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

export type VolumeBarsProps = {
  buckets: Array<{ label: string; count: number }>;
  className?: string;
  color?: string;
  height?: number;
};

const VIEW_W = 600;
const VIEW_H = 160;
const PADDING = { top: 12, right: 12, bottom: 30, left: 32 };

export default function VolumeBars({
  buckets,
  className,
  color = "#b072ff",
  height = 160,
}: VolumeBarsProps) {
  const view = useMemo(() => {
    if (buckets.length === 0) return null;
    const max = Math.max(1, ...buckets.map((b) => b.count));
    const w = VIEW_W;
    const h = VIEW_H;
    const chartW = w - PADDING.left - PADDING.right;
    const chartH = h - PADDING.top - PADDING.bottom;
    const barW = (chartW / buckets.length) * 0.7;
    const slot = chartW / buckets.length;
    return {
      w,
      h,
      bars: buckets.map((b, i) => {
        const x = PADDING.left + slot * i + (slot - barW) / 2;
        const barH = (b.count / max) * chartH;
        const y = PADDING.top + chartH - barH;
        return {
          x,
          y,
          w: barW,
          h: barH,
          label: b.label,
          count: b.count,
        };
      }),
      max,
    };
  }, [buckets]);

  if (!view) return null;

  return (
    <svg
      role="img"
      aria-label="Reps completed per day window"
      viewBox={`0 0 ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block w-full", className)}
      style={{ height }}
    >
      {view.bars.map((bar, i) => (
        <g key={i}>
          <rect
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={Math.max(2, bar.h)}
            rx="4"
            fill={color}
            opacity={bar.count > 0 ? 0.9 : 0.2}
          />
          <text
            x={bar.x + bar.w / 2}
            y={bar.y - 4}
            fontSize="10"
            textAnchor="middle"
            fill="#cbd5e1"
          >
            {bar.count}
          </text>
          <text
            x={bar.x + bar.w / 2}
            y={view.h - 12}
            fontSize="10"
            textAnchor="middle"
            fill="#64748b"
          >
            {bar.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
