"use client";

import { ChevronDown, Quote, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { Callout, SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
import { DIMENSION_ACCENTS } from "@/lib/skill-lab/mode-theme";
import { cn } from "@/lib/utils/cn";
import { Disclosure } from "./Disclosure";
import { useAudioControl } from "./AudioControlContext";
import { CalloutCorrectionRow } from "../CalloutCorrectionRow";
import { WhyThisMattersPopover } from "../WhyThisMattersPopover";

type Props = {
  dimension: SkillDimension;
  score: number;
  /** Grading v3 (§4.5.3) — the model's 1-2 sentence per-skill feedback
   *  (why this score + one coaching line). When present it leads the
   *  expanded panel; legacy reps fall back to per-dimension callouts. */
  feedback?: string;
  /** Pre-filtered to only callouts where `dimension === this dimension`.
   *  Legacy reps only — v4 reps emit no callouts. */
  callouts: Callout[];
  expanded: boolean;
  onToggle: () => void;
  /** When true, lifts the card with a gradient ring (focus dim or top
   *  stressed dim in pressure mode). Phase 1: passed by DimensionGrid based
   *  on simple highest/lowest score logic. */
  highlighted?: boolean;
  /** Optional. When present, animates the bar from 0 to score% after this
   *  delay. Used by DimensionGrid to stagger entrance. */
  delaySec?: number;
};

export function DimensionCard({
  dimension,
  score,
  feedback,
  callouts,
  expanded,
  onToggle,
  highlighted,
  delaySec = 0,
}: Props) {
  const accent = DIMENSION_ACCENTS[dimension];
  const rounded = Math.round(score);

  return (
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-ink-900 transition-shadow",
        expanded ? "border-brand-purple/40 shadow-sm" : "border-ink-200 dark:border-ink-700",
        highlighted && !expanded && "shadow-[0_0_0_1.5px_rgba(176,114,255,0.25)]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`dim-panel-${dimension}`}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <span className="flex-1 truncate text-[13px] font-bold text-ink-800 dark:text-ink-100">
          {DIMENSION_LABELS[dimension]}
        </span>
        <span className="text-sm font-extrabold tabular-nums text-ink-900 dark:text-white">
          {rounded}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-400 dark:text-ink-500 transition-transform",
            expanded && "rotate-180",
          )}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      <div className="px-3 pb-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{
              delay: delaySec,
              duration: 0.6,
              ease: [0.32, 0.72, 0, 1],
            }}
            style={{ backgroundColor: accent }}
            role="progressbar"
            aria-valuenow={rounded}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={DIMENSION_LABELS[dimension]}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
          {expanded ? "Tap to collapse" : "Tap to expand"}
        </p>
      </div>

      <div id={`dim-panel-${dimension}`}>
        <Disclosure open={expanded}>
          <div className="border-t border-ink-100 dark:border-ink-700 px-4 py-4 space-y-4">
            {/* Ch.18 — "Why this matters" popover trigger. Sits at the
             *  top of the expanded panel so users have a one-click path
             *  to the dim's chosen-because rationale + research sources
             *  while looking at their actual score on it. */}
            <div className="flex justify-end">
              <WhyThisMattersPopover dimension={dimension} />
            </div>
            {feedback && (
              <p className="text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
                {feedback}
              </p>
            )}
            {!feedback && callouts.length === 0 && (
              <p className="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                No specific moment to flag — score reflects overall consistency
                across the rep.
              </p>
            )}
            {callouts.map((callout, i) => (
              <CalloutDetail key={i} callout={callout} />
            ))}
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

function CalloutDetail({ callout }: { callout: Callout }) {
  const { seekToMs, getCalloutId } = useAudioControl();
  const isPositive = callout.tone === "positive" || callout.tone === "neutral";
  const accentText = isPositive ? "text-success" : "text-brand-purple dark:text-brand-lavender";
  // transcriptStart is nullable when the LLM couldn't ground the callout.
  // Hide the jump-to-moment button in that case rather than seek to 0.
  const hasTimestamp = callout.transcriptStart != null;
  const timestamp = hasTimestamp
    ? formatTimestamp(callout.transcriptStart!)
    : null;
  const calloutId = getCalloutId(callout);
  const showCorrection =
    !isPositive && calloutId && callout.dimension !== "structural_adherence";

  return (
    <div>
      <p className="text-[13px] font-bold text-ink-900 dark:text-white">{callout.title}</p>

      {callout.quote && (
        <blockquote className="mt-2 flex gap-2 rounded-lg bg-ink-50 dark:bg-ink-800 px-3 py-2 text-[13px] italic leading-relaxed text-ink-700 dark:text-ink-200">
          <Quote
            className="size-3 shrink-0 translate-y-1 text-ink-400 dark:text-ink-500"
            aria-hidden="true"
          />
          <span>&ldquo;{callout.quote}&rdquo;</span>
        </blockquote>
      )}

      <p className="mt-2 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
        <span className={cn("font-semibold", accentText)}>
          {isPositive
            ? callout.quote
              ? "Why it worked: "
              : "What worked across the response: "
            : callout.quote
              ? "Why it's an issue: "
              : "Across the response: "}
        </span>
        {callout.body}
      </p>

      {!isPositive && callout.suggestedRewrite && (
        <div className="mt-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-purple dark:text-brand-lavender">
            <Sparkles className="size-3" strokeWidth={2.5} aria-hidden="true" />
            {callout.quote ? "Try instead" : "Guiding principle"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-800 dark:text-ink-100">
            &ldquo;{callout.suggestedRewrite}&rdquo;
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {hasTimestamp && (
          <button
            type="button"
            onClick={() => seekToMs(callout.transcriptStart!)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-ink-600 dark:text-ink-300 transition-colors hover:border-ink-300 dark:hover:border-ink-600 hover:text-ink-900 dark:hover:text-white"
          >
            Jump to {timestamp}
          </button>
        )}
        {showCorrection && calloutId && (
          <CalloutCorrectionRow
            calloutId={calloutId}
            originalQuote={callout.quote}
            originalRewrite={callout.suggestedRewrite}
          />
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
