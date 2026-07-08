"use client";

import { cn } from "@/lib/utils/cn";

type Props = {
  repIndex: number;
  totalReps: number;
  /** Pre-formatted, uppercase. Pressure → archetype tagline; focus →
   *  "{DIM} FOCUS"; mixed → "MIXED". Empty string is allowed (renders no
   *  separator chip). */
  modeLabel: string;
  /** Optional. When omitted, the right-side action is hidden (e.g. on
   *  Skill Lab where exit lives elsewhere). */
  onSaveExit?: () => void;
};

export function RepProgressStrip({
  repIndex,
  totalReps,
  modeLabel,
  onSaveExit,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
        Rep {repIndex} of {totalReps}
        {modeLabel && (
          <>
            <span className="mx-2 text-ink-300 dark:text-ink-600">·</span>
            <span>{modeLabel}</span>
          </>
        )}
      </p>

      {onSaveExit && (
        <button
          type="button"
          onClick={onSaveExit}
          className="text-xs font-semibold text-ink-500 dark:text-ink-400 transition-colors hover:text-ink-900 dark:hover:text-white"
        >
          Save and exit
        </button>
      )}

      <div className="flex w-full gap-1.5">
        {Array.from({ length: totalReps }, (_, i) => {
          const completed = i < repIndex - 1;
          const current = i === repIndex - 1;
          return (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                completed && "bg-brand-purple",
                current && "brand-gradient",
                !completed && !current && "bg-ink-200 dark:bg-ink-700",
              )}
              role={current ? "progressbar" : undefined}
              aria-valuenow={current ? repIndex : undefined}
              aria-valuemin={1}
              aria-valuemax={totalReps}
            />
          );
        })}
      </div>
    </div>
  );
}
