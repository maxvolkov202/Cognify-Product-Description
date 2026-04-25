"use client";

import { useState, useEffect, useRef } from "react";
import { Pause, RotateCcw } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { WorkoutCountdown } from "./WorkoutCountdown";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { WorkoutEnd } from "./WorkoutEnd";
import { PersonalBestToast } from "./PersonalBestToast";
import { bumpCompletedRepCount } from "./InstallPrompt";
import { SkillsFocusScope } from "./SkillsFocusContext";
import type { RepScore, Callout, SkillDimension } from "@/types/domain";
import type { PreviousRepSummary } from "./FeedbackPanel";
import type { WorkoutSessionPlan } from "@/lib/ai/workout-prompts";
import { planNextRep } from "@/lib/ai/workout-prompts";
import type { RepTypeId } from "@/lib/ai/rep-types";
import {
  savePauseState,
  loadPauseState,
  clearPauseState,
} from "@/lib/workout/pause";
import type { ImprovementGoalId, VerticalId } from "@/lib/onboarding/constants";

type Props = {
  plan: WorkoutSessionPlan;
  streakDays?: number | null;
  yesterdayComposite?: number | null;
  /** User's improvement goals. Read by the server-side planner only; kept
   *  in props so future session-resume logic can re-plan if needed. */
  improvementGoals?: readonly ImprovementGoalId[];
  /** Per-dimension all-time maxes at the start of this session. */
  initialDimensionMaxes?: Partial<Record<SkillDimension, number | null>> | null;
  /** User's industry vertical. Propagated to plan regeneration paths. */
  vertical?: VerticalId | null;
};

type Phase = "resume-prompt" | "countdown" | "prompt-select" | "rep" | "done";

/**
 * Daily Workout orchestrator.
 *
 * Phase state machine:
 *   intro → countdown → (for each rep: prompt-select → rep) → done
 *
 * Key behaviors from team spec:
 *   - 5-prompt select per rep (with Refresh)
 *   - Retry-with-focus overlay on rep screen after a completed attempt
 *   - Retry replaces (not duplicates) the last score
 *   - Speaking threshold gate is enforced inside RepSurface
 *   - Between-rep pause via localStorage (24h expiry)
 *   - End-of-workout summary: daily score, Content/Delivery avg, tomorrow focus, streak
 */
