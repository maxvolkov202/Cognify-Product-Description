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
  /** Dim scores known so far. Phase 2 path: 2 deterministic dims
   *  (delivery + thinking_quality). Phase 5 path: all 6 dims from
   *  /api/score/stage1. Cards without a score render as shimmer. */
  optimisticDims: DimensionScore[];
  /** Phase 5 — when stage 1 has landed, all 6 dims are populated so
   *  we show a composite + "writing your feedback…" headline strip
   *  above the grid. Optional so the Phase 2 path keeps its existing
   *  shape (no header, just 2 cards + shimmer). */
  stage1Header?: {
    composite: number;
    headlineTone: "blunt" | "directive" | "praise" | "celebratory";
  };
};

export function OptimisticDimensionPreview({
  optimisticDims,
  stage1Header,
}: Props) {
  const scoreByDim = new Map<SkillDimension, DimensionScore>();
  for (const d of optimisticDims) scoreByDim.set(d.dimension, d);

  return (
    <div className="space-y-4">
      {stage1Header && (
        <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                This rep
              </div>
              <div className="mt-0.5 text-2xl font-extrabold text-ink-900 dark:text-white">
                {Math.round(stage1Header.composite)}
                <span className="ml-1 text-base font-semibold text-ink-400 dark:text-ink-500">/100</span>
              </div>
            </div>
            <div className="text-right text-xs text-ink-500 dark:text-ink-400">
              <div className="inline-flex items-center gap-2 rounded-full bg-ink-50 dark:bg-ink-800 px-3 py-1 font-medium text-ink-700 dark:text-ink-200">
                <span className="size-1.5 animate-pulse rounded-full bg-brand-purple" />
                Writing your detailed feedback…
              </div>
              <div className="mt-1 text-[11px] text-ink-400 dark:text-ink-500">
                Headline tone: {stage1Header.headlineTone}
              </div>
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
}

function ShimmerCard({ dimension }: { dimension: SkillDimension }) {
  const accent = DIMENSION_ACCENTS[dimension];
  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full opacity-50"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          {DIMENSION_LABELS[dimension]}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div
          className={cn(
            "h-7 w-12 animate-pulse rounded bg-ink-100 dark:bg-ink-800",
          )}
          aria-hidden="true"
        />
        <span className="text-xs text-ink-400 dark:text-ink-500">scoring…</span>
      </div>
      <div
        className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-ink-100 dark:bg-ink-800"
        aria-hidden="true"
      />
    </div>
  );
}
