"use client";

import { forwardRef } from "react";
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
  return (
    <div className="surface-card relative overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="space-y-6 p-6 md:p-7">
        <div className="grid items-center gap-5 md:grid-cols-[auto_1fr] md:gap-8">
          <CompositeScore value={composite} durationLabel={durationLabel} />
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold leading-snug tracking-[-0.01em] text-ink-900 md:text-2xl">
              {headline}
            </h2>
            <p className="text-[13px] leading-relaxed text-ink-600 md:text-sm">
              <span className="mr-1.5 inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-700">
                {band.label}
              </span>
              {band.description}
            </p>
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
