"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Target } from "lucide-react";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import type { RepScore, SkillDimension } from "@/types/domain";
import type { PreviousRepSummary } from "./FeedbackPanel";
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
  // In-session progression context — carried between reps so the
  // FeedbackPanel can render the rep-to-rep delta pills + "what moved"
  // callouts. Reset on switchSkill.
  const [previousRepSummary, setPreviousRepSummary] =
    useState<PreviousRepSummary | null>(null);
  const [previousDimensionScores, setPreviousDimensionScores] = useState<
    Partial<Record<SkillDimension, number>> | undefined
  >(undefined);

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
    setPreviousRepSummary(null);
    setPreviousDimensionScores(undefined);
  }

  function handleRepComplete({
    score,
    transcript,
  }: {
    score: RepScore;
    transcript?: string;
  }) {
    bumpCompletedRepCount();
    // Stash this rep as the "previous" for the next one's FeedbackPanel.
    const sortedByScore = [...score.dimensions].sort((a, b) => a.score - b.score);
    const weakest = sortedByScore[0] ?? null;
    const weaknessCallout =
      weakest &&
      (score.callouts.find((c) => c.dimension === weakest.dimension) ?? null);
    const promptText =
      phase.kind === "rep" ? phase.prompt : "";
    setPreviousRepSummary({
      composite: score.composite,
      dimensions: score.dimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
      })),
      topWeakness: weaknessCallout ?? null,
      transcript: transcript ?? "",
      promptText,
    });
    const nextScores: Partial<Record<SkillDimension, number>> = {};
    for (const d of score.dimensions) nextScores[d.dimension] = d.score;
    setPreviousDimensionScores(nextScores);
  }

  /** Ordinal suffix for session count display — handles teens + 21st/22nd/23rd. */
  function ordinalSuffix(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    switch (n % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
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
                  <div className="shrink-0 text-right">
                    {hasScore ? (
                      <>
                        <p className="brand-gradient-text text-3xl font-extrabold tabular-nums">
                          {score}
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                          current
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-extrabold tabular-nums text-ink-300">
                          —
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                          No data yet
                        </p>
                      </>
                    )}
                  </div>
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
            {ordinalSuffix(sessionCount + 1)} rep
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
        mode="skill_lab"
        topic={`Skill Lab · ${DIMENSION_LABELS[phase.dim]}`}
        maxDurationMs={phase.repType.timeBudgetSec * 1000}
        repTypeFramework={phase.repType.framework}
        speakingThreshold={{ minRatio: 0.6 }}
        feedbackMode="full"
        previousRepSummary={previousRepSummary}
        previousDimensionScores={previousDimensionScores}
        onComplete={handleRepComplete}
        onNext={runAnother}
        nextLabel="Run another"
      />
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={switchSkill}
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 hover:text-ink-900"
        >
          <RotateCw className="size-3.5" strokeWidth={2.5} />
          Back to skill picker
        </button>
      </div>
    </>
  );
}
