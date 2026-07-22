"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Reusable +/- integer stepper. Lifted from the `MixedRepsStep` pattern
 * (`SkillLabClient.tsx`) into a shared primitive so every "choose a count"
 * surface in the app uses the same control and brand styling.
 *
 * The clamp math is factored into pure, exported helpers so it can be
 * unit-tested without a DOM (`tests/stepper.test.ts`).
 */

/** Clamp `value` into the inclusive `[min, max]` range. */
export function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply a +/- step to `current` and clamp to `[min, max]`.
 * Mirrors `MixedRepsStep`'s `Math.max(min, Math.min(max, value + delta))`.
 */
export function clampStep(
  current: number,
  delta: number,
  min: number,
  max: number,
): number {
  return clampToRange(current + delta, min, max);
}

export interface StepperProps {
  /** Current value (controlled). */
  value: number;
  /** Called with the next clamped value when +/- is pressed. */
  onChange: (next: number) => void;
  /** Inclusive minimum. Default 0. */
  min?: number;
  /** Inclusive maximum. Default 5. */
  max?: number;
  /** Step size for a single +/- press. Default 1. */
  step?: number;
  /** Optional label rendered above the control. */
  label?: string;
  /** Optional helper line rendered under the label. */
  helper?: string;
  /** Disables both buttons. */
  disabled?: boolean;
  /** Accessible name for the control when no visible `label` is set. */
  ariaLabel?: string;
  className?: string;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 5,
  step = 1,
  label,
  helper,
  disabled = false,
  ariaLabel,
  className,
}: StepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const groupLabel = ariaLabel ?? label;

  function nudge(delta: number) {
    const next = clampStep(value, delta, min, max);
    if (next !== value) onChange(next);
  }

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {(label || helper) && (
        <div>
          {label && (
            <p className="text-base font-extrabold tracking-tight text-ink-900 dark:text-white">
              {label}
            </p>
          )}
          {helper && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              {helper}
            </p>
          )}
        </div>
      )}
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label={groupLabel}
      >
        <button
          type="button"
          onClick={() => nudge(-step)}
          disabled={disabled || atMin}
          className="grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
          aria-label={groupLabel ? `Decrease ${groupLabel}` : "Decrease"}
        >
          <Minus className="size-4" strokeWidth={2.5} />
        </button>
        <span
          className="w-10 text-center text-2xl font-extrabold tabular-nums text-ink-900 dark:text-white"
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => nudge(step)}
          disabled={disabled || atMax}
          className="grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
          aria-label={groupLabel ? `Increase ${groupLabel}` : "Increase"}
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
