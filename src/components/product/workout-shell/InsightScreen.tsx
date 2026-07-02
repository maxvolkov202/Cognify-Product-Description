"use client";

// PRD v3 Phase 1 — Coach's Insight screen (PRD §4.3).
//
// Shown between prompt selection and recording in the v2 engine loop
// (session phase "insight"). Per Owen C19, the user picks the TOPIC
// first, then the system reveals its constraint here — one specific,
// immediately-usable behavior cue plus the response window, consumable
// in seconds. Not a lesson.

import { Lightbulb, Mic, Timer } from "lucide-react";
import type { ShellStation } from "@/lib/workout/types";
import type { MuscleGroupId } from "@/types/domain";
import { MUSCLE_GROUP_LABELS } from "@/types/domain";
import type { RepTypeFramework } from "@/lib/ai/rep-types";
import { cn } from "@/lib/utils/cn";

export type InsightScreenProps = {
  station: ShellStation;
  promptText: string;
  dimension: MuscleGroupId | null;
  framework?: RepTypeFramework | undefined;
  onReady: () => void;
};

export default function InsightScreen({
  station,
  promptText,
  dimension,
  framework,
  onReady,
}: InsightScreenProps) {
  // ADR-001 response window: per-exercise framework field when the
  // catalog row is enriched, 60–90s default otherwise.
  const windowSec = station.responseWindow
    ? { min: station.responseWindow.minSec, max: station.responseWindow.maxSec }
    : { min: 60, max: 90 };
  return (
    <div className="flex flex-col gap-4" data-testid="insight-screen">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
        <Lightbulb className="w-3.5 h-3.5" />
        Coach&apos;s Insight
        {dimension && (
          <span className="text-slate-400 dark:text-ink-500 normal-case tracking-normal font-semibold">
            · {MUSCLE_GROUP_LABELS[dimension]}
          </span>
        )}
      </div>

      {/* The single-behavior cue: exercise rule, with the why beneath.
          When the framework carries an objective, it leads — the rule
          becomes the enforcement line under it. */}
      <div className="rounded-xl border border-purple-200 dark:border-brand-lavender/30 bg-purple-50/60 dark:bg-ink-800 p-4">
        <p className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
          {station.rule}
        </p>
        {(station.objective ?? station.why) && (
          <p className="mt-1.5 text-sm text-slate-600 dark:text-ink-300">
            {station.objective ?? station.why}
          </p>
        )}
      </div>

      {/* The prompt they picked, restated so they walk in primed. */}
      <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500 mb-1">
          Your prompt
        </div>
        <p className="text-sm text-slate-800 dark:text-ink-100">{promptText}</p>
        {framework && (
          <p className="mt-2 text-xs text-slate-500 dark:text-ink-400">
            Structure to hold:{" "}
            <span className="font-semibold">
              {framework.sections.map((s) => s.label).join(" → ")}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-ink-400">
          <Timer className="w-3.5 h-3.5" />
          {windowSec.min}–{windowSec.max}s response window
        </span>
        <button
          type="button"
          onClick={onReady}
          data-testid="insight-ready"
          className={cn(
            "min-h-[48px] px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2",
            "bg-pink-500 hover:bg-pink-400 text-white",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
          )}
        >
          <Mic className="w-4 h-4" />
          I&apos;m ready
        </button>
      </div>
    </div>
  );
}
