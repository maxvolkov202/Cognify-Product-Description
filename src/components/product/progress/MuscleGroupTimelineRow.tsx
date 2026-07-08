"use client";

// Phase 9 — one row in the muscle-group timeline. Date, composite,
// exercise badges with per-rep scores, and a duration summary.

import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import type { MuscleGroupTimelineRow as Row } from "@/lib/db/queries/muscle-group-progress";

const DIM_RING: Record<MuscleGroupId, string> = {
  clarity: "ring-[#6aa3ff]",
  structure: "ring-[#b39bff]",
  conciseness: "ring-[#e77cf0]",
  thinking_quality: "ring-[#b072ff]",
  pacing: "ring-[#7fd6c8]",
  tone: "ring-[#ffb38a]",
};

const DIM_BADGE: Record<MuscleGroupId, string> = {
  clarity: "text-[#6aa3ff]",
  structure: "text-[#b39bff]",
  conciseness: "text-[#e77cf0]",
  thinking_quality: "text-[#b072ff]",
  pacing: "text-[#7fd6c8]",
  tone: "text-[#ffb38a]",
};

export type MuscleGroupTimelineRowProps = {
  row: Row;
};

export default function MuscleGroupTimelineRow({
  row,
}: MuscleGroupTimelineRowProps) {
  const totalDuration = row.exercises.reduce(
    (acc, ex) => acc + (ex.durationMs ?? 0),
    0,
  );

  return (
    <article
      className={cn(
        "rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3",
        "flex flex-col gap-2",
      )}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              DIM_BADGE[row.dimension],
              "bg-current",
            )}
            aria-hidden
          />
          <div className="text-sm font-medium text-slate-100">
            {formatDate(row.dayDate)}
          </div>
          <div className={cn("text-xs uppercase tracking-wide", DIM_BADGE[row.dimension])}>
            {MUSCLE_GROUP_LABELS[row.dimension]}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-slate-100 leading-none">
            {row.composite != null ? Math.round(row.composite) : "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">composite</div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {row.exercises.map((ex, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]",
              "bg-slate-800 ring-1 ring-inset",
              ex.composite != null ? DIM_RING[row.dimension] : "ring-slate-700",
              ex.isGraduationRep && "bg-yellow-500/10 ring-yellow-400/40",
            )}
            title={ex.exerciseName}
          >
            {ex.isGraduationRep ? (
              <Trophy className="w-3 h-3 text-yellow-300" aria-hidden />
            ) : ex.composite != null ? (
              <Check className="w-3 h-3 text-slate-300" aria-hidden />
            ) : null}
            <span className="truncate max-w-[120px] text-slate-200">
              {ex.exerciseName}
            </span>
            {ex.composite != null && (
              <span className="font-semibold text-slate-100">
                {Math.round(ex.composite)}
              </span>
            )}
          </span>
        ))}
      </div>

      {totalDuration > 0 && (
        <div className="text-[10px] text-slate-500">
          Total: {(totalDuration / 1000 / 60).toFixed(1)}m across{" "}
          {row.exercises.length} rep{row.exercises.length === 1 ? "" : "s"}
        </div>
      )}
    </article>
  );
}

function formatDate(s: string): string {
  // Render YYYY-MM-DD as "Mon, May 21" (short relative-ish form).
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
