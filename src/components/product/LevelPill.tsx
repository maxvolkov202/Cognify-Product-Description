"use client";

import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import {
  bandForLevel,
  levelProgress,
  xpToNextLevel,
  MAX_LEVEL,
} from "@/lib/progression/levels";
import { cn } from "@/lib/utils/cn";

type Props = {
  level: number;
  xp: number;
  /** Compact variant for header — hides band label, shows only L## + ring. */
  compact?: boolean;
  className?: string;
};

/**
 * DNA Ch.7 — level pill rendered in app header. Shows current level, band
 * label (compact mode hides it), and an XP ring around the trophy icon
 * indicating progress to next level. Tooltip on hover surfaces remaining
 * XP and the band copy.
 */
export function LevelPill({ level, xp, compact = false, className }: Props) {
  const progress = levelProgress(xp, level);
  const band = bandForLevel(level);
  const remaining = xpToNextLevel(xp, level);
  const atCap = level >= MAX_LEVEL;

  const tooltip = atCap
    ? `Level ${level} · ${band.label} · max level reached`
    : `Level ${level} · ${band.label} · ${remaining.toLocaleString()} XP to next`;

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-2.5 py-1",
        className,
      )}
    >
      <span className="relative grid size-5 place-items-center">
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-5 -rotate-90">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-200"
          />
          <motion.circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="url(#level-pill-gradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${progress * 62.83} 62.83`}
            initial={{ strokeDasharray: "0 62.83" }}
            animate={{ strokeDasharray: `${progress * 62.83} 62.83` }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          />
          <defs>
            <linearGradient id="level-pill-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6aa3ff" />
              <stop offset="100%" stopColor="#e77cf0" />
            </linearGradient>
          </defs>
        </svg>
        <Trophy
          className="relative size-2.5 text-brand-purple"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
      <span className="text-[12px] font-extrabold tabular-nums text-ink-800">
        L{level}
      </span>
      {!compact && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {band.label}
        </span>
      )}
    </span>
  );
}
