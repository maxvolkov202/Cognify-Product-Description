"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Target } from "lucide-react";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import {
  REP_TYPES,
  type RepType,
} from "@/lib/ai/rep-types";
import type { ImprovementGoalId } from "@/lib/onboarding/constants";
import { pickWorkoutPrompts } from "@/lib/ai/prompts/workout";
import { RepSurface } from "./RepSurface";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { SkillsFocusScope } from "./SkillsFocusContext";
import { bumpCompletedRepCount } from "./InstallPrompt";
import { cn } from "@/lib/utils/cn";
import { GradientButton } from "@/components/shared/GradientButton";

type Props = {
  currentScores: Partial<Record<SkillDimension, number | null>>;
  /** Reserved for Phase 4.2 — will bias rep-type selection within a
   *  dim toward the user's improvement goals (same weighting as Daily
   *  Workout). Currently unused; drills are pure-dim filtered. */
  improvementGoals?: readonly ImprovementGoalId[];
};

type Phase =
  | { kind: "picker" }
  | {
      kind: "prompt-select";
      dim: SkillDimension;
      repType: RepType;
      prompts: string[];
    }
  | {
      kind: "rep";
      dim: SkillDimension;
      repType: RepType;
      prompt: string;
    };

/**
 * Skill Lab client — Direction.md Mode 2.
 *
 * Picker → unlimited-rep drill on one dimension. Each rep uses a rep
 * type that targets the chosen dim (primary preferred, secondary as
 * fallback) and re-shuffles prompts per rep. After feedback the user
 * either runs another (same dim, new rep type mix) or switches skill.
 *
 * No session cap. No pressure rep at N-1. This is deliberate: Skill
 * Lab is about volume on one muscle, not the Build→Stress→Reinforce
 * arc. Pressure training lives in Daily Workout where the arc is
 * shaped. Future: add a "pressure-under-this-skill" toggle for
 * archetype-focused drills.
 */
