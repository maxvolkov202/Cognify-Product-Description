"use client";

// v2-neon "Ready to train?" workout landing — no avatar.
//
// Layout (mirrors Max's reference screenshot):
//   - TODAY'S WORKOUT eyebrow
//   - "Ready to train?" hero
//   - "No notes. No prep. Just reps." subtitle
//   - Pills: Dim Day · 4 exercises · ~time · Start a streak
//   - BIG purple→pink gradient "Start workout →" CTA
//   - TODAY'S TRAINING numbered list
//
// During in-workout phases (prompt-selecting, recording, etc.) the
// StartCard is replaced by RepControls in the same slot.

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Dumbbell, Flame, Snowflake } from "lucide-react";
import { startMuscleGroupDay } from "@/server/actions/workout-day";
import type { ShellStation } from "@/lib/workout/types";
import {
  WorkoutSessionProvider,
  useWorkoutSession,
} from "@/lib/workout/use-workout-session";
import type { WorkoutShellHydratedPayload } from "@/lib/workout/types";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import StartCard from "./StartCard";
import TrainingList from "./TrainingList";
import WorkoutProgressBar from "./WorkoutProgressBar";
import RepControls from "./RepControls";
import MissedDayModal from "./MissedDayModal";
import { useMediaSession } from "@/hooks/use-media-session";
import { cn } from "@/lib/utils/cn";

export type WorkoutShellProps = {
  payload: WorkoutShellHydratedPayload;
};

export default function WorkoutShell({ payload }: WorkoutShellProps) {
  return (
    <WorkoutSessionProvider
      initial={{
        phase: payload.sessionPhase,
        currentStationIndex: payload.currentStationIndex,
        stations: payload.stations,
      }}
      workoutSessionId={payload.workoutSessionId}
    >
      <WorkoutShellInner payload={payload} />
    </WorkoutSessionProvider>
  );
}

