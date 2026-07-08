"use client";

// Big gradient "Start workout" CTA card. v3 layout — replaces the
// minimal idle controls with the prominent purple→pink gradient hero
// from the v2-neon design. Tap fires startMuscleGroupDay() + reloads
// (server action redirects through to active-day payload).

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { startMuscleGroupDay } from "@/server/actions/workout-day";
import { cn } from "@/lib/utils/cn";

export type StartCardProps = {
  /** Provided by the shell when an in-place transition is wired up.
   *  When omitted, falls back to startMuscleGroupDay() + window.reload. */
  onStart?: () => void;
};

export default function StartCard({ onStart }: StartCardProps) {
  const [isPending, startTransition] = useTransition();
  const [pressed, setPressed] = useState(false);

  // Spacebar shortcut — v2-neon convention. Easter-egg / power-user.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          (e.target as HTMLElement).isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleStart();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStart]);

  function handleStart() {
    setPressed(true);
    if (onStart) {
      onStart();
      return;
    }
    startTransition(async () => {
      await startMuscleGroupDay();
      if (typeof window !== "undefined") window.location.reload();
    });
  }

  return (
    <motion.button
      type="button"
      onClick={handleStart}
      disabled={isPending}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "relative w-full rounded-2xl overflow-hidden text-left",
        "px-8 py-10 sm:py-14",
        // Canonical brand gradient (globals.css) — was a one-off
        // indigo→purple→pink stack that drifted from every other
        // primary surface.
        "brand-gradient",
        "shadow-[0_20px_60px_-15px_rgba(151,136,255,0.55)]",
        "transition-shadow",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-lavender/60",
        "disabled:opacity-90 disabled:cursor-wait",
        "group",
      )}
      aria-label="Start today's workout"
    >
      {/* Soft inner glow on hover/press. */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Start workout
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white max-w-md">
            Your first prompt appears the moment you tap.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold text-white tracking-wider">
            <kbd className="px-1.5 py-0.5 bg-white/25 rounded text-[10px]">
              SPACE
            </kbd>
            <span>or click anywhere</span>
          </div>
        </div>
        <div className="shrink-0">
          {isPending || pressed ? (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-7 h-7 sm:w-9 sm:h-9 text-white animate-spin" />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <ArrowRight className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
