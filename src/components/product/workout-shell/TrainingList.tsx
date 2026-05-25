"use client";

// "Today's Training" numbered list — light theme, matches v2-neon
// reference. Shows all 4 stations always; status icon + duration
// estimate per row. Highlights the current station.

import { Check, Lock, Mic } from "lucide-react";
import type { ShellStation } from "@/lib/workout/types";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const ESTIMATED_REP_SECONDS = 45;

export type TrainingListProps = {
  stations: ShellStation[];
  currentStationIndex: number;
  dim: MuscleGroupId | null;
};

export default function TrainingList({
  stations,
  currentStationIndex,
  dim,
}: TrainingListProps) {
  if (stations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-ink-400 mb-3">
          Today&apos;s Training
        </div>
        <ul className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 dark:bg-ink-800"
            >
              <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-ink-700 text-slate-600 dark:text-ink-300 text-sm font-semibold flex items-center justify-center">
                {n}
              </span>
              <span className="flex-1 text-sm text-slate-500 dark:text-ink-400">
                Revealed when you start
              </span>
              <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-ink-400" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-ink-400 mb-3">
        Today&apos;s Training
      </div>
      <ul className="space-y-2">
        {stations.map((station) => (
          <TrainingRow
            key={station.exerciseId}
            station={station}
            current={station.index === currentStationIndex}
            dim={dim}
          />
        ))}
      </ul>
    </div>
  );
}

function TrainingRow({
  station,
  current,
  dim,
}: {
  station: ShellStation;
  current: boolean;
  dim: MuscleGroupId | null;
}) {
  const isComplete = station.status === "complete";
  const isLocked = station.status === "locked" && !current;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors",
        current
          ? "bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-brand-purple/40"
          : "bg-slate-50/60 dark:bg-ink-800/60 border-transparent",
      )}
      data-current={current ? "true" : "false"}
    >
      <span
        className={cn(
          "w-7 h-7 rounded-full text-sm font-semibold flex items-center justify-center shrink-0",
          isComplete
            ? "bg-emerald-500 text-white"
            : current
              ? "bg-purple-600 text-white"
              : "bg-slate-200 dark:bg-ink-700 text-slate-700 dark:text-ink-200",
        )}
        aria-hidden="true"
      >
        {isComplete ? (
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        ) : (
          station.index + 1
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-semibold text-sm truncate",
              current ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-ink-100",
            )}
          >
            {station.exerciseName}
          </span>
          {current && (
            <Mic className="w-3.5 h-3.5 text-purple-600 dark:text-brand-lavender shrink-0" />
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-ink-400 truncate">
          {dim ? MUSCLE_GROUP_LABELS[dim].toLowerCase() : ""} ·{" "}
          {station.rule}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-ink-400 shrink-0 tabular-nums">
        <span>{ESTIMATED_REP_SECONDS}s</span>
        {isLocked && <Lock className="w-3 h-3" />}
      </div>
    </li>
  );
}
