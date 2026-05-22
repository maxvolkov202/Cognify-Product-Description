"use client";

// Outer split-screen container for the muscle-group workout product.
// Phase 7 swapped the no-op reducer for the full session runtime in
// src/lib/workout/use-workout-session.tsx — the provider now drives
// the state machine, persistence, mascot orchestration, and timers.

import { useCallback } from "react";
import {
  WorkoutSessionProvider,
  useWorkoutSession,
} from "@/lib/workout/use-workout-session";
import type { WorkoutShellHydratedPayload } from "@/lib/workout/types";
import MuscleGroupHeader from "./MuscleGroupHeader";
import MascotStage from "./MascotStage";
import RepControls from "./RepControls";

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

  const onStartWorkout = useCallback(() => {
    send({ type: "START" });
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

  return (
    <div
      className="
        min-h-[100dvh] w-full bg-slate-950 text-slate-100
        grid
        grid-rows-[auto_1fr_auto]
        sm:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]
        max-w-5xl mx-auto
      "
      data-workout-shell
      data-phase={state.phase}
      data-mascot-state={mascotState}
    >
      <MuscleGroupHeader
        dim={payload.dimension}
        rationale={payload.rationale}
        previousDayComposite={payload.previousDayComposite}
      />

      <main className="flex flex-col items-center justify-end min-h-0">
        <MascotStage
          phase={state.phase}
          stations={state.stations}
          currentStationIndex={state.currentStationIndex}
          dim={payload.dimension}
          lastScore={state.lastScore}
          onStationFocus={onStationFocus}
          onStationActivate={onStationActivate}
        />
      </main>

      <RepControls
        phase={state.phase}
        station={station}
        workoutSessionId={payload.workoutSessionId}
        muscleGroupDayId={payload.dayId}
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
    </div>
  );
}