export function SkillLabClient({ currentScores }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "picker" });
  const [sessionCount, setSessionCount] = useState(0);
  const [lastRepTypeId, setLastRepTypeId] = useState<string | null>(null);

  /**
   * Pick the next rep type for the active drill. Priority:
   *   1. Primary-dim rep types
   *   2. Secondary-dim rep types
   *   3. Any rep type (fallback)
   * Excludes handle_pressure (pressure belongs in Daily Workout) and
   * the previous rep type so consecutive drills vary.
   */
  function pickRepTypeForDim(dim: SkillDimension): RepType {
    const primary = REP_TYPES.filter(
      (rt) =>
        rt.primaryDimension === dim &&
        rt.id !== "handle_pressure" &&
        rt.id !== lastRepTypeId,
    );
    const secondary = REP_TYPES.filter(
      (rt) =>
        rt.secondaryDimensions.includes(dim) &&
        rt.primaryDimension !== dim &&
        rt.id !== "handle_pressure" &&
        rt.id !== lastRepTypeId,
    );
    const pool =
      primary.length > 0
        ? primary
        : secondary.length > 0
          ? secondary
          : REP_TYPES.filter(
              (rt) =>
                rt.id !== "handle_pressure" && rt.id !== lastRepTypeId,
            );
    return pool[Math.floor(Math.random() * pool.length)] ?? REP_TYPES[0]!;
  }

  function startDrill(dim: SkillDimension) {
    const repType = pickRepTypeForDim(dim);
    setPhase({
      kind: "prompt-select",
      dim,
      repType,
      prompts: pickWorkoutPrompts(repType.id, 5),
    });
    setLastRepTypeId(repType.id);
  }

  function onPromptSelected(prompt: string) {
    if (phase.kind !== "prompt-select") return;
    setPhase({
      kind: "rep",
      dim: phase.dim,
      repType: phase.repType,
      prompt,
    });
  }

  function runAnother() {
    // Run another on the current dim with a fresh rep type selection.
    if (phase.kind === "rep") {
      const nextRepType = pickRepTypeForDim(phase.dim);
      setPhase({
        kind: "prompt-select",
        dim: phase.dim,
        repType: nextRepType,
        prompts: pickWorkoutPrompts(nextRepType.id, 5),
      });
      setLastRepTypeId(nextRepType.id);
      setSessionCount((n) => n + 1);
    }
  }

  function switchSkill() {
    setPhase({ kind: "picker" });
    setSessionCount(0);
    setLastRepTypeId(null);
  }

  // ——— Picker phase ——————————————————————————————————————————

  if (phase.kind === "picker") {
    return (
      <div>
        <div className="mb-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
            Skill Lab
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
            Drill one muscle.
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-500">
            Pick a dimension, run as many reps as you want on just that
            skill. No session cap, no pressure ramp — just volume on the
            thing you&rsquo;re working on.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SKILL_DIMENSIONS.map((dim) => {
            const score = currentScores[dim];
            const hasScore = typeof score === "number";
            const isContent = (
              SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
            ).includes(dim);
            return (
              <button
                key={dim}
                type="button"
                onClick={() => startDrill(dim)}
                className="group surface-card flex flex-col items-start gap-3 overflow-hidden p-6 text-left transition hover:shadow-[var(--shadow-glow)]"
              >
                <div className="brand-gradient h-1 w-full" aria-hidden="true" />
                <div className="flex w-full items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isContent ? "text-sky-700" : "text-rose-700",
                      )}
                    >
                      {isContent ? "Content" : "Delivery"}
                    </p>
                    <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">
                      {DIMENSION_LABELS[dim]}
                    </h3>
                  </div>
                  {hasScore && (
                    <div className="shrink-0 text-right">
                      <p className="brand-gradient-text text-3xl font-extrabold tabular-nums">
                        {score}
                      </p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                        current
                      </p>
                    </div>
                  )}
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple opacity-0 transition-opacity group-hover:opacity-100">
                  Drill {DIMENSION_LABELS[dim].toLowerCase()}
                  <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-ink-200 bg-ink-50/40 p-5 text-sm text-ink-600">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
            <Target className="size-3" strokeWidth={2.5} /> Skill Lab vs
            Daily Workout
          </p>
          <p className="mt-2 leading-relaxed">
            <strong className="text-ink-800">Daily Workout</strong> is 4–5
            reps across mixed dimensions with a required pressure rep —
            your daily practice. <strong className="text-ink-800">Skill
            Lab</strong> is single-dim volume on the muscle you want to
            drill faster. Both count toward your streak.
          </p>
        </div>
      </div>
    );
  }

  // ——— Prompt-select phase ——————————————————————————————————

  if (phase.kind === "prompt-select") {
    return (
      <>
        <SkillsFocusScope
          primary={phase.repType.primaryDimension}
          secondary={phase.repType.secondaryDimensions}
        />
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={switchSkill}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-3" strokeWidth={2.5} />
            Switch skill
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Drilling {DIMENSION_LABELS[phase.dim]} · {sessionCount + 1}
            {sessionCount === 0 ? "st" : sessionCount === 1 ? "nd" : "th"}{" "}
            rep
          </p>
        </div>
        <WorkoutPromptSelect
          repType={phase.repType}
          initialPrompts={phase.prompts}
          repIndex={0}
          totalReps={1}
          focusReason={null}
          pressureArchetype={null}
          timeBudgetSec={phase.repType.timeBudgetSec}
          onSelect={onPromptSelected}
        />
      </>
    );
  }

  // ——— Rep phase ——————————————————————————————————————————

  return (
    <>
      <SkillsFocusScope
        primary={phase.repType.primaryDimension}
        secondary={phase.repType.secondaryDimensions}
      />
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={switchSkill}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="size-3" strokeWidth={2.5} />
          Switch skill
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Drilling {DIMENSION_LABELS[phase.dim]}
        </p>
      </div>
      <RepSurface
        key={phase.prompt}
        prompt={phase.prompt}
        mode="daily_workout"
        topic={`Skill Lab · ${DIMENSION_LABELS[phase.dim]}`}
        maxDurationMs={phase.repType.timeBudgetSec * 1000}
        repTypeFramework={phase.repType.framework}
        speakingThreshold={{ minRatio: 0.6 }}
        feedbackMode="full"
        onComplete={() => {
          // Bump the completed-reps counter for the PWA install gate
          bumpCompletedRepCount();
        }}
        onNext={runAnother}
        nextLabel="Run another"
      />
      <div className="mt-4 flex justify-center">
        <GradientButton href="/skill-lab" variant="outline" size="sm">
          <RotateCw className="mr-2 size-3.5" /> Back to skill picker
        </GradientButton>
      </div>
    </>
  );
}