export function WorkoutSession({
  plan: initialPlan,
  streakDays,
  yesterdayComposite,
  initialDimensionMaxes,
}: Props) {
  const [plan, setPlan] = useState(initialPlan);
  // Running max per dimension across this session. Initialized from the
  // server-provided historical maxes; updated in-session so a PB set on
  // rep 1 doesn't fire again if rep 3 merely matches it.
  const [dimensionMaxes, setDimensionMaxes] = useState<
    Partial<Record<SkillDimension, number>>
  >(() => {
    const out: Partial<Record<SkillDimension, number>> = {};
    if (initialDimensionMaxes) {
      for (const [k, v] of Object.entries(initialDimensionMaxes)) {
        if (typeof v === "number") out[k as SkillDimension] = v;
      }
    }
    return out;
  });
  const [personalBests, setPersonalBests] = useState<
    { dimension: SkillDimension; score: number }[]
  >([]);

  // Daily Workout = zero friction. The server-rendered plan drives
  // everything; we go straight to countdown unless there's a paused
  // session to resume. No client-side session-type override.
  const [phase, setPhase] = useState<Phase>("countdown");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [scores, setScores] = useState<RepScore[]>([]);
  const [retryFocus, setRetryFocus] = useState<Callout | null>(null);
  const [carryoverFocus, setCarryoverFocus] = useState<Callout | null>(null);
  const [previousRepSummary, setPreviousRepSummary] =
    useState<PreviousRepSummary | null>(null);
  const [completedRepTypeIds, setCompletedRepTypeIds] = useState<RepTypeId[]>(
    [],
  );
  // Force-remount RepSurface on retry via a bumping key
  const [repRetryNonce, setRepRetryNonce] = useState(0);
  const [, setCanResume] = useState(false);
  const checkedResumeRef = useRef(false);

  // On mount, check for resumable pause state. If found, intercept the
  // straight-to-countdown default and route through the resume prompt.
  useEffect(() => {
    if (checkedResumeRef.current) return;
    checkedResumeRef.current = true;
    const saved = loadPauseState();
    if (saved && saved.plan && Array.isArray(saved.plan.reps)) {
      setCanResume(true);
      setPhase("resume-prompt");
    }
  }, []);

  // Persist pause state between reps. Intentionally skipped during
  // rep/countdown so a mid-rep reload never restores a half-state.
  useEffect(() => {
    if (phase === "prompt-select") {
      savePauseState({
        plan,
        currentRepIndex: currentIndex,
        scores,
        selectedPrompts,
      });
    } else if (phase === "done") {
      clearPauseState();
    }
  }, [phase, currentIndex, scores, selectedPrompts, plan]);

  const currentRep = plan.reps[currentIndex];
  const activePrompt = selectedPrompts[currentIndex];

  // ——— Handlers ——————————————————————————————————————

  const handleStart = () => {
    setCanResume(false);
    clearPauseState();
    // Reset session state in case the user just dismissed a stale resume
    setCurrentIndex(0);
    setSelectedPrompts([]);
    setScores([]);
    setRetryFocus(null);
    setCarryoverFocus(null);
    setPreviousRepSummary(null);
    setCompletedRepTypeIds([]);
    setPhase("countdown");
  };

  const handleResume = () => {
    const saved = loadPauseState();
    if (!saved) {
      setCanResume(false);
      return;
    }
    setPlan(saved.plan);
    setCurrentIndex(saved.currentRepIndex);
    setSelectedPrompts(saved.selectedPrompts);
    setScores(saved.scores);
    setRetryFocus(null);
    setCarryoverFocus(null);
    setPreviousRepSummary(null);
    setCompletedRepTypeIds(
      saved.plan.reps
        .slice(0, saved.currentRepIndex)
        .map((r) => r.repType.id),
    );
    setCanResume(false);
    setPhase("prompt-select");
  };

  const handleCountdownComplete = () => setPhase("prompt-select");

  // Flow Session auto-advance — prompt-select is skipped because Flow's
  // orchestrator already committed to a specific prompt (momentum is
  // the point). When phase lands in prompt-select during a Flow session,
  // we select the first prompt and move straight to rep.
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
        setRetryFocus(null);
        setPhase("rep");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  const handlePromptSelected = (prompt: string) => {
    setSelectedPrompts((prev) => {
      const next = [...prev];
      next[currentIndex] = prompt;
      return next;
    });
    setRetryFocus(null);
    setPhase("rep");
  };

  const handleRepComplete = ({ score }: { score: RepScore }) => {
    // Append (or replace on retry — we already popped the old score in onRetry)
    setScores((prev) => [...prev, score]);
    // Count completed reps for the PWA install-prompt gate. Safe on
    // retry: we only record one increment per completion call, and the
    // gate just needs "≥3 completed reps" as a rough engagement signal.
    bumpCompletedRepCount();
    // Derive the next rep focus for a potential retry
    const focus =
      score.callouts.find(
        (c) => c.tone === "warn" || c.tone === "critical",
      ) ??
      score.callouts[0] ??
      null;
    setRetryFocus(focus);
  };

  const handleRepCompleteWithContext = ({
    score,
    transcript,
  }: {
    score: RepScore;
    transcript: string;
  }) => {
    handleRepComplete({ score });

    // Detect per-dimension personal bests. A dimension is a PB when:
    //   - the user has a prior max (skipping the user's very-first rep,
    //     which would trivially be a PB on every dim)
    //   - the new score strictly beats the prior max
    //   - OR the PB is >= 50 (skips micro-PBs on first-few-reps noise)
    const newBests: { dimension: SkillDimension; score: number }[] = [];
    const nextMaxes = { ...dimensionMaxes };
    for (const d of score.dimensions) {
      const prior = dimensionMaxes[d.dimension];
      if (typeof prior === "number" && d.score > prior && d.score >= 50) {
        newBests.push({ dimension: d.dimension, score: d.score });
        nextMaxes[d.dimension] = d.score;
      } else if (typeof prior !== "number" || d.score > prior) {
        // Quietly bump the running max even if we didn't show a toast
        // (e.g. user's first-ever rep, or sub-50 score). This stops
        // later reps from triggering a toast they shouldn't.
        nextMaxes[d.dimension] = d.score;
      }
    }
    setDimensionMaxes(nextMaxes);
    if (newBests.length > 0) {
      // Sort highest-score first so the headline PB is the most
      // impressive one. Cap at top 3 to keep the toast legible.
      newBests.sort((a, b) => b.score - a.score);
      setPersonalBests(newBests.slice(0, 3));
    }
    // Stash the summary so the NEXT rep's FeedbackPanel can compare.
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
  };

  const handleRepRetry = () => {
    // Pop the last-recorded score since we're re-doing this rep.
    // The retryFocus from that score stays in state and is shown on
    // the remounted RepSurface via the retryFocus prop.
    setScores((prev) => prev.slice(0, -1));
    setRepRetryNonce((n) => n + 1);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= plan.reps.length) {
      setPhase("done");
      return;
    }

    // Record the just-completed rep type so planNextRep can avoid repeating it.
    const completedTypeId = currentRep?.repType.id;
    const nextUsedTypes = completedTypeId
      ? [...completedRepTypeIds, completedTypeId]
      : completedRepTypeIds;
    setCompletedRepTypeIds(nextUsedTypes);

    // Build the previous-rep context from the most recent score and adjust
    // the next slot to target the weakest dimension.
    const justCompletedScore = scores[scores.length - 1];
    if (justCompletedScore && currentRep) {
      const adjusted = planNextRep({
        plan,
        nextIndex: currentIndex + 1,
        previousRep: {
          repTypeId: currentRep.repType.id,
          repTypeName: currentRep.repType.name,
          dimensions: justCompletedScore.dimensions.map((d) => ({
            dimension: d.dimension,
            score: d.score,
          })),
        },
        usedRepTypeIds: nextUsedTypes,
      });
      setPlan(adjusted);
    }

    // Promote the just-completed rep's focus to the carryover slot so the
    // next rep's idle overlay surfaces it. retryFocus is cleared because
    // we're moving forward, not retrying.
    setCarryoverFocus(retryFocus);
    setCurrentIndex((i) => i + 1);
    setRetryFocus(null);
    setPhase("prompt-select");
  };

  // ——— Render per phase ——————————————————————————————

  const toast = <PersonalBestToast dimensions={personalBests} />;

  if (phase === "resume-prompt") {
    return (
      <>
        <ResumePrompt
          onStartFresh={handleStart}
          onResume={handleResume}
        />
        {toast}
      </>
    );
  }

  if (phase === "countdown") {
    return (
      <>
        <WorkoutCountdown from={3} onComplete={handleCountdownComplete} />
        {toast}
      </>
    );
  }

  if (phase === "done") {
    return (
      <>
        <WorkoutEnd
          scores={scores}
          totalReps={plan.reps.length}
          streakDays={streakDays}
          yesterdayComposite={yesterdayComposite}
          plan={plan}
        />
        {toast}
      </>
    );
  }

  if (!currentRep) return null;

  if (phase === "prompt-select") {
    return (
      <>
        <div className="space-y-6">
          <div className="flex justify-end">
            <PauseWorkoutButton />
          </div>
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
        </div>
        {toast}
      </>
    );
  }

  // phase === "rep"
  if (!activePrompt) return null;

  return (
    <>
    <SkillsFocusScope
      primary={currentRep.repType.primaryDimension}
      secondary={currentRep.repType.secondaryDimensions}
    />
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Rep {currentIndex + 1} of {plan.reps.length} ·{" "}
          {currentRep.pressureArchetype
            ? `Pressure · ${currentRep.pressureArchetype.name}`
            : currentRep.repType.name}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5" aria-label="Session progress">
            {plan.reps.map((_, i) => (
              <div
                key={i}
                className={
                  i < currentIndex
                    ? "brand-gradient h-1.5 w-8 rounded-full"
                    : i === currentIndex
                      ? "h-1.5 w-8 rounded-full bg-ink-400"
                      : "h-1.5 w-8 rounded-full bg-ink-200"
                }
              />
            ))}
          </div>
          <PauseWorkoutButton compact />
        </div>
      </div>

      <RepSurface
        key={`${currentIndex}-${repRetryNonce}`}
        prompt={activePrompt}
        mode="daily_workout"
        topic={
          currentRep.pressureArchetype
            ? `Pressure · ${currentRep.pressureArchetype.name}`
            : currentRep.repType.name
        }
        maxDurationMs={currentRep.timeBudgetMs}
        retryFocus={retryFocus}
        carryoverFocus={carryoverFocus}
        previousRepSummary={
          previousRepSummary && !retryFocus ? previousRepSummary : null
        }
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
        onMidRepPause={() => {
          // Pause tile — cancel this rep cleanly and route to dashboard.
          // The workout's between-rep pause state (already saved to
          // localStorage) lets the user resume from /workout later.
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard";
          }
        }}
        onComplete={handleRepCompleteWithContext}
        onRetry={handleRepRetry}
        onNext={handleNext}
        nextLabel={
          currentIndex === plan.reps.length - 1
            ? "Finish workout"
            : "Next rep"
        }
      />
    </div>
    {toast}
    </>
  );
}

/**
 * Lean resume confirm. Only shown when localStorage has a paused session;
 * on a fresh /workout visit we go straight to countdown so there is zero
 * setup friction (per team-spec Daily Workout direction).
 */
function ResumePrompt({
  onResume,
  onStartFresh,
}: {
  onResume: () => void;
  onStartFresh: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-3xl border border-ink-200 bg-white p-6 text-center md:p-8">
        <div className="brand-gradient mx-auto grid size-12 place-items-center rounded-2xl">
          <RotateCcw className="size-5 text-white" strokeWidth={2.5} />
        </div>
        <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
          You paused earlier
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-ink-900">
          Pick up where you left off?
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Your completed reps are saved. Resume mid session, or start a fresh workout.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onResume}
            className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm"
          >
            Resume workout
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            className="inline-flex items-center justify-center rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

function PauseWorkoutButton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
        title="Pause the workout. Your completed reps are saved; resume from /workout."
      >
        <Pause className="size-3" strokeWidth={2.5} />
        Pause
      </a>
    );
  }
  return (
    <a
      href="/dashboard"
      className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
      title="Pause the workout. Your completed reps are saved; resume from /workout."
    >
      <Pause className="size-3.5" strokeWidth={2.5} />
      Pause workout
    </a>
  );
}

