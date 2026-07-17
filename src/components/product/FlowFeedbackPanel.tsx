"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import type { RepScore } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Props = {
  score: RepScore;
  repIndexOneBased: number;
  totalReps: number;
  archetypeName: string;
  /** Seconds before auto-advance fires. Default 4 — the tuning knob per
   *  `docs/proposals/session-types.md` risk R1. */
  autoAdvanceSec?: number;
  onAdvance: () => void;
};

/**
 * Compressed feedback panel used exclusively in Flow Session (WS-6).
 *
 * Design constraints:
 *   - One sentence of actionable feedback. No full dimension breakdown.
 *   - Auto-advances after ~4 seconds. User can tap "Next rep" to skip.
 *   - Must read cleanly on mobile in one eyeful.
 *   - Respects `prefers-reduced-motion` — skips the progress bar animation
 *     if the user requested reduced motion.
 *
 * The single insight is derived deterministically from the rep's callouts:
 *   1. Prefer the top-ranked `warn` or `critical` callout (actionable).
 *   2. Fall back to the top-ranked `positive` callout (reinforcement).
 *   3. Fall back to a neutral summary if no callouts exist.
 */
export function FlowFeedbackPanel({
  score,
  repIndexOneBased,
  totalReps,
  archetypeName,
  autoAdvanceSec = 4,
  onAdvance,
}: Props) {
  const [remainingMs, setRemainingMs] = useState(autoAdvanceSec * 1000);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Auto-advance tick. 50ms tick rate is enough for a smooth progress bar
  // without burning the event loop.
  useEffect(() => {
    if (remainingMs <= 0) {
      onAdvance();
      return;
    }
    const start = performance.now();
    const initial = remainingMs;
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const next = Math.max(0, initial - elapsed);
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(interval);
        onAdvance();
      }
    }, 50);
    return () => window.clearInterval(interval);
    // Intentionally not reactive to remainingMs — the interval owns the
    // tick. Re-running on every state change would double-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct =
    ((autoAdvanceSec * 1000 - remainingMs) / (autoAdvanceSec * 1000)) * 100;

  const insight = deriveFlowInsight(score);

  const isLast = repIndexOneBased >= totalReps;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-purple">
            <Zap className="size-3" />
            Flow · rep {repIndexOneBased} of {totalReps} · {archetypeName}
          </div>

          <div className="mt-4 flex items-baseline gap-4">
            <span className="brand-gradient-text text-5xl font-extrabold tabular-nums">
              {score.composite}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              composite
            </span>
          </div>

          <div
            className={cn(
              "mt-5 rounded-xl border p-4",
              insight.polarity === "positive"
                ? "border-emerald-200 bg-emerald-50/50"
                : insight.polarity === "improvement"
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-ink-200 bg-ink-50/50",
            )}
          >
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                insight.polarity === "positive"
                  ? "text-emerald-800"
                  : insight.polarity === "improvement"
                    ? "text-amber-800"
                    : "text-ink-500",
              )}
            >
              {insight.dimensionLabel
                ? `${insight.dimensionLabel} ·`
                : ""}{" "}
              {insight.polarity === "positive"
                ? "what landed"
                : insight.polarity === "improvement"
                  ? "tighten next rep"
                  : "next rep"}
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold leading-snug",
                insight.polarity === "positive"
                  ? "text-emerald-950"
                  : insight.polarity === "improvement"
                    ? "text-amber-950"
                    : "text-ink-800",
              )}
            >
              {insight.sentence}
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div
                className="h-1 overflow-hidden rounded-full bg-ink-100"
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Auto-advance progress"
              >
                <div
                  className="brand-gradient h-full"
                  style={{
                    width: `${progressPct}%`,
                    transition: reducedMotion
                      ? "none"
                      : "width 50ms linear",
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-500">
                {isLast
                  ? "Final rep — wrap coming up."
                  : `Next rep in ${Math.ceil(remainingMs / 1000)}s…`}
              </p>
            </div>
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-300 bg-white px-4 py-2 text-xs font-semibold text-ink-800 hover:border-ink-400 hover:bg-ink-50"
            >
              {isLast ? "Wrap up" : "Next rep"}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type FlowInsight = {
  dimensionLabel: string | null;
  polarity: "positive" | "improvement" | "neutral";
  sentence: string;
};

/**
 * Derive the single-sentence insight Flow shows between reps. Prefers
 * an actionable improvement callout over a positive one, since Flow's
 * purpose is forward momentum and tightening on the next rep. Falls back
 * to a positive + finally a neutral summary.
 */
function deriveFlowInsight(score: RepScore): FlowInsight {
  // v4 (grading v3) reps emit no callouts — the Coach's Focus IS the
  // single insight. Legacy reps keep the callout-derived chain below.
  if (score.coachFocus) {
    return {
      dimensionLabel: DIMENSION_LABELS[score.coachFocus.dimension],
      polarity: "improvement",
      sentence: score.coachFocus.action || score.coachFocus.text,
    };
  }
  const callouts = score.callouts ?? [];
  const improvement = callouts.find(
    (c) => c.tone === "warn" || c.tone === "critical",
  );
  if (improvement) {
    const label =
      improvement.dimension === "structural_adherence"
        ? "Structure"
        : DIMENSION_LABELS[improvement.dimension];
    const rewrite = improvement.suggestedRewrite?.trim();
    const sentence = rewrite
      ? `Next time: ${rewrite}`
      : improvement.title;
    return {
      dimensionLabel: label,
      polarity: "improvement",
      sentence,
    };
  }
  const positive = callouts.find((c) => c.tone === "positive");
  if (positive) {
    const label =
      positive.dimension === "structural_adherence"
        ? "Structure"
        : DIMENSION_LABELS[positive.dimension];
    return {
      dimensionLabel: label,
      polarity: "positive",
      sentence: positive.title,
    };
  }
  return {
    dimensionLabel: null,
    polarity: "neutral",
    sentence: "Clean rep. Rolling to the next one.",
  };
}
