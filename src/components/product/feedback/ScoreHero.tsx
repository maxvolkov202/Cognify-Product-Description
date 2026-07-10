"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Callout, DimensionScore, SkillDimension } from "@/types/domain";
import { bandFor } from "@/types/domain";
import { CompositeScore } from "./CompositeScore";
import { DimensionGrid, type DimensionGridHandle } from "./DimensionGrid";

type Props = {
  composite: number;
  headline: string;
  dimensions: DimensionScore[];
  callouts: Callout[];
  durationLabel?: string;
  primaryFocusDimension?: SkillDimension;
  modeSignals?: {
    sessionType: "focus" | "combined" | "flow";
    focusDimension?: SkillDimension;
    pressureArchetypeId?: string;
  };
  /** PRD v3 §4.5 — the v2 loop renders the Core Skill Breakdown as its
   *  own stage AFTER the Coach's Focus, so the hero hides its embedded
   *  grid. Default false keeps the v1 layout byte-identical. */
  hideBreakdown?: boolean;
};

export const ScoreHero = forwardRef<DimensionGridHandle, Props>(function ScoreHero(
  {
    composite,
    headline,
    dimensions,
    callouts,
    durationLabel,
    primaryFocusDimension,
    modeSignals,
    hideBreakdown = false,
  },
  gridRef,
) {
  // Ch.13 — band copy under the headline. Reads from BAND_DEFINITIONS,
  // unflagged (string render, no scoring impact). Sits visually between
  // the hero number + headline (the verdict) and the per-dim grid (the
  // breakdown), giving the user a one-paragraph "what does this score
  // actually mean" before they scan dim-by-dim.
  const band = bandFor(composite);
  // The composite counts up inside CompositeScore (~0.8s); the band
  // verdict fades in just after so the number lands first. Purely
  // decorative — reduced motion renders it immediately.
  const reduced = useReducedMotion();
  return (
    <div className="surface-card relative overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="space-y-6 p-6 md:p-7">
        <div className="grid items-center gap-5 md:grid-cols-[auto_1fr] md:gap-8">
          <CompositeScore value={composite} durationLabel={durationLabel} />
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold leading-snug tracking-[-0.01em] text-ink-900 dark:text-white md:text-2xl">
              {headline}
            </h2>
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.7,
                duration: 0.4,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="text-[13px] leading-relaxed text-ink-600 dark:text-ink-300 md:text-sm"
            >
              <span className="mr-1.5 inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                {band.label}
              </span>
              {band.description}
            </motion.p>
          </div>
        </div>
        {!hideBreakdown && (
          <DimensionGrid
            ref={gridRef}
            dimensions={dimensions}
            callouts={callouts}
            primaryFocusDimension={primaryFocusDimension}
            modeSignals={modeSignals}
          />
        )}
      </div>
    </div>
  );
});
