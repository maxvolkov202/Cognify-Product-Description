"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import type { Callout, DimensionScore, SkillDimension } from "@/types/domain";
import { SKILL_DIMENSIONS } from "@/types/domain";
import { getPressureArchetype } from "@/lib/ai/pressure-archetypes";
import { DimensionCard } from "./DimensionCard";

export type DimensionGridHandle = {
  /** Open the matching DimensionCard (single-open accordion). Pass `null`
   *  to collapse. Called by FeedbackPanel from drill-in links and by the
   *  AudioControlContext.expandDimension wiring. */
  open: (dim: SkillDimension | null) => void;
};

type Props = {
  dimensions: DimensionScore[];
  /** All callouts on the rep. The grid filters to per-dimension callouts
   *  for each card's expanded body. */
  callouts: Callout[];
  /** Phase 2: which dim the AI flagged as primary focus. When set in
   *  combined-mode sessions, this dim gets a highlight ring even when
   *  it isn't the highest or lowest score. */
  primaryFocusDimension?: SkillDimension;
  /** Phase 2: per-mode signals drive grid layout —
   *    focus    : focus dim rendered first, gradient ring, no de-emphasis
   *    pressure : reorder by archetype.stressedDimensions, top 3 ringed,
   *               others at 75% opacity
   *    combined : Phase 1 high/low score heuristic + primaryFocusDimension. */
  modeSignals?: {
    sessionType: "focus" | "combined" | "flow";
    focusDimension?: SkillDimension;
    pressureArchetypeId?: string;
  };
};

export const DimensionGrid = forwardRef<DimensionGridHandle, Props>(
  function DimensionGrid(
    { dimensions, callouts, primaryFocusDimension, modeSignals },
    ref,
  ) {
    const [openDim, setOpenDim] = useState<SkillDimension | null>(null);

    useImperativeHandle(ref, () => ({
      open: (dim) => setOpenDim(dim),
    }));

    const scoreMap = useMemo(() => {
      const m = new Map<SkillDimension, number>();
      for (const d of dimensions) m.set(d.dimension, d.score);
      return m;
    }, [dimensions]);

    const calloutsByDim = useMemo(() => {
      const m = new Map<SkillDimension, Callout[]>();
      for (const dim of SKILL_DIMENSIONS) m.set(dim, []);
      for (const c of callouts) {
        if (c.dimension === "structural_adherence") continue;
        const arr = m.get(c.dimension);
        if (arr) arr.push(c);
      }
      return m;
    }, [callouts]);

    // Mode-aware emphasis. Single useMemo computes the full layout
    // instructions for this rep — order, highlight set, deemphasis set.
    const layout = useMemo(() => {
      const ordered: SkillDimension[] = [...SKILL_DIMENSIONS];
      const highlightSet = new Set<SkillDimension>();
      const deemphasizeSet = new Set<SkillDimension>();

      // Pressure mode: reorder + ring stressedDims, deemphasize the rest.
      if (
        modeSignals?.pressureArchetypeId &&
        // Validate archetype id at the boundary so a typo / unknown id
        // doesn't crash render — fall back to default emphasis.
        isValidArchetypeId(modeSignals.pressureArchetypeId)
      ) {
        const archetype = getPressureArchetype(modeSignals.pressureArchetypeId);
        const stressed = archetype.stressedDimensions;
        ordered.length = 0;
        for (const d of stressed) ordered.push(d);
        for (const d of SKILL_DIMENSIONS) {
          if (!stressed.includes(d)) ordered.push(d);
        }
        for (const d of stressed.slice(0, 3)) highlightSet.add(d);
        for (const d of SKILL_DIMENSIONS) {
          if (!stressed.includes(d)) deemphasizeSet.add(d);
        }
      } else if (
        modeSignals?.sessionType === "focus" &&
        modeSignals.focusDimension
      ) {
        // Focus mode: focus dim first, ringed; rest in original order.
        const focusDim = modeSignals.focusDimension;
        ordered.length = 0;
        ordered.push(focusDim);
        for (const d of SKILL_DIMENSIONS) {
          if (d !== focusDim) ordered.push(d);
        }
        highlightSet.add(focusDim);
      } else {
        // Combined / fallback: Phase 1 score-spread heuristic.
        const ranked = SKILL_DIMENSIONS.map((d) => ({
          dim: d,
          score: scoreMap.get(d) ?? 0,
        })).sort((a, b) => a.score - b.score);
        const lo = ranked[0];
        const hi = ranked[ranked.length - 1];
        const spread = hi && lo ? hi.score - lo.score : 0;
        const decorate = spread >= 15;
        if (decorate) {
          if (hi && hi.score >= 80) highlightSet.add(hi.dim);
          if (lo && lo.score < 60) highlightSet.add(lo.dim);
        }
        // Phase 2 add-on: AI's primaryFocusDimension overrides highlight
        // when combined-mode emphasis would otherwise be empty.
        if (primaryFocusDimension && highlightSet.size === 0) {
          highlightSet.add(primaryFocusDimension);
        }
      }

      return { ordered, highlightSet, deemphasizeSet };
    }, [modeSignals, scoreMap, primaryFocusDimension]);

    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {layout.ordered.map((dim, i) => {
          const score = scoreMap.get(dim) ?? 0;
          const expanded = openDim === dim;
          return (
            <div
              key={dim}
              className={
                (expanded ? "col-span-2 md:col-span-3 " : "") +
                (layout.deemphasizeSet.has(dim) ? "opacity-75" : "")
              }
            >
              <DimensionCard
                dimension={dim}
                score={score}
                callouts={calloutsByDim.get(dim) ?? []}
                expanded={expanded}
                onToggle={() =>
                  setOpenDim((prev) => (prev === dim ? null : dim))
                }
                highlighted={layout.highlightSet.has(dim)}
                delaySec={0.6 + i * 0.04}
              />
            </div>
          );
        })}
      </div>
    );
  },
);

const VALID_ARCHETYPE_IDS = new Set([
  "pushback",
  "time_compression",
  "audience_switch",
  "clarifying_interrupt",
  "stakes_raise",
]);
function isValidArchetypeId(
  id: string,
): id is
  | "pushback"
  | "time_compression"
  | "audience_switch"
  | "clarifying_interrupt"
  | "stakes_raise" {
  return VALID_ARCHETYPE_IDS.has(id);
}
