"use client";

import type { DimensionScore, SkillDimension } from "@/types/domain";
import { SKILL_DIMENSIONS, DIMENSION_LABELS } from "@/types/domain";
import { DIMENSION_ACCENTS } from "@/lib/skill-lab/mode-theme";
import { DimensionCard } from "./DimensionCard";
import { cn } from "@/lib/utils/cn";

/**
 * Phase 2 — optimistic dimension preview shown during the scoring phase.
 *
 * Renders the same 6-card grid layout as DimensionGrid but populates only
 * the two deterministic dimensions (delivery + thinking_quality) with
 * real scores computed client-side from word timings. The other four
 * dims render as shimmer placeholders until the LLM scoring call resolves.
 *
 * Why a separate component (not extending DimensionGrid): keeps the
 * production grid's expand/highlight/mode-aware layout logic untouched.
 * This component is render-only with no interaction state.
 */

type Props = {
  /** The two deterministic dim scores (delivery + thinking_quality). */
  optimisticDims: DimensionScore[];
};

export function OptimisticDimensionPreview({ optimisticDims }: Props) {
  const scoreByDim = new Map<SkillDimension, DimensionScore>();
  for (const d of optimisticDims) scoreByDim.set(d.dimension, d);

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
      {SKILL_DIMENSIONS.map((dim, i) => {
        const real = scoreByDim.get(dim);
        if (real) {
          return (
            <div key={dim}>
              <DimensionCard
                dimension={dim}
                score={real.score}
                callouts={[]}
                expanded={false}
                onToggle={() => {}}
                delaySec={0.1 + i * 0.04}
              />
            </div>
          );
        }
        return <ShimmerCard key={dim} dimension={dim} />;
      })}
    </div>
  );
}

function ShimmerCard({ dimension }: { dimension: SkillDimension }) {
  const accent = DIMENSION_ACCENTS[dimension];
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full opacity-50"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {DIMENSION_LABELS[dimension]}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div
          className={cn(
            "h-7 w-12 animate-pulse rounded bg-ink-100",
          )}
          aria-hidden="true"
        />
        <span className="text-xs text-ink-400">scoring…</span>
      </div>
      <div
        className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-ink-100"
        aria-hidden="true"
      />
    </div>
  );
}
