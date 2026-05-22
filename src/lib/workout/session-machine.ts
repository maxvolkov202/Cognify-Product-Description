// Pure finite-state-machine for a single muscle-group day.
//
// Phase 7. The reducer + types here are framework-agnostic: tests run
// without a DOM, RN/Capacitor can consume the same module. The
// Provider in use-workout-session.tsx wires this into React state +
// side-effect callbacks.
//
// State diagram (informal):
//
//   idle
//    │ START                 (user taps "Start today's Workout")
//    ▼
//   prompt-selecting ──── PICK_PROMPT ────▶ recording
//    │                                       │ FINISH_RECORDING
//    │ PAUSE                                 ▼
//    │                                     transcribing ──TRANSCRIBE_DONE──▶ scoring
//    │                                                                       │ SCORE_PROGRESS (stage 1)
//    │                                                                       │ SCORE_DONE     (stage 2)
//    │                                                                       │ FAIL_SCORE
//    │                                                                       ▼
//    │                                                                     score-reveal
//    │                                       ┌─ADVANCE (5s OR manual tap)──┘
//    │                                       ▼
//    │                                     walking ── WALK_DONE ─▶ prompt-selecting (next)
//    │                                       │
//    │                                       └─(after 4th rep)──▶ day-complete-prompt
//    │
//    │                                                              ACCEPT_GRADUATION
//    │                                                                ▼
//    │                                                              graduation-rep ─GRADUATION_DONE─▶ day-complete
//    │
//    │                                                              SKIP_GRADUATION
//    │                                                                └────────────────────────────▶ day-complete
//    │
//    └─paused (wraps any prior state) ─RESUME─▶ previousState
//
// NETWORK_DROP/RECONNECT are recorded on `state.networkBuffered` but do
// not change the lifecycle phase; the side-effect layer (Provider) is
// responsible for replaying the buffered recording.

import type { MascotState } from "@/lib/animations/mascot-state";
import type { SessionPhase, ShellStation } from "./types";

/** Per-station outcome captured at score-reveal time. */
export type StationOutcome = {
  stationIndex: number;
  repId: string | null;
  composite: number | null;
  scoreFailure: boolean;
  isGraduationRep: boolean;
};

export type SessionMachineState = {
  /** The live SessionPhase consumed by RepControls + MascotStage. */
  phase: SessionPhase;
  /** When `paused`, the phase to resume to. NULL otherwise. */
  resumePhase: SessionPhase | null;
  /** 0..3 for normal reps; 4 = day-complete. */
  currentStationIndex: number;
  stations: ShellStation[];
  /** Most-recent rep composite — drives the mascot's celebrating-rep
   *  intensity. NULL before the first rep completes. */
  lastScore: number | null;
  /** Set true after FAIL_SCORE; cleared on next FINISH_RECORDING. */
  lastScoreFailure: boolean;
  /** Per-station outcomes accumulated across the day. */
  outcomes: StationOutcome[];
  /** A buffered recording waiting for network reconnect to replay. */
  networkBuffered: boolean;
  /** Selected prompt for the current rep (text shown to the user +
   *  sent to scoring). NULL during non-recording phases. */
  selectedPrompt: { promptId: string; text: string; mode: PickMode } | null;
};

export type PickMode = "shuffle" | "list" | "surprise" | "auto_idle";

export type SessionMachineEvent =
  | { type: "START" }
  | {
      type: "PICK_PROMPT";
      promptId: string;
      text: string;
      mode: PickMode;
    }
  | { type: "FINISH_RECORDING" }
  | { type: "TRANSCRIBE_DONE" }
  | { type: "SCORE_PROGRESS" } // Stage 1 partial reveal
  | {
      type: "SCORE_DONE";
      composite: number;
      repId: string;
    }
  | { type: "FAIL_SCORE"; repId: string | null }
  | { type: "ADVANCE" } // auto 5s OR manual "Next station →" tap
  | { type: "WALK_DONE" }
  | { type: "ACCEPT_GRADUATION" }
  | { type: "SKIP_GRADUATION" }
  | { type: "GRADUATION_DONE"; composite: number | null; repId: string | null }
  | {
      /** HD-2: inject freshly-created stations from startMuscleGroupDay
       *  into the running reducer state. Lets the shell transition from
       *  the empty preview into the live picker WITHOUT a full page
       *  reload. */
      type: "HYDRATE_DAY";
      stations: ShellStation[];
      currentStationIndex?: number;
    }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "NETWORK_DROP" }
  | { type: "NETWORK_RECONNECT" };

export function initialMachineState(
  stations: ShellStation[],
  startPhase: SessionPhase = "idle",
  startIndex = 0,
): SessionMachineState {
  return {
    phase: startPhase,
    resumePhase: null,
    currentStationIndex: startIndex,
    stations,
    lastScore: null,
    lastScoreFailure: false,
    outcomes: [],
    networkBuffered: false,
    selectedPrompt: null,
  };
}

/** Phases during which user input should be locked (mascot walking,
 *  network in flight, etc.). Provider exposes this as
 *  `controlsDisabled`. */
const INPUT_LOCKED_PHASES: ReadonlySet<SessionPhase> = new Set<SessionPhase>([
  "walking",
  "transcribing",
  "scoring",
]);

export function controlsDisabledFor(phase: SessionPhase): boolean {
  return INPUT_LOCKED_PHASES.has(phase);
}

/** Map the session phase to the mascot state. Defined here (not in
 *  MascotStage) so the reducer + tests can assert on it without
 *  importing UI code. */