function WorkoutShellInner({
  payload,
}: {
  payload: WorkoutShellHydratedPayload;
}) {
  const { state, send, mascotState } = useWorkoutSession();

  const onPromptSelected = useCallback(
    (params: {
      promptId: string;
      promptText: string;
      mode: "shuffle" | "list" | "surprise" | "auto_idle";
    }) => {
      send({
        type: "PICK_PROMPT",
        promptId: params.promptId,
        text: params.promptText,
        mode: params.mode,
      });
    },
    [send],
  );

  const onSkipStation = useCallback(() => {
    send({ type: "ADVANCE" });
  }, [send]);

  // Phase HB-4 — Cancel workout. UI-only escape hatch: a local override
  // that flips us back to landing-shape rendering even though the
  // muscle_group_day still exists in DB. On Start re-tap, the override
  // clears and startMuscleGroupDay's idempotent branch reuses the day,
  // dropping the user back into the picker at the current station.
  const [cancelledLocally, setCancelledLocally] = useState(false);
  const onCancelWorkout = useCallback(() => {
    setCancelledLocally(true);
  }, []);
  // onResumeAfterCancel is declared LATER, after onStartWorkout, so it
  // can reference it without hitting TDZ.

  const onRepScored = useCallback(
    (params: { composite: number | null; repId: string; failure: boolean }) => {
      if (params.failure) {
        send({ type: "FAIL_SCORE", repId: params.repId });
      } else {
        send({
          type: "SCORE_DONE",
          composite: params.composite ?? 0,
          repId: params.repId,
        });
      }
    },
    [send],
  );

  const onAdvanceNow = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          event: "workout_shell.advance_now",
          ts: new Date().toISOString(),
          fromPhase: state.phase,
          currentStationIndex: state.currentStationIndex,
        }),
      );
    }
    send({ type: "ADVANCE" });
  }, [send, state.phase, state.currentStationIndex]);
  const onAcceptGraduation = useCallback(
    () => send({ type: "ACCEPT_GRADUATION" }),
    [send],
  );
  const onSkipGraduation = useCallback(
    () => send({ type: "SKIP_GRADUATION" }),
    [send],
  );

  // HD-2: Smooth start without a hard reload.
  // 1. Fire startMuscleGroupDay() (returns the freshly-created stations
  //    + sessionId in the same call).
  // 2. Dispatch HYDRATE_DAY locally with the returned stations so the
  //    reducer sees real station data instead of the empty preview.
  // 3. Dispatch START to transition phase idle → prompt-selecting.
  // 4. router.refresh() in the background to update other payload bits
  //    (workoutSessionId, lastDay, streak, etc.) without unmounting.
  // No window.location.reload() — the user sees a clean fade from
  // StartCard to PromptPicker via AnimatePresence.
  const [, startTransitionPending] = useTransition();
  const router = useRouter();
  const onStartWorkout = useCallback(() => {
    startTransitionPending(async () => {
      const result = await startMuscleGroupDay();
      if (!result.persisted || result.stations.length === 0) {
        // Server fallback path (DB outage etc.) — defensive hard reload.
        if (typeof window !== "undefined") window.location.reload();
        return;
      }
      const hydrated: ShellStation[] = result.stations.map((s, i) => ({
        index: s.index,
        exerciseId: s.exerciseId,
        exerciseSlug: s.exerciseSlug,
        exerciseName: s.exerciseName,
        rule: s.rule,
        why: s.why,
        status: i === 0 ? "current" : "locked",
        compositeScore: null,
      }));
      send({ type: "HYDRATE_DAY", stations: hydrated, currentStationIndex: 0 });
      send({ type: "START" });
      // Update payload (workoutSessionId, rationale, lastDay, streak)
      // without unmounting the React tree.
      router.refresh();
    });
  }, [send, router]);

  // HB-4 — Resume after Cancel: clear the override + fire Start. The
  // server action's idempotent branch reuses the still-existing day,
  // and the reload drops the user back into the picker at their last
  // station.
  const onResumeAfterCancel = useCallback(() => {
    setCancelledLocally(false);
    onStartWorkout();
  }, [onStartWorkout]);

  const station =
    state.stations[state.currentStationIndex] ??
    state.stations[0] ??
    null;

  // Phase D — lock-screen card while a day is open.
  useMediaSession({
    active:
      payload.hasActiveDay &&
      state.phase !== "day-complete" &&
      state.phase !== "day-complete-prompt",
    dim: payload.dimension,
    stationIndex: state.currentStationIndex,
    totalStations: state.stations.length || 4,
  });

  const stationCount = state.stations.length || 4;
  const estimatedMinutes = Math.round((stationCount * 45) / 60);

  // HB-5 — at-rest vs in-workout split. At-rest = idle phase, day-
  // complete phases, OR the Cancel override. Everything else (prompt
  // picker, recording, scoring, walking, etc.) collapses into the
  // compact progress bar.
  const showLanding =
    state.phase === "idle" ||
    state.phase === "day-complete" ||
    state.phase === "day-complete-prompt" ||
    cancelledLocally;

  // Phase HB-3 — personalize toggle. Default General. Persists in
  // localStorage so the user doesn't have to reset every workout.
  const [personalize, setPersonalize] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("cognify.workout.personalize");
      if (stored === "true") setPersonalize(true);
    } catch {
      // localStorage blocked — keep default.
    }
  }, []);
  const onTogglePersonalize = useCallback((next: boolean) => {
    setPersonalize(next);
    try {
      window.localStorage.setItem(
        "cognify.workout.personalize",
        next ? "true" : "false",
      );
    } catch {}
  }, []);

  return (
    <div
      className={cn(
        "min-h-[100dvh] w-full",
        "bg-gradient-to-b from-violet-50 via-white to-violet-50/40",
        "text-slate-900",
        "max-w-3xl mx-auto px-4 sm:px-6 pb-16 pt-8",
      )}
      data-workout-shell
      data-phase={state.phase}
      data-mascot-state={mascotState}
    >
      <MissedDayModal />

      {showLanding ? (
        // At-rest hero
        <header className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600">
            Today&apos;s Workout
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Ready to train?
          </h1>
          <p className="text-base text-slate-500">
            No notes. No prep. Just reps.
          </p>
        </header>
      ) : (
        // In-workout: compact progress bar replaces the hero
        <WorkoutProgressBar
          dim={payload.dimension}
          stations={state.stations}
          currentStationIndex={state.currentStationIndex}
          onBack={onCancelWorkout}
        />
      )}

      {/* Pills + personalize toggle — landing chrome only. */}
      {showLanding && (
        <>
          <div className="mt-4">
            <PillsRow
              dim={payload.dimension}
              stationCount={stationCount}
              estimatedMinutes={estimatedMinutes}
              streakDays={payload.streakDays ?? null}
              streakFreezes={payload.streakFreezes ?? null}
            />
          </div>
          <div className="mt-4">
            <PersonalizeSwitch
              value={personalize}
              onChange={onTogglePersonalize}
            />
          </div>
        </>
      )}

      {/* Main interactive slot: StartCard at-rest, RepControls
          otherwise. HB-5: layout collapses chrome during in-workout
          so the picker/recording surface gets prime real estate. */}
      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          {showLanding ? (
            <motion.div
              key="start-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <StartCard
                onStart={cancelledLocally ? onResumeAfterCancel : onStartWorkout}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`controls-${state.phase}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: "easeOut", delay: 0.05 }}
            >
              <RepControls
                phase={state.phase}
                station={station}
                workoutSessionId={payload.workoutSessionId}
                muscleGroupDayId={payload.dayId}
                dimension={payload.dimension}
                selectedPrompt={state.selectedPrompt}
                lastScore={state.lastScore}
                lastScoreFailure={state.lastScoreFailure}
                personalize={personalize}
                onStartWorkout={onStartWorkout}
                onPromptSelected={onPromptSelected}
                onSkipStation={onSkipStation}
                onRepScored={onRepScored}
                onAdvanceNow={onAdvanceNow}
                onAcceptGraduation={onAcceptGraduation}
                onSkipGraduation={onSkipGraduation}
                onCancelWorkout={onCancelWorkout}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Today's Training — landing only. In-workout users see the
          progress bar at the top instead. */}
      {showLanding && (
        <div className="mt-5">
          <TrainingList
            stations={state.stations}
            currentStationIndex={-1}
            dim={payload.dimension}
          />
        </div>
      )}

      {/* Footer: dim rationale + prior-day banner. Landing only —
          during workout it's redundant with the progress bar header. */}
      {showLanding && (payload.rationale || payload.dimension) && (
        <div className="mt-6 text-center text-xs text-slate-500 max-w-md mx-auto">
          {payload.dimension && (
            <span className="font-semibold text-purple-700">
              {MUSCLE_GROUP_LABELS[payload.dimension]} focus
            </span>
          )}
          {payload.dimension && payload.rationale && (
            <span> · </span>
          )}
          {payload.rationale && <span>{payload.rationale}</span>}
        </div>
      )}
    </div>
  );
}

function PillsRow({
  dim,
  stationCount,
  estimatedMinutes,
  streakDays,
  streakFreezes,
}: {
  dim: MuscleGroupId | null;
  stationCount: number;
  estimatedMinutes: number;
  streakDays: number | null;
  streakFreezes: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {dim && (
        <Pill className="bg-purple-100 border-purple-200 text-purple-800">
          {MUSCLE_GROUP_LABELS[dim]} Day
        </Pill>
      )}
      <Pill>
        <Dumbbell className="w-3.5 h-3.5" />
        {stationCount} exercises
      </Pill>
      <Pill>
        <Clock className="w-3.5 h-3.5" />
        ~{estimatedMinutes} min
      </Pill>
      {streakDays != null && streakDays > 0 ? (
        <Pill className="bg-orange-100 border-orange-200 text-orange-700">
          <Flame className="w-3.5 h-3.5" />
          {streakDays}d streak
        </Pill>
      ) : (
        <Pill>
          <Flame className="w-3.5 h-3.5" />
          Start a streak
        </Pill>
      )}
      {streakFreezes != null && streakFreezes > 0 && (
        <Pill className="bg-sky-100 border-sky-200 text-sky-700">
          <Snowflake className="w-3.5 h-3.5" />
          {streakFreezes} freeze{streakFreezes === 1 ? "" : "s"}
        </Pill>
      )}
    </div>
  );
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium",
        "bg-white border-slate-200 text-slate-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Dual-mode switcher: General | Personalized. Light-theme pill with a
 *  sliding indicator. Settings persist via localStorage (the caller
 *  handles the I/O). */
function PersonalizeSwitch({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Prompt mode
      </div>
      <div
        role="radiogroup"
        aria-label="Prompt mode"
        className="relative inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange(false)}
          className={cn(
            "relative z-10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors min-w-[110px]",
            !value ? "text-white" : "text-slate-600 hover:text-slate-900",
          )}
        >
          General
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value}
          onClick={() => onChange(true)}
          className={cn(
            "relative z-10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors min-w-[110px]",
            value ? "text-white" : "text-slate-600 hover:text-slate-900",
          )}
        >
          Personalized
        </button>
        {/* Sliding indicator. Two states: left (General) / right (Personalized). */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 w-[110px] rounded-full bg-gradient-to-br from-purple-500 to-pink-500 transition-transform duration-300 ease-out",
            "shadow-[0_4px_12px_-4px_rgba(168,85,247,0.6)]",
          )}
          style={{
            transform: value ? "translateX(110px)" : "translateX(0)",
          }}
        />
      </div>
      <div className="text-[11px] text-slate-500 text-center max-w-xs leading-tight">
        {value
          ? "Prompts tuned to your work context."
          : "Universal prompts — relationships, decisions, opinions."}
      </div>
    </div>
  );
}
