"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

type Props = {
  value: number;
  /** Pre-formatted duration string (e.g. "0:45") shown beneath the score.
   *  Optional — omit when a parent surface already shows duration. */
  durationLabel?: string;
};

/** Big composite score with motion count-up. Threshold logic on the
 *  "out of 100" suffix only — the number itself stays solid black so a 46
 *  doesn't read as celebratory. */
export function CompositeScore({ value, durationLabel }: Props) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: [0.32, 0.72, 0, 1],
    });
    return controls.stop;
  }, [value, motionValue, reduced]);

  const tone = scoreTone(value);
  const suffixClass =
    tone === "low"
      ? "text-danger"
      : tone === "high"
        ? "text-ink-400"
        : "text-ink-400";
  const underline = tone === "high";

  return (
    <div className="flex flex-col items-center justify-center md:items-start">
      <motion.span className="font-extrabold tabular-nums text-ink-900 leading-none text-7xl md:text-8xl">
        {rounded}
      </motion.span>
      <p
        className={cn(
          "mt-2 text-[11px] font-bold uppercase tracking-[0.2em]",
          suffixClass,
        )}
      >
        <span className={cn(underline && "brand-gradient-text")}>Out of 100</span>
      </p>
      {durationLabel && (
        <p className="mt-1 text-xs tabular-nums text-ink-500">{durationLabel}</p>
      )}
    </div>
  );
}

function scoreTone(score: number): "low" | "mid" | "high" {
  if (score < 50) return "low";
  if (score >= 75) return "high";
  return "mid";
}
