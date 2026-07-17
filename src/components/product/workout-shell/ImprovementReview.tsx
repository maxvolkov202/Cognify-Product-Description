"use client";

// PRD v3 Phase 1 — Improvement Review screen (PRD §4.7).
//
// Rendered at session phase "improvement-review", after the required
// Retry is scored. Answers one question: did implementing the Coach's
// Focus improve the rep? Score movement follows Owen C10 — celebrate
// positive deltas loudly, keep small negatives numeric-but-neutral, and
// hide big negative numbers behind soft copy.

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, RotateCcw, TrendingUp } from "lucide-react";
import { RepAudioScrubber } from "@/components/product/feedback/RepAudioScrubber";
import CelebrationSparkles from "./CelebrationSparkles";
import CountUpScore from "./CountUpScore";
import type { RepScore, SkillDimension } from "@/types/domain";
import {
  DIMENSION_LABELS,
  MUSCLE_GROUP_LABELS,
  type MuscleGroupId,
} from "@/types/domain";
import {
  deriveCoachFocus,
  deriveImplementationVerdict,
  softenScoreDelta,
  type ImplementationVerdict,
} from "@/lib/ai/coach-focus";
import { cn } from "@/lib/utils/cn";
import { DIM_THEMES } from "@/lib/workout/dim-theme";
import { DimensionGrid } from "@/components/product/feedback/DimensionGrid";

export type AttemptPayload = {
  repId: string;
  score: RepScore;
  transcript: string;
  /** Edit #12 — session-lifetime blob URL of the attempt's recording so
   *  the review can play both takes. Optional: hosts that don't hold
   *  the recording simply render no player. */
  audioUrl?: string | null;
  audioDurationMs?: number;
};

export type ImprovementReviewProps = {
  dimension: MuscleGroupId | null;
  first: AttemptPayload | null;
  retry: AttemptPayload | null;
  isLastStation: boolean;
  onRetryAgain: () => void;
  onAdvance: () => void;
  onQuit: () => void;
  /** PRD v3 Phase 5 — label overrides so non-workout hosts (Build a Rep
   *  guided practice) don't say "Next exercise". Defaults preserve the
   *  Daily Workout copy exactly. */
  advanceLabel?: string;
  quitLabel?: string;
};

const VERDICT_COPY: Record<
  ImplementationVerdict,
  { label: string; chip: string; blurb: string }
> = {
  nailed: {
    label: "Nailed it",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    blurb: "You implemented the coaching — that's the whole game.",
  },
  partial: {
    label: "Getting there",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    blurb: "The change showed up in places. One more pass would lock it in.",
  },
  missed: {
    label: "Not yet",
    chip: "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-ink-300",
    blurb: "The habit didn't shift this take — completely normal. It usually lands on the next one.",
  },
};

