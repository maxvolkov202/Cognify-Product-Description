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
import { Loader2, Mic, Sparkles, Trophy, X } from "lucide-react";
import type { ShellStation, SessionPhase } from "@/lib/workout/types";
import type { PickMode } from "@/lib/workout/session-machine";
import type { MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";
import PromptPicker from "@/components/product/workout/PromptPicker";
import { RepSurface } from "@/components/product/RepSurface";
import { getFrameworkForDimension } from "@/lib/workout/exercise-framework";
import {
  fetchDaySummary,
  tagWorkoutRep,
} from "@/server/actions/workout-session";
import DayCompleteSummary from "./DayCompleteSummary";

export type RepControlsProps = {
  phase: SessionPhase;
  station: ShellStation | null;
  workoutSessionId: string | null;
  muscleGroupDayId: string | null;
  /** Phase 9 — dim of today's workout, used to fetch the retrospective. */
  dimension: MuscleGroupId | null;
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
  lastScore: number | null;
  lastScoreFailure: boolean;
  /** Phase HB-3 — personalize-toggle state from the landing screen. */
  personalize?: boolean;
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
  }) => void;
  onAdvanceNow?: () => void;
  onAcceptGraduation?: () => void;
  onSkipGraduation?: () => void;
  /** Phase HB-4 — Cancel workout (returns to landing; preserves day). */
  onCancelWorkout?: () => void;
};

export default function RepControls({
  phase,
  station,
  workoutSessionId,
  muscleGroupDayId,
  dimension,
  selectedPrompt,
  lastScore,
  lastScoreFailure,
  personalize = false,
  onStartWorkout,
  onPromptSelected,
  onSkipStation,
  onRepScored,
  onAdvanceNow,
  onAcceptGraduation,
  onSkipGraduation,
  onCancelWorkout,
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

        {(phase === "recording" ||
          phase === "transcribing" ||
          phase === "scoring" ||
          phase === "score-reveal") && (
          <ActiveRep
            station={station}
            selectedPrompt={selectedPrompt}
            workoutSessionId={workoutSessionId}
            muscleGroupDayId={muscleGroupDayId}
            dimension={dimension}
            onRepScored={onRepScored}
            onAdvanceNow={onAdvanceNow}
          />
        )}

        {phase === "walking" && (
          <PlaceholderControls
            icon={<Loader2 className="w-5 h-5 animate-spin" />}
            title="Walking to next station…"
            sub={station ? station.exerciseName : "Hold tight."}
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
            workoutSessionId={workoutSessionId}
            muscleGroupDayId={muscleGroupDayId}
            dimension={dimension}
            graduation
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
        4 reps. ~8 minutes. Let&apos;s move.
      </p>
      <button
        type="button"
        className={cn(
          "min-h-[48px] px-6 py-3 rounded-xl font-semibold",
          "bg-pink-500 hover:bg-pink-400 text-white",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
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
  workoutSessionId,
  muscleGroupDayId,
  dimension,
  graduation,
  onRepScored,
  onAdvanceNow,
}: {
  station: ShellStation | null;
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
  workoutSessionId: string | null;
  muscleGroupDayId: string | null;
  dimension: MuscleGroupId | null;
  graduation?: boolean;
  onRepScored?: (params: {
    composite: number | null;
    repId: string;
    failure: boolean;
  }) => void;
  onAdvanceNow?: () => void;
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

  return (
    <RepSurface
      key={`${station.exerciseId}:${selectedPrompt.promptId}`}
      prompt={selectedPrompt.text}
      mode="daily_workout"
      topic={
        graduation
          ? `Pressure · Graduation rep`
          : `${station.exerciseName}`
      }
      sessionId={workoutSessionId}
      speakingThreshold={{ minRatio: 0.6 }}
      feedbackRepIndex={station.index + 1}
      feedbackTotalReps={4}
      feedbackModeLabel={graduation ? "GRADUATION" : "WORKOUT"}
      exerciseId={station.exerciseId}
      muscleGroupDayId={muscleGroupDayId}
      isGraduationRep={!!graduation}
      {...(framework ? { repTypeFramework: framework } : {})}
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
            });
          } catch {
            // Tagging is best-effort; the rep is already saved.
          }
        }
        onRepScored?.({
          composite: payload.score?.composite ?? null,
          repId: payload.repId,
          failure: !payload.score?.composite,
        });
      }}
      onNext={() => onAdvanceNow?.()}
      nextLabel={graduation ? "Finish workout" : "Next station →"}
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
    return (
      <div className="flex flex-col items-center text-center gap-2 py-4">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 dark:text-ink-500" />
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
    />
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
