"use client";

// Compact rep-progress header for the in-workout view. Replaces the
// big "Ready to train?" hero + the full TrainingList while the user is
// actually in a station. Shows: dim day label, current rep #/total,
// current exercise name, and 4 status dots.

import { Check, Mic } from "lucide-react";
import { motion } from "motion/react";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import type { ShellStation } from "@/lib/workout/types";
import { cn } from "@/lib/utils/cn";

export type WorkoutProgressBarProps = {
  dim: MuscleGroupId | null;
  stations: ShellStation[];
  currentStationIndex: number;
};

export default function WorkoutProgressBar({
  dim,
  stations,
  currentStationIndex,
}: WorkoutProgressBarProps) {
  const totalStations = stations.length || 4;
  const currentStation = stations[currentStationIndex] ?? null;
  const dimLabel = dim ? MUSCLE_GROUP_LABELS[dim] : "Workout";

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-violet-50/60 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600">
            {dimLabel} Day · Rep {Math.min(currentStationIndex + 1, totalStations)} of {totalStations}
          </div>
          <div className="mt-0.5 flex items-center gap-2 min-w-0">
            <Mic className="w-4 h-4 text-purple-600 shrink-0" strokeWidth={2.5} />
            <div className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              {currentStation?.exerciseName ?? "—"}
            </div>
          </div>
        </div>
        {/* 4 status dots */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          role="group"
          aria-label={`Progress: rep ${currentStationIndex + 1} of ${totalStations}`}
        >
          {stations.map((station) => {
            const isComplete = station.status === "complete";
            const isCurrent = station.index === currentStationIndex;
            return (
              <motion.div
                key={station.exerciseId}
                className={cn(
                  "rounded-full flex items-center justify-center",
                  isComplete
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-purple-600 text-white ring-2 ring-purple-200"
                      : "bg-slate-200",
                )}
                style={{ width: isCurrent ? 22 : 18, height: isCurrent ? 22 : 18 }}
                animate={{ scale: isCurrent ? 1.05 : 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {isComplete && <Check className="w-3 h-3" strokeWidth={3} />}
              </motion.div>
            );
          })}
          {/* Pad with empty slots if stations underdelivered. */}
          {stations.length < totalStations &&
            Array.from({ length: totalStations - stations.length }).map((_, i) => (
              <div
                key={`pad-${i}`}
                className="rounded-full bg-slate-200"
                style={{ width: 18, height: 18 }}
              />
            ))}
        </div>
      </div>
      {currentStation?.rule && (
        <div className="mt-3 text-xs text-slate-500 leading-snug">
          <span className="font-semibold text-slate-700">Rule:</span>{" "}
          {currentStation.rule}
        </div>
      )}
    </div>
  );
}
