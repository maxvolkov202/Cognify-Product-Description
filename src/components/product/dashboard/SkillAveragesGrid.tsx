import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import { DIMENSION_ACCENTS } from "@/lib/skill-lab/mode-theme";
import type { RunningAverage } from "@/lib/db/queries/progress";
import { cn } from "@/lib/utils/cn";

type Props = {
  averages: RunningAverage[];
  className?: string;
};

const TREND_THRESHOLD = 1.5;

/**
 * Ch.14 — closes DNA Gap 7. Six-tile grid of running 30-rep weighted
 * averages, one per dimension, with a 14-day trend arrow and a sample-
 * size badge. The "headline" surface that lets a user see all six dim
 * averages at a glance — distinct from the existing SkillProgressBlock
 * (latest-score bars) and the trend chart (per-day series).
 *
 * Empty-state tiles: when no reps in a dim, render the dim label with
 * an em-dash placeholder and "run reps to see your averages" copy.
 * The whole card stays mounted (no conditional hide) so the user
 * always sees the six dims they're being scored on.
 *
 * Layout: 2 cols on mobile, 3 cols on md+ — every tile a square-ish
 * card with the brand accent stripe pinned to its left edge.
 */
export function SkillAveragesGrid({ averages, className }: Props) {
  return (
    <section
      className={cn(
        "surface-card overflow-hidden p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
          Running averages · last 30 reps
        </p>
        <p className="text-[10px] font-medium text-ink-400">
          14-day trend ▲▼
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {averages.map((a) => (
          <AverageTile key={a.dimension} avg={a} />
        ))}
      </div>
    </section>
  );
}

function AverageTile({ avg }: { avg: RunningAverage }) {
  const accent = DIMENSION_ACCENTS[avg.dimension];
  const isContent = (
    SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
  ).includes(avg.dimension);
  const hasData = avg.avg != null && avg.sampleSize > 0;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-3 pl-4"
      style={{
        // Left-edge accent stripe — visually groups Content vs Delivery
        // dims via colour, even when the labels are scanned in column
        // order rather than left-to-right.
        boxShadow: `inset 4px 0 0 0 ${accent}`,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-wide",
            isContent ? "text-ink-700" : "text-ink-600",
          )}
        >
          {DIMENSION_LABELS[avg.dimension]}
        </span>
        <DeltaArrow delta={avg.delta14d} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        {hasData ? (
          <>
            <span
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: accent }}
            >
              {Math.round(avg.avg!)}
            </span>
            <span className="text-[10px] font-medium text-ink-400">
              /100
            </span>
          </>
        ) : (
          <span className="text-2xl font-extrabold text-ink-300">—</span>
        )}
      </div>
      <p className="mt-1 text-[10px] font-medium text-ink-400">
        {hasData
          ? `${avg.sampleSize} ${avg.sampleSize === 1 ? "rep" : "reps"} in window`
          : "run reps to see your average"}
      </p>
    </div>
  );
}

function DeltaArrow({ delta }: { delta: number | null }) {
  const cls = "size-3.5";
  if (delta == null) {
    return (
      <Minus
        className={`${cls} text-ink-300`}
        strokeWidth={2.5}
        aria-label="trend unavailable"
      />
    );
  }
  if (delta >= TREND_THRESHOLD) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 tabular-nums">
        <TrendingUp className={cls} strokeWidth={2.5} aria-hidden="true" />
        +{delta.toFixed(1)}
      </span>
    );
  }
  if (delta <= -TREND_THRESHOLD) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 tabular-nums">
        <TrendingDown className={cls} strokeWidth={2.5} aria-hidden="true" />
        {delta.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-ink-400 tabular-nums">
      <Minus className={cls} strokeWidth={2.5} aria-hidden="true" />
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}
