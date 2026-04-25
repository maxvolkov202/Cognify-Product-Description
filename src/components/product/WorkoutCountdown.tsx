"use client";

import { useEffect, useState } from "react";

type Props = {
  from?: number;
  onComplete: () => void;
};

export function WorkoutCountdown({ from = 3, onComplete }: Props) {
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
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
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
