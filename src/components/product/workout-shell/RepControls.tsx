"use client";

// Bottom-half phase-driven control panel.
//
// Phase 7 wires the full lifecycle:
//   idle                → "Start today's Workout" CTA
//   prompt-selecting    → PromptPicker (Phase 6)
//   recording/...
//     score-reveal      → RepSurface (handles mic/transcript/scoring + reveal)
//   walking             → between-stations transition
//   day-complete-prompt → graduation-rep CTA (opt-in)
//   graduation-rep      → RepSurface in pressure mode
//   day-complete        → workout-complete card
//   paused              → resume CTA

import { startMuscleGroupDay } from "@/server/actions/workout-day";
import { useEffect, useState, useTransition } from "react";
import { Mic, Sparkles, Trophy, X } from "lucide-react";
import type {
  AttemptKind,
  LoopVariant,
  ShellStation,
  SessionPhase,
} from "@/lib/workout/types";
import type { PickMode } from "@/lib/workout/session-machine";
import type { MuscleGroupId, RepScore } from "@/types/domain";
import { MUSCLE_GROUP_LABELS } from "@/types/domain";
import { cn } from "@/lib/utils/cn";
import { DIM_THEMES } from "@/lib/workout/dim-theme";
import PromptPicker from "@/components/product/workout/PromptPicker";
import { RepSurface } from "@/components/product/RepSurface";
import { getFrameworkForDimension } from "@/lib/workout/exercise-framework";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";
import {
  deriveCoachFocus,
  deriveRetryFocus,
  deriveTopWeakness,
} from "@/lib/ai/coach-focus";
import type { ScoreRepModeContext } from "@/lib/ai/score";
import {
  fetchDaySummary,
  tagWorkoutRep,
} from "@/server/actions/workout-session";
import DayCompleteSummary from "./DayCompleteSummary";
import InsightScreen from "./InsightScreen";
import ImprovementReview, { type AttemptPayload } from "./ImprovementReview";
import QuitSummary from "./QuitSummary";

export type RepControlsProps = {
  phase: SessionPhase;
  station: ShellStation | null;
  workoutSessionId: string | null;
  /** practice_sessions.id — the ONLY id reps.session_id may reference
   *  (Phase 12 F-4: the workout id FK-failed every resumed-day save). */
  practiceSessionId: string | null;
  muscleGroupDayId: string | null;
  /** Phase 9 — dim of today's workout, used to fetch the retrospective. */
  dimension: MuscleGroupId | null;
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
  lastScore: number | null;
  lastScoreFailure: boolean;
  /** Phase HB-3 — personalize-toggle state from the landing screen. */
  personalize?: boolean;
  /** UI overhaul Phase 5 (5.3/5.4) — expose Suggested Framework shuffle/edit.
   *  Server-resolved from FF_REP_FRAMEWORK_EDIT; forwarded to RepSurface. */
  frameworkEditEnabled?: boolean;
  /** PRD v3 engine — loop variant + attempt state from the machine. */
  loop?: LoopVariant;
  attempt?: AttemptKind;
  /** PRD v3 engine — full payloads of this station's attempts, stashed by
   *  WorkoutShell from onRepScored. Drive the retry context + review. */
  firstAttempt?: AttemptPayload | null;
  retryAttempt?: AttemptPayload | null;
  isLastStation?: boolean;
  repsCompleted?: number;
  /** PRD v3 Phase 2.1 — planned exercise count for the day (3 in v2, 4
   *  legacy). Drives the rep-progress strip + scoring context. */
  totalStations?: number;
  onStartWorkout?: () => void;
  onPromptSelected?: (params: {
    promptId: string;
    promptText: string;
    mode: PickMode;
  }) => void;
  onSkipStation?: () => void;
  onRepScored?: (params: {
    composite: number | null;
    repId: string;
    failure: boolean;
    /** PRD v3 engine — full score + transcript so the shell can stash
     *  attempt payloads for the retry context / Improvement Review. */
    score?: RepScore | null;
    transcript?: string;
  }) => void;
  onAdvanceNow?: () => void;
  onAcceptGraduation?: () => void;
  onSkipGraduation?: () => void;
  /** Phase HB-4 — Cancel workout (returns to landing; preserves day). */
  onCancelWorkout?: () => void;
  /** PRD v3 engine — new loop events. */
  onInsightDone?: () => void;
  onBeginRetry?: () => void;
  onRetryAgain?: () => void;
  onQuit?: () => void;
};

