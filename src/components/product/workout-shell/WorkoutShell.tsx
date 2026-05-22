"use client";

// Outer split-screen container for the muscle-group workout product.
// Phase 7 swapped the no-op reducer for the full session runtime in
// src/lib/workout/use-workout-session.tsx — the provider now drives
// the state machine, persistence, mascot orchestration, and timers.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Dumbbell, Flame, Snowflake } from "lucide-react";
import { startMuscleGroupDay } from "@/server/actions/workout-day";
import {
  WorkoutSessionProvider,
  useWorkoutSession,
} from "@/lib/workout/use-workout-session";
import type { WorkoutShellHydratedPayload } from "@/lib/workout/types";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import MuscleGroupHeader from "./MuscleGroupHeader";
import MascotPathStrip from "./MascotPathStrip";
import StartCard from "./StartCard";
import TrainingList from "./TrainingList";
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

  const onStationFocus = useCallback(
    (index: number) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          JSON.stringify({
            event: "workout_shell.station_focused",
            ts: new Date().toISOString(),
            index,
            muscleGroupDayId: payload.dayId,
          }),
        );
      }
    },
    [payload.dayId],
  );

  const onStationActivate = useCallback(() => {
    // Tap-on-current-station = no-op for the runtime; the picker is
    // already mounted in RepControls. Future phases may use this to
    // re-open the picker mid-rep.
  }, []);

  // Ready-stance window: brief moment where the mascot flexes and the
  // landing CTA fades out before the prompt picker animates in. Pure UI
  // flourish — the state machine still transitions immediately so any
  // downstream consumers see the actual phase change without delay.
  const [readyStance, setReadyStance] = useState(false);
  const readyStanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (readyStanceTimer.current) clearTimeout(readyStanceTimer.current);
    },
    [],
  );

  // Start workflow: flash the ready-stance + dispatch the local START
  // event so the UI morphs immediately, AND fire the server action that
  // actually creates today's muscle_group_day (or resamples an orphaned
  // one). Reload picks up the fresh active-day payload. Without the
  // server call the picker mounts with empty stations and falls into
  // "No station available."
  const [, startTransitionPending] = useTransition();
  const onStartWorkout = useCallback(() => {
    setReadyStance(true);
    send({ type: "START" });
    if (readyStanceTimer.current) clearTimeout(readyStanceTimer.current);
    readyStanceTimer.current = setTimeout(() => setReadyStance(false), 900);
    startTransitionPending(async () => {
      await startMuscleGroupDay();
      if (typeof window !== "undefined") window.location.reload();
    });
  }, [send]);

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
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          event: "workout_shell.station_skipped",
          ts: new Date().toISOString(),
          index: state.currentStationIndex,
        }),
      );
    }
    // Treat skip like a passing-through ADVANCE: walk to the next
    // station without scoring. Phase 10 will read these events for the
    // partial-day streak rule.
    send({ type: "ADVANCE" });
  }, [send, state.currentStationIndex]);

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

  const onAdvanceNow = useCallback(() => send({ type: "ADVANCE" }), [send]);
  const onAcceptGraduation = useCallback(
    () => send({ type: "ACCEPT_GRADUATION" }),
    [send],
  );
  const onSkipGraduation = useCallback(
    () => send({ type: "SKIP_GRADUATION" }),
    [send],
  );

  const station =
    state.stations[state.currentStationIndex] ??
    state.stations[0] ??
    null;

  // Phase D — lock-screen card while a day is open. Clears on the
  // day-complete / day-complete-prompt phases.
  useMediaSession({
    active:
      payload.hasActiveDay &&
      state.phase !== "day-complete" &&
      state.phase !== "day-complete-prompt",
    dim: payload.dimension,
    stationIndex: state.currentStationIndex,
    totalStations: state.stations.length || 4,
  });

  // v3 layout — mascot strip on top, hero + pills, then a morphing slot
  // that swaps between StartCard (idle) and the recording / picker /
  // retrospective surfaces. Training list always renders at the bottom.
  const inWorkout =
    state.phase === "recording" ||
    state.phase === "transcribing" ||
    state.phase === "scoring" ||
    state.phase === "score-reveal" ||
    state.phase === "walking" ||
    state.phase === "graduation-rep";

  const stationCount = state.stations.length || 4;
  const estimatedMinutes = Math.round((stationCount * 45) / 60); // ~45s/rep

  return (
    <div
      className={cn(
        "min-h-[100dvh] w-full bg-slate-950 text-slate-100",
        "max-w-3xl mx-auto px-4 sm:px-6 pb-12",
      )}
      data-workout-shell
      data-phase={state.phase}
      data-mascot-state={mascotState}
    >
      <MissedDayModal />

      {/* Top: mascot walks across station path. Compresses in-workout.
          During the ready-stance window the mascot does a flex/warmup
          while the gradient CTA fades out. */}
      <MascotPathStrip
        phase={state.phase}
        stations={state.stations}
        currentStationIndex={state.currentStationIndex}
        dim={payload.dimension}
        lastScore={state.lastScore}
        compact={inWorkout}
        forceMascotState={readyStance ? "celebrating-rep" : null}
      />

      {/* Hero: dim badge, "Today: {Dim}", rationale, banner copy. */}
      <MuscleGroupHeader
        dim={payload.dimension}
        rationale={payload.rationale}
        lastDay={payload.lastDay}
        previousDayComposite={payload.previousDayComposite}
        streakDays={payload.streakDays}
        streakFreezes={payload.streakFreezes}
      />

      {/* Pills row */}
      <PillsRow
        dim={payload.dimension}
        stationCount={stationCount}
        estimatedMinutes={estimatedMinutes}
        streakDays={payload.streakDays ?? null}
        streakFreezes={payload.streakFreezes ?? null}
      />

      {/* Today's Training list — placed ABOVE the main slot so the user
          always sees what's coming up, even mid-workout. Highlights the
          current station. */}
      <div className="mt-5">
        <TrainingList
          stations={state.stations}
          currentStationIndex={state.currentStationIndex}
          dim={payload.dimension}
        />
      </div>

      {/* Main interactive slot. Morphs by phase with a fade/slide
          animation so the StartCard → picker transition feels guided. */}
      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          {state.phase === "idle" ? (
            <motion.div
              key="start-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <StartCard onStart={onStartWorkout} />
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
            onStartWorkout={onStartWorkout}
            onPromptSelected={onPromptSelected}
            onSkipStation={onSkipStation}
            onRepScored={onRepScored}
            onAdvanceNow={onAdvanceNow}
            onAcceptGraduation={onAcceptGraduation}
            onSkipGraduation={onSkipGraduation}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    <div className="flex flex-wrap items-center gap-2 mt-4 px-2 justify-center">
      {dim && (
        <Pill className="bg-purple-500/20 border-purple-400/40 text-purple-100">
          <span aria-hidden>●</span>
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
        <Pill className="bg-orange-500/15 border-orange-400/30 text-orange-200">
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
        <Pill className="bg-sky-500/15 border-sky-400/30 text-sky-200">
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
        "bg-slate-800/60 border-slate-700 text-slate-200",
        className,
      )}
    >
      {children}
    </span>
  );
}
