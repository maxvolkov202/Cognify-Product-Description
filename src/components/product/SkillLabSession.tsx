"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { RepSurface } from "./RepSurface";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { WorkoutCountdown } from "./WorkoutCountdown";
import { SkillsFocusScope } from "./SkillsFocusContext";
import { bumpCompletedRepCount } from "./InstallPrompt";
import type { RepScore, SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS, SKILL_DIMENSION_GROUPS } from "@/types/domain";
import type { WorkoutSessionPlan } from "@/lib/ai/workout-prompts";
import type { PreviousRepSummary } from "./FeedbackPanel";

type Phase = "countdown" | "prompt-select" | "rep" | "done";

type Props = {
  plan: WorkoutSessionPlan;
  label: string;
  onExit: () => void;
};

/**
 * In-session runner for Skill Lab — minimal counterpart to WorkoutSession
 * that does not own a session-type picker, intro, or pause-to-dashboard
 * flow. Exit routes back to the lab lobby (provided by parent), not to
 * /dashboard, so the user stays in the lab between sets.
 */
export function SkillLabSession({ plan, label, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [scores, setScores] = useState<RepScore[]>([]);
  const [previousRepSummary, setPreviousRepSummary] =
    useState<PreviousRepSummary | null>(null);

  const currentRep = plan.reps[currentIndex];
  const activePrompt = selectedPrompts[currentIndex];

  // Pressure plans (sessionType='flow') auto-pick the first prompt so the
  // user goes straight into the rep — pressure is about reaction speed.
  useEffect(() => {
    if (
      phase === "prompt-select" &&
      plan.sessionType === "flow" &&
      currentRep &&
      !selectedPrompts[currentIndex]
    ) {
      const auto = currentRep.prompts[0];
      if (auto) {
        setSelectedPrompts((prev) => {
          const next = [...prev];
          next[currentIndex] = auto;
          return next;
        });
        setPhase("rep");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  function handleCountdownComplete() {
    setPhase("prompt-select");
  }

  function handlePromptSelected(prompt: string) {
    setSelectedPrompts((prev) => {
      const next = [...prev];
      next[currentIndex] = prompt;
      return next;
    });
    setPhase("rep");
  }

  function handleRepComplete({
    score,
    transcript,
  }: {
    score: RepScore;
    transcript: string;
  }) {
    bumpCompletedRepCount();
    setScores((prev) => [...prev, score]);
    const topWeakness =
      score.callouts.find(
        (c) => c.tone === "warn" || c.tone === "critical",
      ) ?? null;
    setPreviousRepSummary({
      composite: score.composite,
      dimensions: score.dimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
      })),
      topWeakness,
      transcript,
      promptText: activePrompt ?? "",
    });
  }

  function handleNext() {
    if (currentIndex + 1 >= plan.reps.length) {
      setPhase("done");
      return;
    }
    setCurrentIndex((i) => i + 1);
    setPhase("prompt-select");
  }

  if (phase === "countdown") {
    return (
      <SessionShell label={label} onExit={onExit}>
        <WorkoutCountdown from={3} onComplete={handleCountdownComplete} />
      </SessionShell>
    );
  }

  if (phase === "done") {
    const avg =
      scores.length === 0
        ? 0
        : Math.round(
            scores.reduce((s, x) => s + x.composite, 0) / scores.length,
          );
    return (
      <SessionShell label={label} onExit={onExit}>
        <DoneCard
          label={label}
          totalReps={scores.length}
          plannedReps={plan.reps.length}
          averageComposite={avg}
          scores={scores}
          onExit={onExit}
        />
      </SessionShell>
    );
  }

  if (!currentRep) return null;

  if (phase === "prompt-select") {
    return (
      <SessionShell label={label} onExit={onExit}>
        <SessionProgress index={currentIndex} total={plan.reps.length} />
        <WorkoutPromptSelect
          key={currentIndex}
          repType={currentRep.repType}
          initialPrompts={currentRep.prompts}
          repIndex={currentIndex}
          totalReps={plan.reps.length}
          focusReason={currentRep.focusReason ?? null}
          pressureArchetype={currentRep.pressureArchetype ?? null}
          timeBudgetSec={Math.round(currentRep.timeBudgetMs / 1000)}
          sessionType={plan.sessionType}
          focusDimension={plan.focusDimension ?? null}
          onSelect={handlePromptSelected}
        />
      </SessionShell>
    );
  }

  if (!activePrompt) return null;

  return (
    <SessionShell label={label} onExit={onExit}>
      <SkillsFocusScope
        primary={currentRep.repType.primaryDimension}
        secondary={currentRep.repType.secondaryDimensions}
      />
      <SessionProgress index={currentIndex} total={plan.reps.length} />
      <RepSurface
        key={currentIndex}
        prompt={activePrompt}
        mode="skill_lab"
        topic={
          currentRep.pressureArchetype
            ? `Pressure · ${currentRep.pressureArchetype.name}`
            : currentRep.repType.name
        }
        maxDurationMs={currentRep.timeBudgetMs}
        previousRepSummary={previousRepSummary}
        repTypeFramework={currentRep.framework}
        speakingThreshold={{ minRatio: 0.6 }}
        feedbackMode={plan.sessionType === "flow" ? "flow" : "full"}
        flowRepIndex={currentIndex + 1}
        flowTotalReps={plan.reps.length}
        flowArchetypeName={currentRep.pressureArchetype?.name}
        pressureArchetypeId={currentRep.pressureArchetype?.id ?? null}
        pressureContext={
          currentRep.pressureArchetype
            ? {
                archetypeName: currentRep.pressureArchetype.name,
                archetypeTagline: currentRep.pressureArchetype.tagline,
              }
            : null
        }
        onComplete={handleRepComplete}
        onNext={handleNext}
        nextLabel={
          currentIndex === plan.reps.length - 1
            ? "Finish set"
            : "Next rep"
        }
      />
    </SessionShell>
  );
}

function SessionShell({
  label,
  onExit,
  children,
}: {
  label: string;
  onExit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-500 hover:border-ink-300 hover:text-ink-900"
        >
          <ArrowLeft className="size-3" strokeWidth={2.5} />
          Exit lab
        </button>
        <p className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-700">
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function SessionProgress({ index, total }: { index: number; total: number }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
        Rep {index + 1} of {total}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              i < index
                ? "brand-gradient h-1.5 w-8 rounded-full"
                : i === index
                  ? "h-1.5 w-8 rounded-full bg-ink-400"
                  : "h-1.5 w-8 rounded-full bg-ink-200"
            }
          />
        ))}
      </div>
    </div>
  );
}

