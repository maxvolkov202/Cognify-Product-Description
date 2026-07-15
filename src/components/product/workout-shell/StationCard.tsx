"use client";

// One of 4 cards in the StationStrip. Three visual states (locked,
// current, complete) + dim-colored ring on the active card.
//
// Mobile constraints: ≥44pt tap-target via min-h, no hover-only styling,
// active styling on focus+aria-pressed equivalent.

import { Check, Lock } from "lucide-react";
import type { ShellStation } from "@/lib/workout/types";
import type { MuscleGroupId } from "@/types/domain";
import { DIM_THEMES } from "@/lib/workout/dim-theme";
import { cn } from "@/lib/utils/cn";

export type StationCardProps = {
  station: ShellStation;
  dim: MuscleGroupId;
  onFocus?: (index: number) => void;
  onActivate?: (index: number) => void;
};

export default function StationCard({
  station,
  dim,
  onFocus,
  onActivate,
}: StationCardProps) {
  const { status, index, exerciseName, compositeScore } = station;
  const theme = DIM_THEMES[dim];
  const labelByStatus: Record<typeof status, string> = {
    locked: `Station ${index + 1}: ${exerciseName}. Unlocks after station ${index}.`,
    current: `Station ${index + 1}: ${exerciseName}. Current.`,
    complete: `Station ${index + 1}: ${exerciseName}. Complete${
      compositeScore != null ? `, scored ${Math.round(compositeScore)}` : ""
    }.`,
  };

  const isInteractive = status === "current";

  return (
    <button
      type="button"
      disabled={!isInteractive}
      aria-label={labelByStatus[status]}
      aria-current={status === "current" ? "step" : undefined}
      onFocus={() => onFocus?.(index)}
      onClick={isInteractive ? () => onActivate?.(index) : undefined}
      className={cn(
        "relative flex flex-col items-center justify-between overflow-hidden",
        "min-h-[44px] min-w-[44px] w-full",
        "rounded-xl border px-2 py-3",
        "text-center transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "motion-safe:transition-shadow motion-safe:duration-150",
        // status-driven styling
        status === "locked" &&
          "border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed",
        status === "current" &&
          cn(
            "border-transparent bg-slate-800/80 text-slate-100 ring-2 ring-offset-1 ring-offset-slate-950",
            theme.ring,
            "motion-safe:animate-pulse motion-reduce:animate-none",
          ),
        status === "complete" &&
          "border-slate-700 bg-slate-900 text-slate-100",
      )}
    >
      {/* Dim-gradient hairline across the card top — full strength on the
          current station, dimmed on complete ones, absent while locked, so
          the strip reads as one branded system without new state logic. */}
      {status !== "locked" && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r",
            theme.tile,
            status === "complete" && "opacity-50",
          )}
        />
      )}
      {/* Soft dim wash on the active card only. */}
      {status === "current" && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-b",
            theme.wash,
          )}
        />
      )}
      <div
        className={cn(
          "absolute top-1 left-2 text-[10px] uppercase tracking-wide",
          status === "complete" ? theme.text : "text-slate-500",
        )}
      >
        {index + 1}
      </div>
      <div className="flex items-center justify-center w-full flex-1 pt-3">
        {status === "locked" && (
          <Lock className="w-5 h-5 text-slate-500" aria-hidden />
        )}
        {status === "complete" && (
          <Check className={cn("w-5 h-5", theme.text)} aria-hidden />
        )}
        {status === "current" && (
          <div
            className={cn(
              "w-3 h-3 rounded-full bg-current",
              theme.text,
              "motion-safe:animate-ping motion-reduce:animate-none",
            )}
            aria-hidden
          />
        )}
      </div>
      <div className="text-[11px] leading-tight font-medium line-clamp-2 px-1">
        {exerciseName}
      </div>
      {status === "complete" && compositeScore != null && (
        <div
          className={cn(
            "absolute bottom-1 right-1 text-[10px] font-semibold",
            theme.text,
          )}
        >
          {Math.round(compositeScore)}
        </div>
      )}
    </button>
  );
}
