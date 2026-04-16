"use client";

import { useState, useEffect, useRef } from "react";
import { RepSurface } from "./RepSurface";
import { WorkoutIntro } from "./WorkoutIntro";
import { WorkoutCountdown } from "./WorkoutCountdown";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { WorkoutEnd } from "./WorkoutEnd";
import type { RepScore, Callout } from "@/types/domain";
import type { PreviousRepSummary } from "./FeedbackPanel";
import type { WorkoutSessionPlan } from "@/lib/ai/workout-prompts";
import { planNextRep } from "@/lib/ai/workout-prompts";
import type { RepTypeId } from "@/lib/ai/rep-types";
import {
  savePauseState,
  loadPauseState,
  clearPauseState,
} from "@/lib/workout/pause";

type Props = {
  plan: WorkoutSessionPlan;
  streakDays?: number | null;
  yesterdayComposite?: number | null;
};

type Phase = "intro" | "countdown" | "prompt-select" | "rep" | "done";

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
}: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [phase, setPhase] = useState<Phase>("intro");
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
  const [canResume, setCanResume] = useState(false);
  const checkedResumeRef = useRef(false);

  // On mount, check for resumable pause state.
  useEffect(() => {
    if (checkedResumeRef.current) return;
    checkedResumeRef.current = true;
    const saved = loadPauseState();
    if (saved && saved.plan && Array.isArray(saved.plan.reps)) {
      setCanResume(true);
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

  if (phase === "intro") {
    return (
      <WorkoutIntro
        plan={plan}
        hasResumeState={canResume}
        onStart={handleStart}
        onResume={handleResume}
      />
    );
  }

  if (phase === "countdown") {
    return <WorkoutCountdown from={3} onComplete={handleCountdownComplete} />;
  }

  if (phase === "done") {
    return (
      <WorkoutEnd
        scores={scores}
        totalReps={plan.reps.length}
        streakDays={streakDays}
        yesterdayComposite={yesterdayComposite}
      />
    );
  }

  if (!currentRep) return null;

  if (phase === "prompt-select") {
    return (
      <WorkoutPromptSelect
        key={currentIndex}
        repType={currentRep.repType}
        initialPrompts={currentRep.prompts}
        repIndex={currentIndex}
        totalReps={plan.reps.length}
        focusReason={currentRep.focusReason ?? null}
        onSelect={handlePromptSelected}
      />
    );
  }

  // phase === "rep"
  if (!activePrompt) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Rep {currentIndex + 1} of {plan.reps.length} ·{" "}
          {currentRep.repType.name}
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
          {/* Save & exit — workout state auto-saves between reps to
              localStorage. Clicking this routes away; user sees "Resume"
              when they return to /workout. Current in-progress rep is
              lost, but completed reps are preserved. */}
          <a
            href="/dashboard"
            className="hidden items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400 hover:text-ink-700 sm:inline-flex"
            title="Your completed reps are saved. Resume later from /workout."
          >
            Save &amp; exit
          </a>
        </div>
      </div>

      <RepSurface
        key={`${currentIndex}-${repRetryNonce}`}
        prompt={activePrompt}
        mode="daily_workout"
        topic={currentRep.repType.name}
        maxDurationMs={currentRep.timeBudgetMs}
        retryFocus={retryFocus}
        carryoverFocus={carryoverFocus}
        previousRepSummary={
          previousRepSummary && !retryFocus ? previousRepSummary : null
        }
        repTypeFramework={currentRep.framework}
        speakingThreshold={{ minRatio: 0.6 }}
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
  );
}
