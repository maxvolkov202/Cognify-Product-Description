"use client";

import { Flame, Trophy } from "lucide-react";
import { motion } from "motion/react";
import {
  bandForLevel,
  levelProgress,
  xpToNextLevel,
  xpForLevel,
  MAX_LEVEL,
} from "@/lib/progression/levels";
import { cn } from "@/lib/utils/cn";

type Props = {
  level: number;
  xp: number;
  currentStreakDays: number;
  longestStreakDays: number;
  className?: string;
};

/**
 * DNA Ch.8 — top-of-dashboard hero summarizing the user's progression
 * state. Combines level, XP-to-next progress bar, current streak with
 * flame, longest streak as a side-stat. The level + streak are the two
 * "where am I" signals the user wants at a glance.
 */
export function LevelStreakCard({
  level,
  xp,
  currentStreakDays,
  longestStreakDays,
  className,
}: Props) {
  const band = bandForLevel(level);
  const progress = levelProgress(xp, level);
  const remaining = xpToNextLevel(xp, level);
  const atCap = level >= MAX_LEVEL;
  const nextLevelXp = atCap ? xp : xpForLevel(level + 1);

  return (
    <section
      className={cn(
        "surface-card overflow-hidden",
        className,
      )}
    >
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_1fr] md:gap-8 md:p-7">
        {/* Level half */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
            <Trophy className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Level
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tabular-nums text-ink-900">
              {level}
            </span>
            <span className="brand-gradient-text text-base font-extrabold">
              {band.label}
            </span>
          </p>
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                className="brand-gradient h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>
            <p className="mt-2 flex items-baseline justify-between text-[11px] text-ink-500">
              <span className="tabular-nums">
                {xp.toLocaleString()} XP
              </span>
              <span className="tabular-nums">
                {atCap
                  ? "Max level"
                  : `${remaining.toLocaleString()} to L${level + 1}`}
              </span>
            </p>
          </div>
        </div>

        {/* Streak half */}
        <div className="md:border-l md:border-ink-100 md:pl-8">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-orange-600">
            <Flame className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Streak
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tabular-nums text-ink-900">
              {currentStreakDays}
            </span>
            <span className="text-base font-extrabold text-ink-500">
              day{currentStreakDays === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-wider text-ink-400">
            Longest
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums text-ink-700">
            {longestStreakDays} day{longestStreakDays === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {!atCap && nextLevelXp > 0 && (
        <p className="sr-only">
          Currently {xp} XP. Next level at {nextLevelXp} XP.
        </p>
      )}
    </section>
  );
}