export default function ImprovementReview({
  dimension,
  first,
  retry,
  isLastStation,
  onRetryAgain,
  onAdvance,
  onQuit,
  advanceLabel,
  quitLabel,
}: ImprovementReviewProps) {
  const firstComposite = first?.score.composite ?? null;
  const retryComposite = retry?.score.composite ?? null;
  const delta =
    firstComposite != null && retryComposite != null
      ? Math.round(retryComposite - firstComposite)
      : null;
  const softened = delta != null ? softenScoreDelta(delta) : null;

  // Verdict: model's implementationReview wins; deterministic fallback
  // from the focus dimension's movement; "partial" when data is missing.
  const focus = first ? deriveCoachFocus(first.score) : null;
  const verdict: ImplementationVerdict =
    retry?.score.implementationReview?.verdict ??
    (focus && first && retry
      ? deriveImplementationVerdict({
          focusDimension: focus.dimension,
          firstDimensions: first.score.dimensions,
          retryDimensions: retry.score.dimensions,
        })
      : "partial");
  const verdictNote = retry?.score.implementationReview?.note ?? null;
  const verdictCopy = VERDICT_COPY[verdict];

  // Focus-dimension movement (shown raw only when it helps; C10).
  const focusDelta =
    focus && first && retry
      ? Math.round(
          (retry.score.dimensions.find((d) => d.dimension === focus.dimension)
            ?.score ?? 0) -
            (first.score.dimensions.find(
              (d) => d.dimension === focus.dimension,
            )?.score ?? 0),
        )
      : null;

  // Next development opportunity = the retry's own coach focus.
  const nextFocus = retry ? deriveCoachFocus(retry.score) : null;

  // Cognify treatment — dim identity for the score-movement accents.
  const theme = dimension ? DIM_THEMES[dimension] : null;

  // Reveal sequence timing (skipped entirely under reduced motion):
  // first score fades in → arrow at 0.3s → retry counts up from 0.45s
  // (0.9s count) → delta chip pops at 1.35s, when the count lands.
  const reduced = useReducedMotion();

  return (
    <div className="flex flex-col gap-4" data-testid="improvement-review">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
        <TrendingUp className="w-3.5 h-3.5" />
        Improvement Review
        {dimension && (
          <span className="text-slate-400 dark:text-ink-500 normal-case tracking-normal font-semibold">
            · {MUSCLE_GROUP_LABELS[dimension]}
          </span>
        )}
      </div>

      {/* Score movement hero. */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 text-center">
        {/* Dim-gradient hairline across the hero top. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r",
            theme
              ? theme.tile
              : "from-brand-blue via-brand-lavender to-brand-magenta",
          )}
        />
        {firstComposite != null && retryComposite != null ? (
          <>
            {/* Celebratory deltas earn the DayCompleteSummary sparkles
                behind the retry score. */}
            {softened?.tone === "celebrate" && <CelebrationSparkles />}
            <div className="flex items-center justify-center gap-3 text-3xl font-extrabold">
              <motion.span
                className="text-slate-400 dark:text-ink-500"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {Math.round(firstComposite)}
              </motion.span>
              <motion.span
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.25 }}
              >
                <ArrowRight className="w-5 h-5 text-slate-300 dark:text-ink-600" />
              </motion.span>
              {/* The "after" score carries the dim-gradient accent. */}
              <span
                className={cn(
                  theme
                    ? cn(
                        "bg-gradient-to-br bg-clip-text text-transparent",
                        theme.scoreGradient,
                      )
                    : "text-slate-900 dark:text-white",
                )}
              >
                <CountUpScore value={Math.round(retryComposite)} delay={0.45} />
              </span>
              {softened?.showNumeric && delta != null && (
                <motion.span
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.35, duration: 0.1 }}
                  style={reduced ? undefined : { animationDelay: "1.35s" }}
                  className={cn(
                    "animate-badge-pop text-base font-bold px-2 py-0.5 rounded-full",
                    softened.tone === "celebrate"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-ink-400",
                  )}
                >
                  {delta > 0 ? `+${delta}` : `${delta}`}
                </motion.span>
              )}
            </div>
            {softened?.tone === "soft" && (
              <p className="mt-2 text-xs text-slate-500 dark:text-ink-400">
                Slightly under your first take — normal when you&apos;re
                changing a habit mid-rep. The behavior matters more than the
                number.
              </p>
            )}
            {softened?.tone === "celebrate" &&
              focusDelta != null &&
              focus &&
              focusDelta > 0 && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  {DIMENSION_LABELS[focus.dimension as SkillDimension] ??
                    focus.dimension}{" "}
                  +{focusDelta} — the coaching landed.
                </p>
              )}
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-ink-400">
            We couldn&apos;t score one of the attempts — your reps are saved
            and the comparison will show on your progress page once
            re-graded.
          </p>
        )}
      </div>

      {/* Implementation verdict. */}
      <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-full",
              verdictCopy.chip,
            )}
            data-testid="implementation-verdict"
          >
            {verdictCopy.label}
          </span>
          {focus && (
            <span className="text-xs text-slate-500 dark:text-ink-400 truncate">
              Focus: {focus.text}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-700 dark:text-ink-200">
          {verdictNote ?? verdictCopy.blurb}
        </p>
      </div>

      {/* Next development opportunity (Coach's Focus). PRD §4.7 order:
          Score Movement → Implementation Review → Coach's Focus →
          Breakdown. */}
      {nextFocus && (
        <div className="rounded-xl border border-purple-200 dark:border-brand-lavender/30 bg-purple-50/60 dark:bg-ink-800 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-brand-lavender mb-1">
            Next development opportunity
          </div>
          {/* v4 scores carry the three-part focus; legacy falls back to
              the single text line. */}
          {nextFocus.behavior ? (
            <>
              <p className="text-sm font-semibold text-slate-800 dark:text-ink-100">
                {nextFocus.behavior}
              </p>
              {nextFocus.why && (
                <p className="mt-1 text-xs text-slate-600 dark:text-ink-300">
                  {nextFocus.why}
                </p>
              )}
              {nextFocus.action && (
                <p className="mt-2 rounded-lg bg-white/70 dark:bg-ink-900/60 px-3 py-2 text-[13px] font-semibold text-slate-800 dark:text-ink-100">
                  If you run it again: {nextFocus.action}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-800 dark:text-ink-100">
              {nextFocus.text}
            </p>
          )}
        </div>
      )}

      {/* Edit #12 — hear both takes. Session-lifetime blob URLs; rows
          render only when the host held onto the recordings. */}
      {(first?.audioUrl || retry?.audioUrl) && (
        <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 space-y-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500">
            Listen back
          </div>
          {first?.audioUrl && (
            <AttemptPlayback
              label="First take"
              src={first.audioUrl}
              durationMs={first.audioDurationMs ?? 0}
            />
          )}
          {retry?.audioUrl && (
            <AttemptPlayback
              label="Retry"
              src={retry.audioUrl}
              durationMs={retry.audioDurationMs ?? 0}
            />
          )}
        </div>
      )}

      {/* PRD §4.7.1 — "The same Core Skill Breakdown appears in both
          feedback screens." Per-skill first→retry movement on top
          (§4.7.2 examples show multi-skill deltas), C10-softened: big
          negatives render as the score alone, no scary number. */}
      {retry && (
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500 mb-2">
            Core Skill breakdown
          </div>
          {first && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {retry.score.dimensions.map((d) => {
                const before = first.score.dimensions.find(
                  (f) => f.dimension === d.dimension,
                );
                const delta =
                  before != null ? Math.round(d.score - before.score) : null;
                const showDelta = delta != null && delta >= -3 && delta !== 0;
                return (
                  <span
                    key={d.dimension}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 dark:bg-ink-800 border border-slate-100 dark:border-ink-700 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-ink-300 tabular-nums"
                  >
                    {DIMENSION_LABELS[d.dimension as SkillDimension] ??
                      d.dimension}{" "}
                    {Math.round(d.score)}
                    {showDelta && (
                      <span
                        className={cn(
                          "font-bold",
                          delta! > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 dark:text-ink-500",
                        )}
                      >
                        {delta! > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          <DimensionGrid
            dimensions={retry.score.dimensions}
            callouts={retry.score.callouts}
            primaryFocusDimension={retry.score.primaryFocusDimension}
          />
        </div>
      )}

      {/* Actions: Next is primary; Retry Again + Quit secondary (PRD §4.7 + C9). */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdvance}
          data-testid="review-advance"
          className={cn(
            "min-h-[48px] px-6 py-3 rounded-xl font-semibold",
            "brand-gradient text-white shadow-[var(--shadow-glow-sm)] hover:shadow-[var(--shadow-glow-md)] transition-shadow",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900",
          )}
        >
          {advanceLabel ?? (isLastStation ? "Finish workout →" : "Next exercise →")}
        </button>
        <button
          type="button"
          onClick={onRetryAgain}
          data-testid="review-retry-again"
          className={cn(
            "min-h-[48px] px-4 py-3 rounded-xl inline-flex items-center gap-2",
            "border border-slate-200 dark:border-ink-700 text-slate-600 dark:text-ink-300",
            "hover:bg-slate-50 dark:hover:bg-ink-800 font-semibold text-sm",
          )}
        >
          <RotateCcw className="w-4 h-4" />
          Run it again
        </button>
        <button
          type="button"
          onClick={onQuit}
          data-testid="review-quit"
          className="ml-auto text-xs text-slate-400 dark:text-ink-500 hover:text-slate-600 dark:hover:text-ink-300 font-semibold"
        >
          {quitLabel ?? "End session here"}
        </button>
      </div>
    </div>
  );
}

/** Edit #12 — one labeled playback row (its own audio ref so the two
 *  takes scrub independently). */
function AttemptPlayback({
  label,
  src,
  durationMs,
}: {
  label: string;
  src: string;
  durationMs: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-ink-400">
        {label}
      </div>
      <RepAudioScrubber src={src} durationMs={durationMs} audioRef={audioRef} />
    </div>
  );
}
