"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Target, Zap } from "lucide-react";
import { motion } from "motion/react";
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
      <PickerPhase
        currentScores={currentScores}
        onSelect={(dim) => startDrill(dim)}
      />
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

// ——— Brain Gym picker ———————————————————————————————————
// Each dimension is a "station" — a neural-style readout plus level + a
// CTA. Layout is a 2-col grid on mobile, 3-col on wide. The station flagged
// "Today's focus" is the user's weakest scored dimension (or first unscored
// station if nothing has been trained yet) — removes decision paralysis.

function PickerPhase({
  currentScores,
  onSelect,
}: {
  currentScores: Partial<Record<SkillDimension, number | null>>;
  onSelect: (dim: SkillDimension) => void;
}) {
  const focusDim = useMemo<SkillDimension | null>(() => {
    const unscored = SKILL_DIMENSIONS.find(
      (d) => typeof currentScores[d] !== "number",
    );
    if (unscored) return unscored;
    let weakest: SkillDimension | null = null;
    let min = Infinity;
    for (const d of SKILL_DIMENSIONS) {
      const s = currentScores[d];
      if (typeof s === "number" && s < min) {
        min = s;
        weakest = d;
      }
    }
    return weakest;
  }, [currentScores]);

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
          <Zap className="size-3" strokeWidth={3} />
          The Brain Gym
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
          Pick a station. Train the muscle.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-500">
          Each station drills one skill. Unlimited reps, no session cap —
          just volume on the muscle you&rsquo;re building.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SKILL_DIMENSIONS.map((dim, idx) => (
          <Station
            key={dim}
            dim={dim}
            score={currentScores[dim] ?? null}
            isFocus={focusDim === dim}
            index={idx}
            onSelect={() => onSelect(dim)}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50/40 px-4 py-3 text-xs text-ink-600">
        <p className="flex items-center gap-2">
          <Target className="size-3.5" strokeWidth={2.5} />
          <span>
            <strong className="text-ink-800">Daily Workout</strong> for mixed
            reps &middot; <strong className="text-ink-800">Brain Gym</strong>{" "}
            for deep single-skill volume. Both count toward your streak.
          </span>
        </p>
      </div>
    </div>
  );
}

function Station({
  dim,
  score,
  isFocus,
  index,
  onSelect,
}: {
  dim: SkillDimension;
  score: number | null;
  isFocus: boolean;
  index: number;
  onSelect: () => void;
}) {
  const hasScore = typeof score === "number";
  const isContent = (
    SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
  ).includes(dim);
  // Level comes from score band: 0=locked, 1=60-, 2=60-69, 3=70-79, 4=80-89, 5=90+
  const level = !hasScore
    ? 0
    : score < 60
      ? 1
      : score < 70
        ? 2
        : score < 80
          ? 3
          : score < 90
            ? 4
            : 5;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      className={cn(
        "group relative rounded-3xl border p-5 text-left transition-all",
        isFocus
          ? "border-transparent bg-gradient-to-br from-brand-blue/10 via-brand-lavender/10 to-brand-magenta/10 shadow-[0_20px_60px_-20px_rgba(176,114,255,0.6)]"
          : "border-ink-200 bg-gradient-to-br from-white via-white to-brand-lavender/5 hover:border-brand-purple/30 hover:shadow-[0_12px_40px_-16px_rgba(176,114,255,0.45)]",
      )}
    >
      {/* Gradient halo — only on focus station */}
      {isFocus && (
        <div
          className="pointer-events-none absolute -inset-0.5 rounded-3xl opacity-50 blur-2xl"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 0%, rgba(106,163,255,0.35), transparent 60%), radial-gradient(120% 80% at 80% 100%, rgba(231,124,240,0.35), transparent 60%)",
          }}
        />
      )}

      <div className="relative">
        {/* Focus badge — sits above the readout, not over it */}
        {isFocus && (
          <div className="mb-2 flex">
            <div className="brand-gradient inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_4px_12px_-2px_rgba(176,114,255,0.6)]">
              <Zap className="size-2.5" strokeWidth={3} />
              Today&rsquo;s focus
            </div>
          </div>
        )}

        {/* Neural readout */}
        <NeuralReadout score={score} isFocus={isFocus} hasScore={hasScore} />

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
                isContent
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "bg-brand-magenta/10 text-brand-magenta",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isContent ? "bg-brand-blue" : "bg-brand-magenta",
                )}
              />
              {isContent ? "Content" : "Delivery"}
            </p>
            <h3 className="mt-1.5 text-xl font-extrabold tracking-tight text-ink-900">
              {DIMENSION_LABELS[dim]}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            {hasScore ? (
              <>
                <p className="brand-gradient-text text-3xl font-extrabold tabular-nums leading-none">
                  {score}
                </p>
                <p className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-ink-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Lv&nbsp;{level}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-extrabold tabular-nums leading-none text-ink-300">
                  &mdash;
                </p>
                <p className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-500">
                  Untrained
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-purple opacity-0 transition-opacity group-hover:opacity-100">
            Train {DIMENSION_LABELS[dim].toLowerCase()}
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-colors",
                  hasScore ? "bg-brand-purple/40" : "bg-ink-200",
                )}
                style={{ width: hasScore ? `${8 + i * 4}px` : "6px" }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function NeuralReadout({
  score,
  isFocus,
  hasScore,
}: {
  score: number | null;
  isFocus: boolean;
  hasScore: boolean;
}) {
  // 16 rounded pill bars. Inactive = thin neutral rail that reads like
  // empty neural capacity; active = gradient-filled pills that breathe.
  // Isolated to the top of the card as the station's "EKG" — the visual
  // heartbeat that makes each card feel alive.
  const bars = 16;
  const activeCount = hasScore && typeof score === "number"
    ? Math.round((score / 100) * bars)
    : 0;

  return (
    <div
      className={cn(
        "relative flex h-12 items-end gap-[3px] rounded-xl p-1.5",
        isFocus
          ? "bg-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
          : hasScore
            ? "bg-ink-50/60"
            : "bg-white/40",
      )}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < activeCount;
        const baseHeight = 28 + (((i * 37) % 52));
        return (
          <motion.div
            key={i}
            className={cn(
              "flex-1 rounded-full",
              isActive
                ? "brand-gradient shadow-[0_1px_3px_0_rgba(176,114,255,0.35)]"
                : "bg-ink-200/60",
            )}
            style={{ height: `${baseHeight}%` }}
            animate={
              isActive
                ? {
                    height: [
                      `${baseHeight}%`,
                      `${Math.min(baseHeight + 28, 100)}%`,
                      `${baseHeight}%`,
                    ],
                  }
                : undefined
            }
            transition={
              isActive
                ? {
                    duration: 1.5 + (i % 4) * 0.18,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.07,
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
