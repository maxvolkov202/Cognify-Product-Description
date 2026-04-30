"use client";

import { useState } from "react";
import { RefreshCw, ArrowRight, Target } from "lucide-react";
import type { RepType } from "@/lib/ai/rep-types";
import { refreshRepPrompts } from "@/lib/ai/workout-prompts";
import type { PressureArchetype } from "@/lib/ai/pressure-archetypes";
import { pickPressurePrompts } from "@/lib/ai/prompts/pressure";
import { PressureRepIndicator } from "./PressureRepIndicator";
import { CircleTimer } from "./CircleTimer";
import { ProgressDots } from "./ProgressDots";
import {
  DIMENSION_LABELS,
  type RepFocusContext,
  type SkillDimension,
} from "@/types/domain";
import type { SessionType } from "@/lib/ai/workout-prompts";

type Props = {
  repType: RepType;
  initialPrompts: string[];
  repIndex: number;
  totalReps: number;
  /** Why this rep has the focus it has — replaces the legacy
   *  focusReason field. Surfaces as an inline banner above the prompt
   *  list when source is carryover or pressure_residue. session_intent
   *  is suppressed here (the LastRepFocusBanner above the post-rep score
   *  surface is the canonical place for that). */
  focus?: RepFocusContext | null;
  /** When set, this rep is a pressure rep. The prompt-select header
   *  shifts to name the archetype, PressureRepIndicator surfaces above
   *  the prompt list, and Refresh pulls from the archetype's prompt
   *  bank rather than the rep type's default bank. */
  pressureArchetype?: PressureArchetype | null;
  /** Time budget in seconds for this specific slot — overrides
   *  repType.timeBudgetSec when the archetype shortens/lengthens the rep
   *  (e.g. Time Compression cuts to 20s). Falls back to rep type default. */
  timeBudgetSec?: number;
  /** Parent session type — renders the session-identity chip ("Focus ·
   *  Clarity", "Build", "Stress", "Reinforce", "Flow") above the title
   *  so the user remembers what they signed up for every rep. */
  sessionType?: SessionType;
  /** For Focus sessions, the dimension being drilled. */
  focusDimension?: SkillDimension | null;
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
  focus,
  pressureArchetype,
  timeBudgetSec,
  sessionType,
  focusDimension,
  onSelect,
}: Props) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Session-identity phase chip — shown above the rep title so the user
  // remembers the session's shape every rep. For Combined sessions with
  // the Build→Stress→Reinforce arc:
  //   reps 0..N-3 = Build
  //   rep N-2    = Stress (pressure rep lives here)
  //   rep N-1    = Reinforce
  const sessionPhase = ((): { label: string; accent: "purple" | "amber" | "emerald" | "sky" } | null => {
    if (sessionType === "focus" && focusDimension) {
      return {
        label: `Focus · ${DIMENSION_LABELS[focusDimension]}`,
        accent: "purple",
      };
    }
    if (sessionType === "flow") {
      return { label: `Flow · rep ${repIndex + 1} of ${totalReps}`, accent: "amber" };
    }
    if (sessionType === "combined") {
      if (repIndex === totalReps - 2 && pressureArchetype) {
        return { label: "Stress phase", accent: "amber" };
      }
      if (repIndex === totalReps - 1) {
        return { label: "Reinforce phase", accent: "emerald" };
      }
      return { label: "Build phase", accent: "sky" };
    }
    return null;
  })();

  const effectiveBudgetSec = timeBudgetSec ?? repType.timeBudgetSec;
  const headerInstruction = pressureArchetype
    ? pressureArchetype.tagline
    : repType.displayTitle;
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
        <div className="min-w-0 flex-1">
          <ProgressDots
            current={repIndex + 1}
            total={totalReps}
            label={
              pressureArchetype
                ? `Rep ${repIndex + 1} of ${totalReps} · Pressure · ${pressureArchetype.name}`
                : `Rep ${repIndex + 1} of ${totalReps} · ${repType.name}`
            }
          />
          {sessionPhase && (
            <span
              className={
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] " +
                (sessionPhase.accent === "purple"
                  ? "bg-brand-purple/10 text-brand-purple"
                  : sessionPhase.accent === "amber"
                    ? "bg-amber-100 text-amber-800"
                    : sessionPhase.accent === "emerald"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-sky-100 text-sky-800")
              }
            >
              {sessionPhase.label}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
            {headerInstruction}
          </h1>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-600">
            <span
              className="size-1.5 rounded-full bg-brand-purple"
              aria-hidden="true"
            />
            Training: {DIMENSION_LABELS[repType.primaryDimension]}
          </p>
          <p className="mt-1 text-xs text-ink-500">{headerBehavior}</p>
        </div>
        <CircleTimer seconds={effectiveBudgetSec} />
      </div>

      {pressureArchetype ? (
        <div className="mb-4">
          <PressureRepIndicator archetype={pressureArchetype} />
        </div>
      ) : null}

      {focus && focus.source !== "session_intent" ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-3 py-2.5"
          role="status"
          aria-label="Why this rep was chosen"
        >
          <Target className="mt-0.5 size-3.5 shrink-0 text-brand-purple" />
          <div className="text-[11px] leading-snug text-ink-700">
            <span className="font-semibold text-brand-purple">
              {focus.source === "pressure_residue"
                ? "Pressure rollover."
                : `Focusing on ${DIMENSION_LABELS[focus.dimension].toLowerCase()}.`}
            </span>{" "}
            {focus.bannerText}
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
