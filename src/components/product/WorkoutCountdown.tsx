"use client";

import { useEffect, useState } from "react";
import { ModeBadge, ModeHalo, type ModeKind } from "./ModeBadge";

type Props = {
  from?: number;
  onComplete: () => void;
  /** Mode-specific accent + badge. Each product gets a distinct halo
   *  (warm amber for Daily Workout, cool blue for Skill Lab, magenta
   *  for Build a Rep) so the warmup screen reads as the right product
   *  before the rep even starts. Brand-gradient text on the digit keeps
   *  the family identity intact across all modes. */
  mode?: ModeKind;
};

export function WorkoutCountdown({
  from = 3,
  onComplete,
  mode = "daily_workout",
}: Props) {
  const [count, setCount] = useState<number | "go">(from);

  useEffect(() => {
    if (count === "go") {
      const t = setTimeout(onComplete, 700);
      return () => clearTimeout(t);
    }
    if (count === 1) {
      const t = setTimeout(() => setCount("go"), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setCount((c) => (typeof c === "number" ? c - 1 : c));
    }, 900);
    return () => clearTimeout(t);
  }, [count, onComplete]);

  return (
    <div className="relative mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center">
      <ModeHalo mode={mode} />
      <ModeBadge mode={mode} />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        Get ready
      </p>
      <div
        key={typeof count === "number" ? count : "go"}
        className="brand-gradient-text mt-4 text-[180px] font-extrabold leading-none tracking-[-0.06em] tabular-nums animate-in zoom-in-50 fade-in duration-500 md:text-[220px]"
        style={{
          // Solid color fallback when background-clip:text fails (Safari iOS,
          // some Android WebViews) so the digit is never invisible.
          color: "var(--color-ink-900)",
        }}
      >
        {count === "go" ? "Go" : count}
      </div>
      <p className="mt-6 text-sm text-ink-500">
        First prompt in {typeof count === "number" ? `${count}…` : "…"}
      </p>
    </div>
  );
}
