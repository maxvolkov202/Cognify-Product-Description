"use client";

// PRD v3 §4.5.2 — THE Coach's Focus: one behavior, one card.
//
// "Every rep receives a single Coach's Focus… Users should never
// receive multiple primary coaching objectives simultaneously." This is
// the feedback surface's second stage (Score → Coach's Focus → Core
// Skill Breakdown). Grading v3 (§8.6.2): the focus carries the three
// coaching questions — what behavior held you back, why it matters,
// what to do differently — and the §4.6 Stronger Version (the user's
// own content, upgraded) when scoring produced one.

import { Target } from "lucide-react";
import type { CoachFocus } from "@/lib/ai/coach-focus";
import { DIMENSION_LABELS } from "@/types/domain";

export function CoachFocusCard({
  focus,
  strongerVersion,
  onSeeExample,
}: {
  focus: CoachFocus;
  /** §4.6 Stronger Version — a rewrite of what the user actually said.
   *  v4 reps emit it first-class; legacy reps scavenge a callout
   *  suggestedRewrite. Null hides the block. */
  strongerVersion?: { quote: string | null; rewrite: string } | null;
  /** Opens the audio exemplar when one exists. */
  onSeeExample?: () => void;
}) {
  // v4 focuses carry the three-part structure; legacy focuses only text.
  const behavior = focus.behavior ?? focus.text;
  const why = focus.why ?? null;
  const action = focus.action ?? null;

  return (
    <section className="surface-card relative overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5 md:p-6">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-purple dark:text-brand-lavender">
          <Target className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          Coach&apos;s Focus · {DIMENSION_LABELS[focus.dimension] ?? focus.dimension}
        </p>
        <p className="mt-2 text-base font-semibold leading-snug text-ink-900 dark:text-white md:text-lg">
          {behavior}
        </p>
        {why && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
            {why}
          </p>
        )}
        {action ? (
          <p className="mt-2 rounded-lg bg-brand-purple/5 px-3 py-2 text-[13px] font-semibold leading-relaxed text-ink-800 dark:bg-brand-purple/15 dark:text-ink-100">
            On your retry: {action}
          </p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
            One behavior. Implement it on your Retry. That&apos;s the whole
            game.
          </p>
        )}
        {strongerVersion && (
          <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2.5 dark:bg-ink-800">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
              Stronger version
            </p>
            {strongerVersion.quote && (
              <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                You said: &ldquo;{strongerVersion.quote}&rdquo;
              </p>
            )}
            <p className="mt-1 text-xs italic leading-relaxed text-ink-700 dark:text-ink-200">
              &ldquo;{strongerVersion.rewrite}&rdquo;
            </p>
          </div>
        )}
        {onSeeExample && (
          <button
            type="button"
            onClick={onSeeExample}
            className="mt-3 min-h-[44px] text-sm font-semibold text-brand-purple hover:text-brand-magenta dark:text-brand-lavender"
          >
            Hear an example →
          </button>
        )}
      </div>
    </section>
  );
}
