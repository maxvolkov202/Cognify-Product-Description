"use client";

// Outer split-screen container for the muscle-group workout product.
// Wraps the entire Workout day in a useWorkoutSession provider, then
// renders the header, mascot stage (top half), and rep controls
// (bottom half). Phase 7 will swap the no-op reducer for the full
// session runtime.

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
    >
      <WorkoutShellInner payload={payload} />
    </WorkoutSessionProvider>
  );
}

function WorkoutShellInner({ payload }: { payload: WorkoutShellHydratedPayload }) {
  const { state, dispatch } = useWorkoutSession();

  const onStationFocus = useCallback(
    (index: number) => {
      // Phase 5 logs only; Phase 7 will swap to a real action.
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

  const onStationActivate = useCallback(
    (index: number) => {
      dispatch({ type: "SET_STATION", index });
    },
    [dispatch],
  );

  const station =
    payload.stations[state.currentStationIndex] ??
    payload.stations[0] ??
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

      <RepControls phase={state.phase} station={station} />
    </div>
  );
}
