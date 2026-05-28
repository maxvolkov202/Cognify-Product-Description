"use client";

import { cn } from "@/lib/utils/cn";

type Props = {
  seconds: number;
  /** Top label (e.g. "TO SPEAK"). Defaults to "TO SPEAK". */
  label?: string;
  /** Accent color for the ring stroke. Default uses the brand gradient
   *  (via stroke="url(#cognify-timer-gradient)"). Accepts any CSS color
   *  if you want a solid stroke — mostly used for the gradient default. */
  size?: "sm" | "md";
};

/**
 * Animated circle timer badge — mockup #2 "45s TO SPEAK".
 *
 * Static, non-counting ring that shows the rep's budget at a glance on
 * the prompt-pick screen. The ring is always full (100% arc) because
 * this is shown BEFORE recording starts; the recording-phase timer
 * lives in RecordButton with its own countdown progress.
 *
 * The ring stroke uses the brand gradient via an inline SVG
 * `<linearGradient>` so the badge feels tied to the brand even when
 * the rest of the card is neutral.
 */
export function CircleTimer({
  seconds,
  label = "to speak",
  size = "md",
}: Props) {
  const dims = size === "sm" ? SIZES.sm : SIZES.md;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center p-3",
        size === "md" ? "min-w-[124px]" : "min-w-[96px]",
      )}
      aria-label={`${seconds} seconds ${label}`}
    >
      <svg
        width={dims.svgSize}
        height={dims.svgSize}
        viewBox={`0 0 ${dims.svgSize} ${dims.svgSize}`}
        className="absolute inset-0 m-auto"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="cognify-timer-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--color-brand-blue)" />
            <stop offset="35%" stopColor="var(--color-brand-lavender)" />
            <stop offset="70%" stopColor="var(--color-brand-purple)" />
            <stop offset="100%" stopColor="var(--color-brand-magenta)" />
          </linearGradient>
        </defs>
        <circle
          cx={dims.center}
          cy={dims.center}
          r={dims.radius}
          stroke="var(--color-ink-100)"
          strokeWidth={dims.stroke}
          fill="none"
        />
        <circle
          cx={dims.center}
          cy={dims.center}
          r={dims.radius}
          stroke="url(#cognify-timer-gradient)"
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${dims.center} ${dims.center})`}
        />
      </svg>
      <div className="relative text-center">
        <div
          className={cn(
            "brand-gradient-text font-extrabold tabular-nums leading-none",
            size === "md" ? "text-[28px]" : "text-xl",
          )}
        >
          {seconds}s
        </div>
        <div
          className={cn(
            "mt-1 font-semibold uppercase tracking-[0.18em] text-ink-400",
            size === "md" ? "text-[9px]" : "text-[8px]",
          )}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

const SIZES = {
  md: { svgSize: 100, center: 50, radius: 42, stroke: 4 },
  sm: { svgSize: 78, center: 39, radius: 33, stroke: 3 },
} as const;
