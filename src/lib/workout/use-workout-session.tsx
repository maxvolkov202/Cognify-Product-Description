"use client";

// Phase 7 — full session runtime hook.
//
// Composes the pure reducer (session-machine.ts) with React state, a
// side-effect runner (auto-advance timers, mascot-walk timer,
// visibilitychange → PAUSE, server persistence on transitions, network
// buffer replay), and the Phase 5 provider boundary that wraps the
// shell.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  controlsDisabledFor,
  initialMachineState,
  mascotStateForPhase,
  reduce,
  type SessionMachineEvent,
  type SessionMachineState,
} from "./session-machine";
import { MASCOT_TIMINGS } from "@/lib/animations/mascot-state";
import type { LoopVariant, ShellStation, SessionPhase } from "./types";
import { updateWorkoutSessionState } from "@/server/actions/workout-session";

type WorkoutSessionContextValue = {
  state: SessionMachineState;
  /** Send an event into the state machine. */
  send: (event: SessionMachineEvent) => void;
  /** Derived mascot state. */
  mascotState: ReturnType<typeof mascotStateForPhase>;
  /** Lock user input during in-flight phases. */
  controlsDisabled: boolean;
  /** Cancel any pending auto-advance timer (used when user taps Next). */
  cancelAdvance: () => void;
};

const Ctx = createContext<WorkoutSessionContextValue | null>(null);

export type WorkoutSessionProviderProps = {
  initial: {
    phase: SessionPhase;
    currentStationIndex: number;
    stations: ShellStation[];
  };
  /** Active workout_sessions.id — when set, every transition is
   *  persisted to the server via updateWorkoutSessionState(). */
  workoutSessionId: string | null;
  /** Which learning loop to run — resolved server-side from
   *  isTrainingEngineV2Enabled() so the pure machine stays flag-free.
   *  Defaults to the legacy v1 loop. */
  loop?: LoopVariant;
  children: ReactNode;
};

export function WorkoutSessionProvider({
  initial,
  workoutSessionId,
  loop = "v1",
  children,
}: WorkoutSessionProviderProps) {
  const [state, dispatch] = useReducer(
    reduce,
    initialMachineState(
      initial.stations,
      initial.phase,
      initial.currentStationIndex,
      loop,
    ),
  );

  // Timer refs so side-effects can be cancelled cleanly.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wrap dispatch so we can run side effects from anywhere.
  const send = useCallback((event: SessionMachineEvent) => {
    dispatch(event);
  }, []);

  const cancelAdvance = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // ─── Side effects keyed off phase transitions ───────────────────────

  // 1) Auto-advance after score-reveal — DISABLED 2026-05-22 per Max's
  //    HC-2 feedback. The 5s timer was firing while users were still
  //    reading the feedback panel, making it look like the "Next
  //    station →" button didn't work (it had already advanced silently).
  //    Advance is now purely user-driven via the FeedbackPanel CTA.
  void cancelAdvance; // kept for the cancelAdvance ref; no longer used here

  // 2) Mascot walk timer — match the visual transition duration.
  useEffect(() => {
    if (state.phase !== "walking") return;
    walkTimerRef.current = setTimeout(() => {
      send({ type: "WALK_DONE" });
    }, MASCOT_TIMINGS.walk_ms);
    return () => {
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      walkTimerRef.current = null;
    };
  }, [state.phase, send]);

  // 3) PAUSE on tab-hidden mid-recording (Safari kills the mic anyway), and
  //    auto-RESUME when the tab comes back so the user is never stranded on
  //    the Paused screen (there was previously no RESUME dispatch anywhere —
  //    a paused session had no way out; a manual Resume button in RepControls
  //    is the fallback for when the tab is already visible).
  useEffect(() => {
    if (typeof document === "undefined") return;
    function onVisibility() {
      if (
        document.visibilityState === "hidden" &&
        (state.phase === "recording" ||
          state.phase === "transcribing" ||
          state.phase === "scoring")
      ) {
        send({ type: "PAUSE" });
      } else if (
        document.visibilityState === "visible" &&
        state.phase === "paused"
      ) {
        send({ type: "RESUME" });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state.phase, send]);

  // 4) Network-drop / reconnect detection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onOffline() {
      send({ type: "NETWORK_DROP" });
    }
    function onOnline() {
      send({ type: "NETWORK_RECONNECT" });
    }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [send]);

  // 5) Persist phase transitions server-side. Debounced to coalesce
  //    rapid-fire transitions during scoring.
  const persistedRef = useRef<{ phase: SessionPhase; index: number } | null>(
    null,
  );
  useEffect(() => {
    if (!workoutSessionId) return;
    const last = persistedRef.current;
    if (
      last &&
      last.phase === state.phase &&
      last.index === state.currentStationIndex
    ) {
      return;
    }
    persistedRef.current = {
      phase: state.phase,
      index: state.currentStationIndex,
    };
    const timer = setTimeout(() => {
      void updateWorkoutSessionState({
        workoutSessionId,
        state: state.phase,
        currentStationIndex: state.currentStationIndex,
        pausedAt: state.phase === "paused" ? new Date() : null,
        resumedAt: state.phase === "prompt-selecting" ? new Date() : null,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [state.phase, state.currentStationIndex, workoutSessionId]);

  // 6) Lightweight telemetry — 100% sample of state transitions.
  const lastTelemetryPhaseRef = useRef<SessionPhase | null>(null);
  useEffect(() => {
    const from = lastTelemetryPhaseRef.current;
    if (from === state.phase) return;
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "workout.session.state_transition",
          from,
          to: state.phase,
          sessionId: workoutSessionId,
          station: state.currentStationIndex,
        }),
      );
    }
    lastTelemetryPhaseRef.current = state.phase;
  }, [state.phase, state.currentStationIndex, workoutSessionId]);

  const mascotState = useMemo(
    () => mascotStateForPhase(state.phase, state.lastScoreFailure),
    [state.phase, state.lastScoreFailure],
  );

  const controlsDisabled = useMemo(
    () => controlsDisabledFor(state.phase),
    [state.phase],
  );

  const value = useMemo<WorkoutSessionContextValue>(
    () => ({ state, send, mascotState, controlsDisabled, cancelAdvance }),
    [state, send, mascotState, controlsDisabled, cancelAdvance],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useWorkoutSession must be used inside <WorkoutSessionProvider>",
    );
  }
  return ctx;
}
