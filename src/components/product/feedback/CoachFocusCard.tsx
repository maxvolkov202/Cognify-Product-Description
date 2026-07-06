"use client";

// PRD v3 §4.5.2 — THE Coach's Focus: one behavior, one card.
//
// "Every rep receives a single Coach's Focus… Users should never
// receive multiple primary coaching objectives simultaneously." This is
// the v2 feedback surface's second stage (Score → Coach's Focus → Core
// Skill Breakdown), replacing the legacy did-well/didn't-land split and
// the multi-bullet Next Rep Focus list.

import { Target } from "lucide-react";
import type { CoachFocus } from "@/lib/ai/coach-focus";
import { DIMENSION_LABELS } from "@/types/domain";

export function CoachFocusCard({
  focus,
  onSeeExample,
}: {
  focus: CoachFocus;
  /** Opens the Stronger Version exemplar when one exists (§4.6.1). */
  onSeeExample?: () => void;
}) {
  return (
    <section className="surface-card relative overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5 md:p-6">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-purple dark:text-brand-lavender">
          <Target className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          Coach&apos;s Focus · {DIMENSION_LABELS[focus.dimension] ?? focus.dimension}
        </p>
        <p className="mt-2 text-base font-semibold leading-snug text-ink-900 dark:text-white md:text-lg">
          {focus.text}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
          One behavior. Implement it on your Retry — that&apos;s the whole
          game.
        </p>
        {onSeeExample && (
          <button
            type="button"
            onClick={onSeeExample}
            className="mt-3 min-h-[44px] text-sm font-semibold text-brand-purple hover:text-brand-magenta dark:text-brand-lavender"
          >
            Hear a stronger version →
          </button>
        )}
      </div>
    </section>
  );
}
