"use client";

import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import { DIMENSION_LABELS } from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Which dimensions the user just set a personal best on. Order
   *  matters — first dimension is rendered as the primary headline,
   *  others as a secondary line. Empty array hides the toast. */
  dimensions: { dimension: SkillDimension; score: number }[];
  /** Auto-dismiss after this many ms. Defaults to 5500. */
  autoDismissMs?: number;
};

/**
 * Subtle celebration shown after a rep that set one or more per-dimension
 * personal bests. Renders as a toast in the bottom-right on desktop
 * (bottom-centered on mobile). Respects `prefers-reduced-motion`
 * (skip the entrance animation). Auto-dismisses; user can close early.
 *
 * Tone: earned, not overproduced. A single trophy icon and clean copy.
 * Consumer apps over-celebrate in ways that feel cheap — we don't.
 */
export function PersonalBestToast({
  dimensions,
  autoDismissMs = 5500,
}: Props) {
  const [open, setOpen] = useState(dimensions.length > 0);

  useEffect(() => {
    setOpen(dimensions.length > 0);
  }, [dimensions]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), autoDismissMs);
    return () => window.clearTimeout(t);
  }, [open, autoDismissMs]);

  if (!open || dimensions.length === 0) return null;

  const primary = dimensions[0]!;
  const secondary = dimensions.slice(1);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-50 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-emerald-100/50 p-4 shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none",
        // Mobile: full-width with bottom margin; desktop: bottom-right
        "inset-x-4 bottom-4 md:inset-x-auto md:bottom-6 md:right-6 md:max-w-sm",
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-sm">
        <Trophy className="size-5" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-800">
          Personal best
        </p>
        <p className="mt-0.5 text-sm font-semibold text-emerald-950">
          {DIMENSION_LABELS[primary.dimension]} up to{" "}
          <span className="tabular-nums">{primary.score}</span>. New high.
        </p>
        {secondary.length > 0 && (
          <p className="mt-1 text-xs text-emerald-800/90">
            Also best ever on{" "}
            {secondary
              .map((d) => DIMENSION_LABELS[d.dimension])
              .join(", ")}
            .
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-900"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
