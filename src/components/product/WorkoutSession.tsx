"use client";

import { useState, useEffect, useRef } from "react";
import { Pause } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { ModeBadge, ModeSeam } from "./ModeBadge";
import { WorkoutCountdown } from "./WorkoutCountdown";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { WorkoutEnd } from "./WorkoutEnd";
import { WorkoutIntro } from "./WorkoutIntro";
import { PersonalBestToast } from "./PersonalBestToast";
import { bumpCompletedRepCount } from "./InstallPrompt";
import { SkillsFocusScope } from "./SkillsFocusContext";
import type { RepScore, Callout, SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
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

  // Daily Workout = zero friction, but we still show a quick landing
  // page before countdown so the user knows the session shape (rep
  // count, est. duration, lineup) and can resume a paused session
  // inline if one exists.
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
  // Cross-session prompt history. Fetched once on mount; mutated locally
  // when the user picks a prompt so refresh + planNextRep within this
  // session also exclude the just-picked id. Empty for guests / no-DB.
  const [seenPromptIds, setSeenPromptIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const seenIdsLoadedRef = useRef(false);

  useEffect(() => {
    if (seenIdsLoadedRef.current) return;
    seenIdsLoadedRef.current = true;
    fetch("/api/prompt-history", { method: "GET" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((json: { ids?: string[] }) => {
        if (Array.isArray(json.ids)) setSeenPromptIds(new Set(json.ids));
      })
      .catch(() => {
        // Network failure on the history fetch is non-fatal — picker
        // just falls back to "no exclusions" which is the legacy
        // behavior. No user-visible degradation.
      });
  }, []);

  // On mount, detect resumable pause state. We surface it as an inline
  // banner on the landing page (not a separate full-screen prompt) so
  // the user always sees today's workout overview first.
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

  const handlePromptSelected = (prompt: string, promptId?: string) => {
    setSelectedPrompts((prev) => {
      const next = [...prev];
      next[currentIndex] = prompt;
      return next;
    });
    setRetryFocus(null);
    if (promptId) {
      // Optimistic local update so in-session refresh + planNextRep
      // exclude the just-picked id immediately. Server write is
      // fire-and-forget; failure is non-fatal (stays in local state).
      setSeenPromptIds((prev) => {
        if (prev.has(promptId)) return prev;
        const next = new Set(prev);
        next.add(promptId);
        return next;
      });
      void fetch("/api/prompt-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      }).catch(() => {});
    }
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
      ...(score.headline ? { headline: score.headline } : {}),
      ...(score.nextRepHint ? { nextRepHint: score.nextRepHint } : {}),
      pressureArchetypeId: currentRep?.pressureArchetype?.id ?? null,
    });
  };

  const handleRepRetry = () => {
    // Pop the last-recorded score since we're re-doing this rep.
    // The retryFocus from that score stays in state and is shown on
    // the remounted RepSurface via the retryFocus prop.
    setScores((prev) => prev.slice(0, -1));
    setRepRetryNonce((n) => n + 1);
  };

  // Save & exit during feedback. Mirrors the just-finished-this-rep path:
  // append the score (already done by handleRepCompleteWithContext), point
  // resume to the next rep, persist pause state directly, then route. We
  // can't rely on the phase=prompt-select effect to save because we navigate
  // away before it runs.
  const handleFeedbackSaveExit = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= plan.reps.length) {
      // Last rep — nothing to resume into. Wipe pause state and route.
      clearPauseState();
    } else {
      savePauseState({
        plan,
        currentRepIndex: nextIdx,
        scores,
        selectedPrompts,
      });
    }
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
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
    // the next slot to target the weakest dimension. Pass through pressure
    // archetype + headline so planNextRep can apply pressure_residue and
    // forward the verbatim previous-rep verdict to the next score call.
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
          pressureArchetype: currentRep.pressureArchetype ?? null,
          ...(justCompletedScore.headline
            ? { headline: justCompletedScore.headline }
            : {}),
        },
        usedRepTypeIds: nextUsedTypes,
        excludePromptIds: seenPromptIds,
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
          streakDays={streakDays ?? null}
          canResume={canResume}
          onResume={handleResume}
          onStart={handleStart}
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
            initialPromptIds={currentRep.promptIds}
            excludePromptIds={seenPromptIds}
            repIndex={currentIndex}
            totalReps={plan.reps.length}
            focus={currentRep.focus}
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

  // ——— Derived inputs for the redesigned FeedbackPanel ——————————
  // modeLabel: pressure → archetype tagline; focus → "{DIM} FOCUS"; mixed → "MIXED".
  const feedbackModeLabel = currentRep.pressureArchetype
    ? currentRep.pressureArchetype.tagline.toUpperCase()
    : plan.sessionType === "focus" && plan.focusDimension
      ? `${DIMENSION_LABELS[plan.focusDimension].toUpperCase()} FOCUS`
      : "MIXED";
  // lastRepFocus: lowest-scoring rankable dim from the previous rep, when
  // this isn't a retry (retryFocus suppresses the carry-over banner).
  const lastRepFocusDim =
    previousRepSummary && !retryFocus && previousRepSummary.dimensions.length > 0
      ? [...previousRepSummary.dimensions].sort((a, b) => a.score - b.score)[0]
          ?.dimension ?? null
      : null;

  // Phase 2: build modeContext for the scoring call. Suppressed during
  // retry so the AI doesn't anchor on the previous attempt's verdict —
  // retries should re-evaluate fresh.
  const previousRepFocusForScoring =
    !retryFocus &&
    previousRepSummary &&
    previousRepSummary.headline &&
    previousRepSummary.dimensions.length > 0
      ? (() => {
          const weakest = [...previousRepSummary.dimensions].sort(
            (a, b) => a.score - b.score,
          )[0];
          return weakest
            ? {
                dimension: weakest.dimension,
                headline: previousRepSummary.headline!,
                score: weakest.score,
              }
            : null;
        })()
      : null;
  const scoreModeContext = {
    sessionType: plan.sessionType,
    ...(plan.focusDimension ? { focusDimension: plan.focusDimension } : {}),
    ...(currentRep.pressureArchetype
      ? { pressureArchetypeId: currentRep.pressureArchetype.id }
      : {}),
    ...(previousRepFocusForScoring
      ? { previousRepFocus: previousRepFocusForScoring }
      : {}),
    repIndex: currentIndex,
    totalReps: plan.reps.length,
  } as const;

  return (
    <>
    <SkillsFocusScope
      primary={currentRep.repType.primaryDimension}
      secondary={currentRep.repType.secondaryDimensions}
    />
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ModeBadge mode="daily_workout" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Rep {currentIndex + 1} of {plan.reps.length} ·{" "}
              {currentRep.pressureArchetype
                ? `Pressure · ${currentRep.pressureArchetype.name}`
                : currentRep.repType.name}
            </span>
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
        <ModeSeam mode="daily_workout" />
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
        feedbackRepIndex={currentIndex + 1}
        feedbackTotalReps={plan.reps.length}
        feedbackModeLabel={feedbackModeLabel}
        feedbackLastRepFocus={
          lastRepFocusDim
            ? {
                dimension: lastRepFocusDim,
                ...(previousRepSummary?.nextRepHint
                  ? { customHint: previousRepSummary.nextRepHint }
                  : {}),
              }
            : null
        }
        onFeedbackSaveExit={handleFeedbackSaveExit}
        scoreModeContext={scoreModeContext}
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

