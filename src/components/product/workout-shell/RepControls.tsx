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
import { useTransition } from "react";
import { Loader2, Mic, Sparkles, Trophy, X } from "lucide-react";
import type { ShellStation, SessionPhase } from "@/lib/workout/types";
import type { PickMode } from "@/lib/workout/session-machine";
import { cn } from "@/lib/utils/cn";
import PromptPicker from "@/components/product/workout/PromptPicker";
import { RepSurface } from "@/components/product/RepSurface";
import { tagWorkoutRep } from "@/server/actions/workout-session";

export type RepControlsProps = {
  phase: SessionPhase;
  station: ShellStation | null;
  workoutSessionId: string | null;
  muscleGroupDayId: string | null;
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
  lastScore: number | null;
  lastScoreFailure: boolean;
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
};

export default function RepControls({
  phase,
  station,
  workoutSessionId,
  muscleGroupDayId,
  selectedPrompt,
  lastScore,
  lastScoreFailure,
  onStartWorkout,
  onPromptSelected,
  onSkipStation,
  onRepScored,
  onAdvanceNow,
  onAcceptGraduation,
  onSkipGraduation,
}: RepControlsProps) {
  return (
    <div
      className={cn(
        "w-full max-w-md mx-auto px-4",
        "pb-[max(env(safe-area-inset-bottom),1rem)] pt-4",
      )}
    >
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 min-h-[120px]">
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
            graduation
            onRepScored={onRepScored}
            onAdvanceNow={onAdvanceNow}
          />
        )}

        {phase === "day-complete" && (
          <DayCompleteControls lastScore={lastScore} />
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
      <h2 className="text-lg font-semibold text-slate-100">
        Start today&apos;s Workout
      </h2>
      <p className="text-sm text-slate-400">
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
  graduation,
  onRepScored,
  onAdvanceNow,
}: {
  station: ShellStation | null;
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
  workoutSessionId: string | null;
  muscleGroupDayId: string | null;
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
      onComplete={async (payload) => {
        if (muscleGroupDayId) {
          try {
            await tagWorkoutRep({
              repId: payload.repId,
              muscleGroupDayId,
              exerciseId: station.exerciseId,
              scoreFailure: !payload.score?.composite,
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
      <Trophy className="w-5 h-5 text-yellow-300" />
      <h2 className="text-base font-semibold text-slate-100">
        One more rep — pressure mode. Want it?
      </h2>
      <p className="text-sm text-slate-400">
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
            "min-h-[44px] px-4 py-2 rounded-lg font-medium",
            "bg-yellow-400 hover:bg-yellow-300 text-slate-900",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200",
          )}
        >
          Bring it on
        </button>
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            "min-h-[44px] px-4 py-2 rounded-lg",
            "border border-slate-700 text-slate-300 hover:bg-slate-800",
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
}: {
  lastScore: number | null;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <Sparkles className="w-5 h-5 text-pink-300" />
      <h2 className="text-base font-semibold text-slate-100">
        Workout complete
      </h2>
      <p className="text-sm text-slate-400">
        {lastScore != null
          ? `Final rep: ${Math.round(lastScore)}. Phase 9 retrospective ships here.`
          : "Phase 9 retrospective ships here."}
      </p>
      <a
        href="/dashboard"
        className="text-xs text-slate-500 hover:text-slate-300 mt-1"
      >
        Back to dashboard
      </a>
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
        <div className="text-slate-200 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {sub && <p className="text-sm text-slate-400">{sub}</p>}
    </div>
  );
}

// Mic icon kept around for future "live recording" indicator UX.
void Mic;
void X;
