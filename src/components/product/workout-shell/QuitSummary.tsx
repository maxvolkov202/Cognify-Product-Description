"use client";

// PRD v3 Phase 1 — Quit-session exit screen (Owen C9).
//
// Rendered at session phase "quit-summary" when the user ends the day
// early (out of time, or satisfied). Instead of a guilt trip, the exit
// hands them one real-life tip for TODAY keyed to the skill they just
// trained — "you improved your pacing this morning; find a moment at
// work to practice slow, steady speech."

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DIM_THEMES } from "@/lib/workout/dim-theme";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";

export type QuitSummaryProps = {
  dimension: MuscleGroupId | null;
  /** Composite delta of the best retry vs its first rep, if any rep
   *  completed a full loop this session. Shapes the tip's opening line. */
  bestDelta: number | null;
  repsCompleted: number;
};

/** Static tip bank, Phase 1. Phase 3's coaching memory replaces these
 *  with personalized tips generated from the session's actual focus. */
const REAL_LIFE_TIPS: Record<MuscleGroupId, string> = {
  clarity:
    "Next time you explain something today, open with the version a newcomer would understand — then add detail only if they ask.",
  structure:
    "In your next conversation that matters today, say your main point first, then give the reasons. Answer-first, always.",
  conciseness:
    "Pick one message or reply today and cut it in half before sending. Notice what survived — that was the actual point.",
  thinking_quality:
    "Next time you state an opinion today, attach the reason in the same breath: 'I think X because Y.' No floating claims.",
  pacing:
    "Find one moment today to pause for a full beat before your most important sentence. Let the silence do some work.",
  tone:
    "In one conversation today, match your voice to what the other person needs — steady if they're stressed, warm if they're down.",
};

export default function QuitSummary({
  dimension,
  bestDelta,
  repsCompleted,
}: QuitSummaryProps) {
  const dimLabel = dimension ? MUSCLE_GROUP_LABELS[dimension] : null;
  const tip = dimension ? REAL_LIFE_TIPS[dimension] : null;
  // Quiet Cognify accent — one dim-gradient hairline on the tip card.
  const theme = dimension ? DIM_THEMES[dimension] : null;

  return (
    <div
      className="flex flex-col items-center text-center gap-3 py-2"
      data-testid="quit-summary"
    >
      <Sparkles className="w-5 h-5 text-purple-500 dark:text-brand-lavender" />
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        Good session.
      </h2>
      <p className="text-sm text-slate-500 dark:text-ink-400">
        {repsCompleted > 0
          ? bestDelta != null && bestDelta > 0 && dimLabel
            ? `You moved your ${dimLabel} +${Math.round(bestDelta)} between attempts today.`
            : `${repsCompleted} ${repsCompleted === 1 ? "rep" : "reps"} in the bank${dimLabel ? ` on ${dimLabel}` : ""}.`
          : "Showing up counts. The reps will be here tomorrow."}
      </p>

      {tip && (
        <div className="relative overflow-hidden mt-1 rounded-xl border border-purple-200 dark:border-brand-lavender/30 bg-purple-50/60 dark:bg-ink-800 p-4 max-w-md">
          {theme && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80",
                theme.tile,
              )}
            />
          )}
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-brand-lavender mb-1">
            Take it into the real world
          </div>
          <p className="text-sm text-slate-800 dark:text-ink-100">{tip}</p>
        </div>
      )}

      <Link
        href="/dashboard"
        className="mt-2 min-h-[44px] px-5 py-2.5 rounded-xl font-semibold bg-pink-500 hover:bg-pink-400 text-white inline-flex items-center"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
