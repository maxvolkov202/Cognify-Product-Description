"use client";

import { useState } from "react";
import { RefreshCw, ArrowRight, Timer, Target } from "lucide-react";
import type { RepType } from "@/lib/ai/rep-types";
import { refreshRepPrompts } from "@/lib/ai/workout-prompts";
import type { FocusReason } from "@/lib/ai/workout-prompts";
import type { PressureArchetype } from "@/lib/ai/pressure-archetypes";
import { pickPressurePrompts } from "@/lib/ai/prompts/pressure";
import { PressureRepIndicator } from "./PressureRepIndicator";

type Props = {
  repType: RepType;
  initialPrompts: string[];
  repIndex: number;
  totalReps: number;
  focusReason?: FocusReason | null;
  /** When set, this rep is a pressure rep. The prompt-select header
   *  shifts to name the archetype, PressureRepIndicator surfaces above
   *  the prompt list, and Refresh pulls from the archetype's prompt
   *  bank rather than the rep type's default bank. */
  pressureArchetype?: PressureArchetype | null;
  /** Time budget in seconds for this specific slot — overrides
   *  repType.timeBudgetSec when the archetype shortens/lengthens the rep
   *  (e.g. Time Compression cuts to 20s). Falls back to rep type default. */
  timeBudgetSec?: number;
  onSelect: (prompt: string) => void;
};

/**
 * The 5-prompt selection screen per rep (team spec).
 *
 * Shows 5 prompts from the rep type's bank with a Refresh button to
 * pull a new shuffle from the same bank. User must pick one prompt
 * before Start Rep is enabled.
 *
 * For pressure reps (`pressureArchetype` set), the UI shifts:
 *   - Header reads "Pressure Rep · {archetype.name}" instead of the
 *     rep type's name
 *   - PressureRepIndicator surfaces above the prompts with tagline +
 *     "What to expect" expander
 *   - Refresh pulls from the archetype's prompt bank (not the rep
 *     type's default pushback bank)
 *   - Time budget respects the archetype's durationDeltaSec
 */
export function WorkoutPromptSelect({
  repType,
  initialPrompts,
  repIndex,
  totalReps,
  focusReason,
  pressureArchetype,
  timeBudgetSec,
  onSelect,
}: Props) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const effectiveBudgetSec = timeBudgetSec ?? repType.timeBudgetSec;
  const headerKicker = pressureArchetype
    ? `Rep ${repIndex + 1} of ${totalReps} · Pressure · ${pressureArchetype.name}`
    : `Rep ${repIndex + 1} of ${totalReps} · ${repType.name}`;
  const headerInstruction = pressureArchetype
    ? pressureArchetype.tagline
    : repType.instruction;
  const headerBehavior = pressureArchetype
    ? "Read the prompt carefully before you start — the pressure is baked in."
    : repType.behavior;

  function handleRefresh() {
    const newPrompts = pressureArchetype
      ? pickPressurePrompts(pressureArchetype.id, 5)
      : refreshRepPrompts(repType.id);
    setPrompts(newPrompts);
    setSelectedIdx(null);
    setRefreshCount((c) => c + 1);
  }

  function handleContinue() {
    if (selectedIdx === null) return;
    const chosen = prompts[selectedIdx];
    if (!chosen) return;
    onSelect(chosen);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            {headerKicker}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
            {headerInstruction}
          </h1>
          <p className="mt-2 text-sm text-ink-600">{headerBehavior}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-ink-200 bg-white px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            <Timer className="size-3" /> Budget
          </div>
          <div className="brand-gradient-text mt-1 text-2xl font-extrabold tabular-nums">
            {effectiveBudgetSec}s
          </div>
        </div>
      </div>

      {pressureArchetype ? (
        <div className="mb-4">
          <PressureRepIndicator archetype={pressureArchetype} />
        </div>
      ) : null}

      {focusReason ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-3 py-2.5"
          role="status"
          aria-label="Why this rep was chosen"
        >
          <Target className="mt-0.5 size-3.5 shrink-0 text-brand-purple" />
          <div className="text-[11px] leading-snug text-ink-700">
            <span className="font-semibold text-brand-purple">
              Focusing on {focusReason.dimension}.
            </span>{" "}
            {focusReason.summary}
          </div>
        </div>
      ) : null}

      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Pick a prompt
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
          aria-label="Refresh prompts"
        >
          <RefreshCw
            className={`size-3 transition-transform ${refreshCount > 0 ? "rotate-180" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div
        key={refreshCount}
        className="mt-3 space-y-2 animate-in fade-in duration-300"
      >
        {prompts.map((prompt, i) => {
          const active = selectedIdx === i;
          return (
            <button
              key={`${refreshCount}-${i}`}
              type="button"
              onClick={() => setSelectedIdx(i)}
              aria-pressed={active}
              className={`w-full text-left rounded-xl border p-4 transition ${
                active
                  ? "border-ink-900 bg-white shadow-sm ring-2 ring-ink-900/10"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <p className="text-sm text-ink-800 md:text-base">{prompt}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-center">
        <button
          type="button"
          onClick={handleContinue}
          disabled={selectedIdx === null}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start rep <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
