"use client";

// useWorkoutSession — Phase 5 ships the type contract + a skeletal
// reducer so the shell renders deterministically off `sessionPhase`.
// Phase 7 swaps the no-op dispatch for the full state machine
// (PICK_PROMPT, FINISH_RECORDING, etc.) without changing the public
// shape this hook exposes.

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { SessionPhase, ShellStation } from "./types";

type WorkoutSessionState = {
  phase: SessionPhase;
  currentStationIndex: number;
  stations: ShellStation[];
  lastScore: number | null;
};

type WorkoutSessionAction =
  | { type: "SET_PHASE"; phase: SessionPhase }
  | { type: "SET_STATION"; index: number }
  | { type: "SET_LAST_SCORE"; score: number | null };

function reducer(
  state: WorkoutSessionState,
  action: WorkoutSessionAction,
): WorkoutSessionState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_STATION":
      return { ...state, currentStationIndex: action.index };
    case "SET_LAST_SCORE":
      return { ...state, lastScore: action.score };
    default:
      return state;
  }
}

const WorkoutSessionContext = createContext<{
  state: WorkoutSessionState;
  dispatch: React.Dispatch<WorkoutSessionAction>;
} | null>(null);

export type WorkoutSessionProviderProps = {
  initial: {
    phase: SessionPhase;
    currentStationIndex: number;
    stations: ShellStation[];
  };
  children: ReactNode;
};

export function WorkoutSessionProvider({
  initial,
  children,
}: WorkoutSessionProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    phase: initial.phase,
    currentStationIndex: initial.currentStationIndex,
    stations: initial.stations,
    lastScore: null,
  });
  return (
    <WorkoutSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession() {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) {
    throw new Error(
      "useWorkoutSession must be used inside <WorkoutSessionProvider>",
    );
  }
  return ctx;
}
