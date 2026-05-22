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
import AdventurePath from "./AdventurePath";
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
        "min-h-[100dvh] w-full",
        // Light theme override — workout's its own training-room feel
        // distinct from the dark rest of the app. Subtle violet wash.
        "bg-gradient-to-b from-violet-50 via-white to-violet-50/40",
        "text-slate-900",
        "max-w-2xl mx-auto px-4 sm:px-6 pb-12 pt-6",
      )}
      data-workout-shell
      data-phase={state.phase}
      data-mascot-state={mascotState}
    >
      <MissedDayModal />

      {/* Hero: dim badge, "Today: {Dim}", rationale. Light-theme styling
          applied via inline tweaks; MuscleGroupHeader still does the
          heavy lifting on banner copy + variant selection. */}
      <div className="text-center">
        <MuscleGroupHeader
          dim={payload.dimension}
          rationale={payload.rationale}
          lastDay={payload.lastDay}
          previousDayComposite={payload.previousDayComposite}
          streakDays={payload.streakDays}
          streakFreezes={payload.streakFreezes}
        />
      </div>

      {/* Adventure path — zig-zag station layout with curved connectors.
          Replaces the previous horizontal MascotPathStrip. Active
          station glows + handles the Start tap. */}
      <div className="mt-2">
        <AdventurePath
          stations={state.stations}
          currentStationIndex={state.currentStationIndex}
          dim={payload.dimension}
          {...(state.phase === "idle" && !readyStance
            ? { onActivateCurrent: onStartWorkout }
            : {})}
        />
      </div>

      {/* Pills row */}
      <div className="mt-4">
        <PillsRow
          dim={payload.dimension}
          stationCount={stationCount}
          estimatedMinutes={estimatedMinutes}
          streakDays={payload.streakDays ?? null}
          streakFreezes={payload.streakFreezes ?? null}
        />
      </div>

      {/* Today's Training list — light theme. */}
      <div className="mt-5">
        <TrainingList
          stations={state.stations}
          currentStationIndex={state.currentStationIndex}
          dim={payload.dimension}
        />
      </div>

      {/* Main interactive slot. Idle has no surface here — the
          AdventurePath above IS the CTA (tap the glowing active
          station to start). Non-idle phases render the picker /
          recording / retrospective. */}
      <AnimatePresence mode="wait" initial={false}>
        {state.phase !== "idle" && (
          <motion.div
            key={`controls-${state.phase}`}
            className="mt-5"
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
    <div className="flex flex-wrap items-center gap-2 px-2 justify-center">
      {dim && (
        <Pill className="bg-purple-100 border-purple-200 text-purple-800">
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
        "bg-white border-purple-200 text-purple-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