export function mascotStateForPhase(
  phase: SessionPhase,
  lastScoreFailure: boolean,
): MascotState {
  if (lastScoreFailure && phase === "score-reveal") return "stumbling";
  switch (phase) {
    case "walking":
      return "walking-to-next-station";
    case "recording":
    case "graduation-rep":
      return "at-station-recording";
    case "transcribing":
    case "scoring":
      return "at-station-scoring";
    case "score-reveal":
      return "celebrating-rep";
    case "day-complete":
      return "celebrating-day";
    case "idle":
    case "prompt-selecting":
    case "day-complete-prompt":
    case "paused":
    default:
      return "idle";
  }
}

export function reduce(
  state: SessionMachineState,
  event: SessionMachineEvent,
): SessionMachineState {
  // HD-2: HYDRATE_DAY runs from any phase. Replaces the stations array
  // (typically swapping preview stations for the freshly-created server
  // day's stations). Optionally resets currentStationIndex (defaults to
  // current value when omitted). Phase is NOT touched here — caller
  // typically dispatches START separately right after.
  if (event.type === "HYDRATE_DAY") {
    return {
      ...state,
      stations: event.stations,
      currentStationIndex:
        event.currentStationIndex ?? state.currentStationIndex,
    };
  }
  // PAUSE wraps almost any state by capturing the current phase.
  if (event.type === "PAUSE") {
    if (state.phase === "paused" || state.phase === "day-complete") return state;
    return { ...state, phase: "paused", resumePhase: state.phase };
  }
  if (event.type === "RESUME") {
    if (state.phase !== "paused") return state;
    return {
      ...state,
      phase: state.resumePhase ?? "prompt-selecting",
      resumePhase: null,
    };
  }
  if (event.type === "NETWORK_DROP") {
    return { ...state, networkBuffered: true };
  }
  if (event.type === "NETWORK_RECONNECT") {
    return { ...state, networkBuffered: false };
  }

  switch (state.phase) {
    case "idle":
      if (event.type === "START") {
        return { ...state, phase: "prompt-selecting" };
      }
      break;

    case "prompt-selecting":
      if (event.type === "PICK_PROMPT") {
        return {
          ...state,
          phase: "recording",
          selectedPrompt: {
            promptId: event.promptId,
            text: event.text,
            mode: event.mode,
          },
        };
      }
      break;

    case "recording":
      if (event.type === "FINISH_RECORDING") {
        return { ...state, phase: "transcribing" };
      }
      break;

    case "transcribing":
      if (event.type === "TRANSCRIBE_DONE") {
        return { ...state, phase: "scoring" };
      }
      // RepSurface's pipeline may fail before transcript lands.
      if (event.type === "FAIL_SCORE") {
        return failScore(state, event.repId);
      }
      break;

    case "scoring":
      if (event.type === "SCORE_PROGRESS") {
        // Stay in "scoring" but optionally surface partial dim cards.
        // No state mutation; component reads partial via its own state.
        return state;
      }
      if (event.type === "SCORE_DONE") {
        return finishRepWithScore(state, event.composite, event.repId, false);
      }
      if (event.type === "FAIL_SCORE") {
        return failScore(state, event.repId);
      }
      break;

    case "score-reveal":
      if (event.type === "ADVANCE") {
        // Last station completed → bridge to graduation prompt.
        if (state.currentStationIndex >= state.stations.length - 1) {
          return { ...state, phase: "day-complete-prompt" };
        }
        return { ...state, phase: "walking" };
      }
      break;

    case "walking":
      if (event.type === "WALK_DONE") {
        return {
          ...state,
          phase: "prompt-selecting",
          currentStationIndex: Math.min(
            state.currentStationIndex + 1,
            state.stations.length - 1,
          ),
          selectedPrompt: null,
          lastScoreFailure: false,
        };
      }
      break;

    case "day-complete-prompt":
      if (event.type === "ACCEPT_GRADUATION") {
        return { ...state, phase: "graduation-rep" };
      }
      if (event.type === "SKIP_GRADUATION") {
        return { ...state, phase: "day-complete" };
      }
      break;

    case "graduation-rep":
      if (event.type === "GRADUATION_DONE") {
        return {
          ...state,
          phase: "day-complete",
          lastScore: event.composite,
          outcomes: [
            ...state.outcomes,
            {
              stationIndex: state.stations.length,
              repId: event.repId,
              composite: event.composite,
              scoreFailure: false,
              isGraduationRep: true,
            },
          ],
        };
      }
      if (event.type === "FAIL_SCORE") {
        // A failed graduation rep is not penalized; treat as skip.
        return { ...state, phase: "day-complete" };
      }
      break;

    case "day-complete":
    case "paused":
    default:
      break;
  }

  return state;
}

function finishRepWithScore(
  state: SessionMachineState,
  composite: number,
  repId: string,
  scoreFailure: boolean,
): SessionMachineState {
  return {
    ...state,
    phase: "score-reveal",
    lastScore: composite,
    lastScoreFailure: scoreFailure,
    outcomes: [
      ...state.outcomes,
      {
        stationIndex: state.currentStationIndex,
        repId,
        composite,
        scoreFailure,
        isGraduationRep: false,
      },
    ],
  };
}

function failScore(
  state: SessionMachineState,
  repId: string | null,
): SessionMachineState {
  // Surface a degraded score-reveal so the user isn't stranded; flag
  // the rep so ops can re-grade. Composite is null (no signal) — the
  // UI renders a "scoring hiccup" card.
  return {
    ...state,
    phase: "score-reveal",
    lastScore: null,
    lastScoreFailure: true,
    outcomes: [
      ...state.outcomes,
      {
        stationIndex: state.currentStationIndex,
        repId,
        composite: null,
        scoreFailure: true,
        isGraduationRep: false,
      },
    ],
  };
}
