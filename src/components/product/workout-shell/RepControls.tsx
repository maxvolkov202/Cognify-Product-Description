"use client";

// Bottom-half swappable control panel. Renders different inner content
// based on session.phase. Phase 6 wired the real PromptPicker for the
// 'prompt-selecting' branch; remaining phases still show placeholders
// until Phase 7 lands the session runtime.

import { startMuscleGroupDay } from "@/server/actions/workout-day";
import { useTransition } from "react";
import { Loader2, Mic, Sparkles } from "lucide-react";
import type { ShellStation, SessionPhase } from "@/lib/workout/types";
import { cn } from "@/lib/utils/cn";
import PromptPicker from "@/components/product/workout/PromptPicker";

export type RepControlsProps = {
  phase: SessionPhase;
  station: ShellStation | null;
  /** Active workout session id (FK target for prompt_selection_events). */
  workoutSessionId: string | null;
  onStartWorkout?: () => void;
  /** Phase 6 → Phase 7 handoff: fires when the user picks a prompt. */
  onPromptSelected?: (params: {
    promptId: string;
    promptText: string;
    mode: "shuffle" | "list" | "surprise" | "auto_idle";
  }) => void;
  /** "Skip this station" exit from the picker. Phase 10 reads. */
  onSkipStation?: () => void;
};

export default function RepControls({
  phase,
  station,
  workoutSessionId,
  onStartWorkout,
  onPromptSelected,
  onSkipStation,
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
            onSelect={(params) => onPromptSelected?.(params)}
            {...(onSkipStation ? { onSkip: onSkipStation } : {})}
          />
        )}
        {phase === "prompt-selecting" && !station && (
          <PlaceholderControls
            icon={<Sparkles className="w-5 h-5" />}
            title="Pick a prompt"
            sub="No station available — pause until the next muscle group day."
          />
        )}
        {phase === "recording" && (
          <PlaceholderControls
            icon={<Mic className="w-5 h-5 text-red-400" />}
            title="Recording…"
            sub="Speak your rep — Phase 7 wires the mic + transcript pipeline."
          />
        )}
        {(phase === "transcribing" || phase === "scoring") && (
          <PlaceholderControls
            icon={<Loader2 className="w-5 h-5 animate-spin" />}
            title={phase === "transcribing" ? "Transcribing…" : "Scoring…"}
            sub="Stage 1 + Stage 2 scoring runs here."
          />
        )}
        {phase === "score-reveal" && (
          <PlaceholderControls
            icon={<Sparkles className="w-5 h-5 text-pink-300" />}
            title="Rep complete"
            sub="Dimension cards + callouts render here. Auto-advance to the next station in 5s."
          />
        )}
        {phase === "walking" && (
          <PlaceholderControls
            icon={null}
            title="Walking to next station…"
            sub={station ? station.exerciseName : "Hold tight."}
          />
        )}
        {phase === "day-complete-prompt" && (
          <PlaceholderControls
            icon={<Sparkles className="w-5 h-5 text-yellow-300" />}
            title="One more rep — pressure mode. Want it?"
            sub="Graduation rep. Phase 7 wires the opt-in."
          />
        )}
        {phase === "graduation-rep" && (
          <PlaceholderControls
            icon={<Mic className="w-5 h-5 text-yellow-300" />}
            title="Graduation rep"
            sub="Pressure rep using src/lib/ai/pressure-archetypes.ts."
          />
        )}
        {phase === "day-complete" && (
          <PlaceholderControls
            icon={<Sparkles className="w-5 h-5 text-pink-300" />}
            title="Workout complete"
            sub="Phase 9 retrospective renders here."
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
          "motion-safe:transition-colors",
        )}
        disabled={isPending}
        onClick={() => {
          if (onStartWorkout) return onStartWorkout();
          startTransition(async () => {
            await startMuscleGroupDay();
            // The server action mutates DB; the page is force-dynamic so
            // a navigation refresh picks up the new day. We delegate the
            // refresh decision to the caller via onStartWorkout when
            // provided.
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          });
        }}
      >
        {isPending ? "Starting…" : "Start today's Workout"}
      </button>
    </div>
  );
}

function PlaceholderControls({
  icon,
  title,
  sub,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  hint?: string;
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
      {hint && (
        <p className="text-[11px] text-slate-500 italic mt-1 max-w-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