export default function RepControls({
  phase,
  station,
  workoutSessionId,
  practiceSessionId,
  muscleGroupDayId,
  dimension,
  selectedPrompt,
  lastScore,
  lastScoreFailure,
  personalize = false,
  frameworkEditEnabled = false,
  loop = "v1",
  attempt = "first",
  firstAttempt = null,
  retryAttempt = null,
  isLastStation = false,
  repsCompleted = 0,
  totalStations = 4,
  onStartWorkout,
  onPromptSelected,
  onSkipStation,
  onRepScored,
  onAdvanceNow,
  onAcceptGraduation,
  onSkipGraduation,
  onCancelWorkout,
  onInsightDone,
  onBeginRetry,
  onRetryAgain,
  onQuit,
}: RepControlsProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto",
        "pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2",
      )}
    >
      <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl p-5 sm:p-6 min-h-[120px] shadow-sm">
        {phase === "idle" && (
          <IdleControls onStartWorkout={onStartWorkout} />
        )}

        {phase === "prompt-selecting" && station && (
          <PromptPicker
            exerciseId={station.exerciseId}
            exerciseName={station.exerciseName}
            rule={station.rule}
            why={station.why}
            workoutSessionId={workoutSessionId}
            personalize={personalize}
            {...(onCancelWorkout ? { onCancelWorkout } : {})}
            onSelect={(params) =>
              onPromptSelected?.({
                promptId: params.promptId,
                promptText: params.promptText,
                mode: params.mode,
              })
            }
            {...(onSkipStation ? { onSkip: onSkipStation } : {})}
          />
        )}

        {phase === "prompt-selecting" && !station && (
          <PlaceholderControls
            icon={<Sparkles className="w-5 h-5" />}
            title="No station available"
            sub="Pause until tomorrow's muscle group day."
          />
        )}

        {phase === "insight" && station && selectedPrompt && (
          <InsightScreen
            station={station}
            promptText={selectedPrompt.text}
            dimension={dimension}
            framework={getFrameworkForDimension(dimension)}
            onReady={() => onInsightDone?.()}
          />
        )}

        {(phase === "recording" ||
          phase === "transcribing" ||
          phase === "scoring" ||
          phase === "score-reveal") && (
          <ActiveRep
            station={station}
            selectedPrompt={selectedPrompt}
            practiceSessionId={practiceSessionId}
            muscleGroupDayId={muscleGroupDayId}
            dimension={dimension}
            frameworkEditEnabled={frameworkEditEnabled}
            loop={loop}
            attempt={attempt}
            firstAttempt={firstAttempt}
            retryAttempt={retryAttempt}
            totalStations={totalStations}
            onRepScored={onRepScored}
            onAdvanceNow={onAdvanceNow}
            onBeginRetry={onBeginRetry}
          />
        )}

        {phase === "improvement-review" && (
          <ImprovementReview
            dimension={dimension}
            first={firstAttempt}
            retry={retryAttempt}
            isLastStation={isLastStation}
            onRetryAgain={() => onRetryAgain?.()}
            onAdvance={() => onAdvanceNow?.()}
            onQuit={() => onQuit?.()}
          />
        )}

        {phase === "quit-summary" && (
          <QuitSummary
            dimension={dimension}
            bestDelta={
              firstAttempt?.score.composite != null &&
              retryAttempt?.score.composite != null
                ? retryAttempt.score.composite - firstAttempt.score.composite
                : null
            }
            repsCompleted={repsCompleted}
          />
        )}

        {phase === "walking" && (
          <WalkingControls
            dimension={dimension}
            exerciseName={station ? station.exerciseName : null}
          />
        )}

        {phase === "day-complete-prompt" && (
          <GraduationPrompt
            onAccept={onAcceptGraduation}
            onSkip={onSkipGraduation}
            lastScore={lastScore}
            failed={lastScoreFailure}
          />
        )}

        {phase === "graduation-rep" && station && (
          <ActiveRep
            station={station}
            selectedPrompt={selectedPrompt}
            practiceSessionId={practiceSessionId}
            muscleGroupDayId={muscleGroupDayId}
            dimension={dimension}
            graduation
            frameworkEditEnabled={frameworkEditEnabled}
            totalStations={totalStations}
            onRepScored={onRepScored}
            onAdvanceNow={onAdvanceNow}
          />
        )}

        {phase === "day-complete" && (
          <DayCompleteControls
            lastScore={lastScore}
            dim={dimension}
            muscleGroupDayId={muscleGroupDayId}
          />
        )}

        {phase === "paused" && (
          <PlaceholderControls
            icon={null}
            title="Paused"
            sub="Resume to keep going."
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-panels ──────────────────────────────────────────────────────────

function IdleControls({
  onStartWorkout,
}: {
  onStartWorkout?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        Start today&apos;s Workout
      </h2>
      <p className="text-sm text-slate-600 dark:text-ink-300">
        Short, focused reps. Let&apos;s move.
      </p>
      <button
        type="button"
        className={cn(
          "min-h-[48px] px-6 py-3 rounded-xl font-semibold",
          "brand-gradient text-white shadow-[var(--shadow-glow-sm)] hover:shadow-[var(--shadow-glow-md)] transition-shadow",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900",
          "disabled:opacity-50",
        )}
        disabled={isPending}
        onClick={() => {
          if (onStartWorkout) return onStartWorkout();
          startTransition(async () => {
            await startMuscleGroupDay();
            if (typeof window !== "undefined") window.location.reload();
          });
        }}
      >
        {isPending ? "Starting…" : "Start today's Workout"}
      </button>
    </div>
  );
}

function ActiveRep({
  station,
  selectedPrompt,
  practiceSessionId,
  muscleGroupDayId,
  dimension,
  graduation,
  frameworkEditEnabled = false,
  loop = "v1",
  attempt = "first",
  firstAttempt = null,
  retryAttempt = null,
  totalStations = 4,
  onRepScored,
  onAdvanceNow,
  onBeginRetry,
}: {
  station: ShellStation | null;
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
  practiceSessionId: string | null;
  muscleGroupDayId: string | null;
  dimension: MuscleGroupId | null;
  graduation?: boolean;
  frameworkEditEnabled?: boolean;
  loop?: LoopVariant;
  attempt?: AttemptKind;
  firstAttempt?: AttemptPayload | null;
  retryAttempt?: AttemptPayload | null;
  totalStations?: number;
  onRepScored?: (params: {
    composite: number | null;
    repId: string;
    failure: boolean;
    score?: RepScore | null;
    transcript?: string;
  }) => void;
  onAdvanceNow?: () => void;
  onBeginRetry?: () => void;
}) {
  // Defensive: if we got here without a selected prompt, the picker hand-off
  // didn't fire. Surface a short helper so the user isn't stuck.
  if (!station || !selectedPrompt) {
    return (
      <PlaceholderControls
        icon={<Sparkles className="w-5 h-5" />}
        title="Preparing rep…"
        sub="No prompt selected — back out to the picker."
      />
    );
  }

  const framework = getFrameworkForDimension(dimension);

  // PRD v3 engine — retry wiring. On retry/again attempts (v2 loop,
  // never graduation reps) the surface carries the first attempt's
  // Coach's Focus, the comparison summary, the scoring retryContext,
  // and the attempt lineage for saveRep.
  const isEngineRetry =
    loop === "v2" && !graduation && attempt !== "first" && !!firstAttempt;
  // §4.7 fidelity — "Coach's Focus becomes the next development
  // opportunity": a plain retry implements the FIRST rep's focus, but
  // "Run it again" (attempt="again", entered from the Improvement
  // Review) implements the focus the review just assigned — which is
  // derived from the RETRY's score. Base everything (overlay, scoring
  // retryContext, comparison baseline) on that attempt.
  const baseAttempt =
    attempt === "again" && retryAttempt ? retryAttempt : firstAttempt;
  const coachFocus =
    isEngineRetry && baseAttempt ? deriveCoachFocus(baseAttempt.score) : null;
  // §4.6 retry focus + Stronger Version — one shared derivation for
  // every surface (see deriveRetryFocus).
  const retryFocus =
    isEngineRetry && baseAttempt ? deriveRetryFocus(baseAttempt.score) : null;
  const skillDim = dimension ? muscleGroupToSkillDim(dimension) : null;
  const retryModeContext: ScoreRepModeContext | null =
    isEngineRetry && baseAttempt && coachFocus && skillDim
      ? {
          sessionType: "focus",
          focusDimension: skillDim,
          repIndex: station.index,
          totalReps: totalStations,
          retryContext: {
            attempt: attempt === "again" ? "again" : "retry",
            firstTranscript: baseAttempt.transcript,
            firstComposite: baseAttempt.score.composite ?? null,
            coachFocus: {
              dimension: coachFocus.dimension,
              subSkill: coachFocus.subSkill,
              text: coachFocus.text,
            },
          },
        }
      : null;

  // v2 first attempts route "next" into the required Retry; retry
  // attempts never render their own done screen (the machine moves to
  // improvement-review the moment scoring lands).
  const isEngineFirst = loop === "v2" && !graduation && attempt === "first";

  return (
    <RepSurface
      key={`${station.exerciseId}:${selectedPrompt.promptId}:${attempt}`}
      prompt={selectedPrompt.text}
      // ADR-001 — count-up timer with the exercise's target band; the
      // graduation pressure rep keeps the legacy countdown (explicit
      // time-pressure is its whole point).
      responseWindow={graduation ? null : (station.responseWindow ?? null)}
      mode="daily_workout"
      topic={
        graduation
          ? `Pressure · Graduation rep`
          : `${station.exerciseName}`
      }
      // reps.session_id FKs practice_sessions — the workout id here
      // FK-failed EVERY resumed-day rep save silently (Phase 12 F-4).
      // null is fine: saveRep/insertPendingRep self-create a session.
      sessionId={practiceSessionId}
      speakingThreshold={{ minRatio: 0.6 }}
      feedbackRepIndex={station.index + 1}
      feedbackTotalReps={totalStations}
      feedbackModeLabel={
        graduation ? "GRADUATION" : isEngineRetry ? "RETRY" : "WORKOUT"
      }
      exerciseId={station.exerciseId}
      muscleGroupDayId={muscleGroupDayId}
      isGraduationRep={!!graduation}
      {...(framework ? { repTypeFramework: framework } : {})}
      frameworkEditEnabled={frameworkEditEnabled}
      {...(retryFocus ? { retryFocus } : {})}
      {...(isEngineRetry && baseAttempt && firstAttempt
        ? {
            // Comparison baseline follows the coached focus: the rep
            // being implemented against (retry take on "again"
            // attempts). Lineage still roots at the FIRST rep so the
            // coaching ledger's verdict back-fill stays anchored.
            previousRepSummary: {
              composite: baseAttempt.score.composite,
              dimensions: baseAttempt.score.dimensions.map((d) => ({
                dimension: d.dimension,
                score: d.score,
              })),
              topWeakness: deriveTopWeakness(baseAttempt.score),
              transcript: baseAttempt.transcript,
              promptText: selectedPrompt.text,
            },
            attemptKind: attempt,
            parentRepId: firstAttempt.repId,
          }
        : {})}
      {...(retryModeContext ? { scoreModeContext: retryModeContext } : {})}
      {...(isEngineFirst || isEngineRetry ? { hideRunItAgain: true } : {})}
      onComplete={async (payload) => {
        if (muscleGroupDayId) {
          try {
            // CTO review B-1 — composite === 0 (rare but possible)
            // shouldn't misclassify as failure. Treat only null/undefined
            // composite as failure; a real 0 score still counts as a rep.
            const compositeMissing =
              payload.score == null || payload.score.composite == null;
            await tagWorkoutRep({
              repId: payload.repId,
              muscleGroupDayId,
              exerciseId: station.exerciseId,
              scoreFailure: compositeMissing,
              // v2 retries must not double-count the day's completed_reps.
              attemptKind: graduation ? "first" : attempt,
            });
          } catch {
            // Tagging is best-effort; the rep is already saved.
          }
        }
        onRepScored?.({
          composite: payload.score?.composite ?? null,
          repId: payload.repId,
          failure: !payload.score?.composite,
          score: payload.score ?? null,
          transcript: payload.transcript,
        });
      }}
      onNext={() => {
        if (isEngineFirst && onBeginRetry) return onBeginRetry();
        onAdvanceNow?.();
      }}
      nextLabel={
        graduation
          ? "Finish workout"
          : isEngineFirst
            ? "Start your Retry →"
            : "Next station →"
      }
    />
  );
}

function GraduationPrompt({
  onAccept,
  onSkip,
  lastScore,
  failed,
}: {
  onAccept?: () => void;
  onSkip?: () => void;
  lastScore: number | null;
  failed: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <Trophy className="w-5 h-5 text-amber-500" />
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        One more rep — pressure mode. Want it?
      </h2>
      <p className="text-sm text-slate-500 dark:text-ink-400">
        {failed
          ? "Optional. Bonus XP if you nail it."
          : lastScore != null
            ? `Last rep landed at ${Math.round(lastScore)}. Want the graduation?`
            : "Optional. Bonus XP if you nail it."}
      </p>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onAccept}
          className={cn(
            "min-h-[44px] px-4 py-2 rounded-lg font-semibold",
            "bg-amber-400 hover:bg-amber-300 text-slate-900",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200",
          )}
        >
          Bring it on
        </button>
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            "min-h-[44px] px-4 py-2 rounded-lg",
            "border border-slate-200 dark:border-ink-700 text-slate-600 dark:text-ink-300 hover:bg-slate-50 dark:hover:bg-ink-800",
          )}
        >
          Call it a day
        </button>
      </div>
    </div>
  );
}

