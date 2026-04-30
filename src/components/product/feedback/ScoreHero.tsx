"use client";

import { forwardRef } from "react";
import type { Callout, DimensionScore, SkillDimension } from "@/types/domain";
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
  },
  gridRef,
) {
  return (
    <div className="surface-card relative overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="space-y-6 p-6 md:p-7">
        <div className="grid items-center gap-5 md:grid-cols-[auto_1fr] md:gap-8">
          <CompositeScore value={composite} durationLabel={durationLabel} />
          <h2 className="text-xl font-extrabold leading-snug tracking-[-0.01em] text-ink-900 md:text-2xl">
            {headline}
          </h2>
        </div>
        <DimensionGrid
          ref={gridRef}
          dimensions={dimensions}
          callouts={callouts}
          primaryFocusDimension={primaryFocusDimension}
          modeSignals={modeSignals}
        />
      </div>
    </div>
  );
});
