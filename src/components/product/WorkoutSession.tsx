"use client";

import { useState, useEffect, useRef } from "react";
import { Pause } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { WorkoutIntro } from "./WorkoutIntro";
import { WorkoutCountdown } from "./WorkoutCountdown";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { WorkoutEnd } from "./WorkoutEnd";
import { PersonalBestToast } from "./PersonalBestToast";
import { bumpCompletedRepCount } from "./InstallPrompt";
import type { RepScore, Callout, SkillDimension } from "@/types/domain";
import type { PreviousRepSummary } from "./FeedbackPanel";
import type {
  SessionType,
  WorkoutSessionPlan,
} from "@/lib/ai/workout-prompts";
import {
  planNextRep,
  planTodaysWorkout,
  planFocusWorkout,
  planFlowSession,
} from "@/lib/ai/workout-prompts";
import type { RepTypeId } from "@/lib/ai/rep-types";
import {
  savePauseState,
  loadPauseState,
  clearPauseState,
} from "@/lib/workout/pause";
import type { ImprovementGoalId } from "@/lib/onboarding/constants";

const SESSION_TYPE_PREF_KEY = "cognify_session_type_v1";

type SessionPreference = {
  sessionType: SessionType;
  focusDimension: SkillDimension | null;
};

function loadSessionPreference(): SessionPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_TYPE_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionPreference;
    if (
      parsed &&
      (parsed.sessionType === "focus" ||
        parsed.sessionType === "combined" ||
        parsed.sessionType === "flow")
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSessionPreference(pref: SessionPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_TYPE_PREF_KEY, JSON.stringify(pref));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

type Props = {
  plan: WorkoutSessionPlan;
  streakDays?: number | null;
  yesterdayComposite?: number | null;
  /** User's improvement goals — passed to Focus/Combined orchestrators
   *  when the user changes session type client-side so the regenerated
   *  plan still respects goal weighting. */
  improvementGoals?: readonly ImprovementGoalId[];
  /** Per-dimension all-time maxes at the start of this session. The UI
   *  detects personal-best dimension scores on each completed rep by
   *  comparing against this baseline, then updates in-session so a user
   *  doesn't see back-to-back PB toasts on the same dimension. */
  initialDimensionMaxes?: Partial<Record<SkillDimension, number | null>> | null;
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
  improvementGoals,
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

  // Apply the user's persisted session-type preference on mount. We
  // render with the server-provided `initialPlan` first so there's no
  // hydration mismatch, then — if the user's saved preference differs —
  // regenerate the plan client-side.
  useEffect(() => {
    const pref = loadSessionPreference();
    if (!pref) return;
    if (
      pref.sessionType === initialPlan.sessionType &&
      pref.focusDimension === (initialPlan.focusDimension ?? null)
    ) {
      return;
    }
    setPlan(buildPlan(pref, improvementGoals));
    // Intentionally not reactive — this is one-shot on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChangeSessionType(next: {
    sessionType: SessionType;
    focusDimension: SkillDimension | null;
  }) {
    saveSessionPreference(next);
    setPlan(buildPlan(next, improvementGoals));
    // Also reset in-session state (scores, cursor, completed types) so a
    // mid-intro type change doesn't leave stale data. We're still on
    // phase='intro' when this runs — no recorded reps to clobber.
    setCurrentIndex(0);
    setSelectedPrompts([]);
    setScores([]);
    setRetryFocus(null);
    setCarryoverFocus(null);
    setPreviousRepSummary(null);
    setCompletedRepTypeIds([]);
  }
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

  if (phase === "intro") {
    return (
      <>
        <WorkoutIntro
          plan={plan}
          hasResumeState={canResume}
          onStart={handleStart}
          onResume={handleResume}
          onChangeSessionType={handleChangeSessionType}
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
 * Explicit pause button — saves the current session state to localStorage
 * (auto-save already runs between reps) and routes to the dashboard. User
 * returns to /workout and sees the "You paused earlier" resume banner.
 *
 * Mid-rep pause is intentionally not supported here (see src/lib/workout/pause.ts);
 * tapping during an active rep completes-then-pauses at prompt-select.
 * Mockup-grade mid-rep pause tile lands in WS-5 (rep surface redesign).
 */
/**
 * Build a new workout plan from a session-type preference, respecting
 * the user's improvement goals. Called when the user changes session
 * type on the intro screen.
 */
function buildPlan(
  pref: SessionPreference,
  goals?: readonly ImprovementGoalId[],
): WorkoutSessionPlan {
  if (pref.sessionType === "flow") {
    return planFlowSession();
  }
  if (pref.sessionType === "focus") {
    return planFocusWorkout({
      focusDimension: pref.focusDimension ?? "clarity",
      count: 4,
      goals: goals ?? [],
    });
  }
  return planTodaysWorkout({ goals: goals ?? [], count: 4 });
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