function DayCompleteControls({
  lastScore,
  dim,
  muscleGroupDayId,
}: {
  lastScore: number | null;
  dim: MuscleGroupId | null;
  muscleGroupDayId: string | null;
}) {
  const [summary, setSummary] = useState<
    Awaited<ReturnType<typeof fetchDaySummary>>
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dim || !muscleGroupDayId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDaySummary({ dayId: muscleGroupDayId, dim }).then((res) => {
      if (cancelled) return;
      setSummary(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dim, muscleGroupDayId]);

  if (loading) {
    // Celebratory skeleton — the party starts DURING the fetch: the
    // eyebrow + a shimmering hero-score placeholder in the dim's wash,
    // so the reveal doesn't open on a bare spinner.
    const theme = dim ? DIM_THEMES[dim] : null;
    return (
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600 dark:text-brand-lavender">
          🎉 {dim ? `${MUSCLE_GROUP_LABELS[dim]} day complete` : "Workout complete"}
        </div>
        <div
          aria-hidden
          className="relative h-16 w-36 animate-pulse overflow-hidden rounded-2xl bg-slate-100 dark:bg-ink-800"
        >
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br",
              theme ? theme.wash : "from-brand-lavender/15 to-transparent",
            )}
          />
        </div>
        <p className="text-sm text-slate-500 dark:text-ink-400">Building your summary…</p>
      </div>
    );
  }

  if (!dim || !summary) {
    return (
      <div className="flex flex-col items-center text-center gap-3">
        <Sparkles className="w-5 h-5 text-purple-500 dark:text-brand-lavender" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Workout complete
        </h2>
        {lastScore != null && (
          <p className="text-sm text-slate-500 dark:text-ink-400">
            Final rep: {Math.round(lastScore)}.
          </p>
        )}
        <a
          href="/dashboard"
          className="text-xs text-purple-600 dark:text-brand-lavender hover:text-purple-800 dark:hover:text-white font-semibold"
        >
          Back to dashboard
        </a>
      </div>
    );
  }

  return (
    <DayCompleteSummary
      dim={dim}
      comparison={summary.comparison}
      reps={summary.reps}
      lifetimeReps={summary.lifetimeReps}
      streakDays={summary.streakDays}
    />
  );
}

/** Between-stations transition — a dim-washed card in place of the old
 *  bare spinner, carrying the next exercise's name when known. */
function WalkingControls({
  dimension,
  exerciseName,
}: {
  dimension: MuscleGroupId | null;
  exerciseName: string | null;
}) {
  const theme = dimension ? DIM_THEMES[dimension] : null;
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div
        className={cn(
          "w-full max-w-xs rounded-xl border border-slate-200 dark:border-ink-700 bg-gradient-to-br p-4",
          theme ? theme.wash : "from-brand-lavender/15 to-transparent",
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2 animate-pulse rounded-full"
            style={{ backgroundColor: theme?.accent ?? "var(--color-brand-lavender)" }}
          />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Walking to next station…
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">
          {exerciseName ?? "Hold tight."}
        </p>
      </div>
    </div>
  );
}

function PlaceholderControls({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      {icon && (
        <div className="text-purple-500 dark:text-brand-lavender flex items-center justify-center">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {sub && <p className="text-sm text-slate-500 dark:text-ink-400">{sub}</p>}
    </div>
  );
}

// Mic icon kept around for future "live recording" indicator UX.
void Mic;
void X;