function DoneCard({
  label,
  totalReps,
  plannedReps,
  averageComposite,
  scores,
  onExit,
}: {
  label: string;
  totalReps: number;
  plannedReps: number;
  averageComposite: number;
  scores: RepScore[];
  onExit: () => void;
}) {
  const allDims: SkillDimension[] = [
    ...SKILL_DIMENSION_GROUPS.content,
    ...SKILL_DIMENSION_GROUPS.delivery,
  ];
  const dimAverages = allDims
    .map((dim) => {
      const vals = scores
        .map((rep) => rep.dimensions.find((d) => d.dimension === dim)?.score)
        .filter((v): v is number => typeof v === "number");
      const avg =
        vals.length === 0
          ? null
          : Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
      return { dim, avg };
    })
    .filter((x): x is { dim: SkillDimension; avg: number } => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="mx-auto max-w-2xl"
    >
      <div className="rounded-3xl border border-ink-200 bg-gradient-to-br from-brand-blue/10 via-white to-brand-magenta/10 p-7 shadow-[0_24px_64px_-24px_rgba(176,114,255,0.5)]">
        <div className="brand-gradient mx-auto grid size-14 place-items-center rounded-2xl">
          <Trophy className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <p className="mt-4 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
          {label} complete
        </p>
        <p className="mt-2 text-center text-5xl font-extrabold tabular-nums tracking-tight text-ink-900">
          {averageComposite}
        </p>
        <p className="mt-1 text-center text-sm text-ink-500">
          Average composite over {totalReps} of {plannedReps} reps.
        </p>
        {dimAverages.length > 0 && (
          <div className="mt-6 grid gap-2">
            {dimAverages.map(({ dim, avg }) => (
              <div
                key={dim}
                className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-semibold text-ink-700">
                  {DIMENSION_LABELS[dim]}
                </span>
                <span className="brand-gradient-text font-extrabold tabular-nums">
                  {avg}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onExit}
            className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm"
          >
            <RotateCcw className="size-4" strokeWidth={2.5} />
            Run another set
          </button>
        </div>
      </div>
    </motion.div>
  );
}
