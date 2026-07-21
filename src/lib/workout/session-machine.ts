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
//
// PRD v3 engine (loop === "v2", FF_TRAINING_ENGINE_V2) inserts three
// phases into the station loop (plans/prd/phase1-engine-design.md):
//
//   prompt-selecting ─PICK_PROMPT─▶ insight ─INSIGHT_DONE─▶ recording …
//   score-reveal (first attempt) ─BEGIN_RETRY─▶ recording (attempt=retry)
//   scoring (attempt=retry|again) ─SCORE_DONE─▶ improvement-review
//   improvement-review ─RETRY_AGAIN─▶ recording (attempt=again)
//                      ─ADVANCE─────▶ walking / day-complete-prompt
//                      ─QUIT────────▶ quit-summary (terminal, C9 tip)
//
// In v2, ADVANCE from score-reveal is only honored when the first
// attempt's scoring failed (degraded path) — the Retry is required (D2).

import type { MascotState } from "@/lib/animations/mascot-state";
import type {
  AttemptKind,
  LoopVariant,
  SessionPhase,
  ShellStation,
} from "./types";

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
  /** Which learning loop this session runs (v1 legacy / v2 PRD engine).
   *  Fixed at machine creation; transitions branch on it so the reducer
   *  stays pure while both loops coexist behind FF_TRAINING_ENGINE_V2. */
  loop: LoopVariant;
  /** When `paused`, the phase to resume to. NULL otherwise. */
  resumePhase: SessionPhase | null;
  /** 0..3 for normal reps; 4 = day-complete. */
  currentStationIndex: number;
  stations: ShellStation[];
  /** v2 engine — where the CURRENT rep sits in the exercise loop.
   *  Always "first" in v1. */
  attempt: AttemptKind;
  /** v2 engine — the current station's First Rep outcome, kept so the
   *  Improvement Review can diff retry vs first even across remounts.
   *  Reset when the station advances. */
  firstOutcome: { repId: string | null; composite: number | null } | null;
  /** Most-recent rep composite — drives the mascot's celebrating-rep
   *  intensity. NULL before the first rep completes. */
  lastScore: number | null;
  /** Set true after FAIL_SCORE; cleared on next FINISH_RECORDING. */
  lastScoreFailure: boolean;
  /** Per-station FIRST-attempt outcomes accumulated across the day
   *  (plus the graduation rep). Retries live in `retryOutcomes` so
   *  existing consumers keep one-entry-per-station semantics. */
  outcomes: StationOutcome[];
  /** v2 engine — retry/again outcomes, appended per attempt. */
  retryOutcomes: StationOutcome[];
  /** A buffered recording waiting for network reconnect to replay. */
  networkBuffered: boolean;
  /** Phase 12 F-6 — a BEGIN_RETRY that arrived while the rep was still
   *  transcribing/scoring (RepSurface renders the CTA from its own local
   *  state before SCORE_DONE reaches this machine). Consumed by
   *  finishRepWithScore: the retry starts the moment the score lands
   *  instead of the tap being silently dropped. */
  pendingBeginRetry: boolean;
  /** Selected prompt for the current rep (text shown to the user +
   *  sent to scoring). NULL during non-recording phases. Retained across
   *  the retry (same prompt, per PRD §4.6). */
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
  | { type: "INSIGHT_DONE" } // v2 — Coach's Insight acknowledged → recording
  | { type: "FINISH_RECORDING" }
  | { type: "TRANSCRIBE_DONE" }
  | { type: "SCORE_PROGRESS" } // Stage 1 partial reveal
  | {
      type: "SCORE_DONE";
      composite: number;
      repId: string;
    }
  | { type: "FAIL_SCORE"; repId: string | null }
  | { type: "BEGIN_RETRY" } // v2 — feedback acknowledged → required Retry
  | { type: "RETRY_AGAIN" } // v2 — from improvement-review, optional extra attempt
  | { type: "QUIT" } // v2 — early exit (C9) → quit-summary
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
  loop: LoopVariant = "v1",
): SessionMachineState {
  return {
    phase: startPhase,
    loop,
    resumePhase: null,
    currentStationIndex: startIndex,
    stations,
    attempt: "first",
    firstOutcome: null,
    lastScore: null,
    lastScoreFailure: false,
    outcomes: [],
    retryOutcomes: [],
    networkBuffered: false,
    pendingBeginRetry: false,
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
    case "improvement-review":
      return "celebrating-rep";
    case "day-complete":
      return "celebrating-day";
    case "idle":
    case "prompt-selecting":
    case "insight":
    case "day-complete-prompt":
    case "quit-summary":
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
    if (
      state.phase === "paused" ||
      state.phase === "day-complete" ||
      state.phase === "quit-summary"
    )
      return state;
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

  // Bug #5 — Score-done / fail-score must terminate the rep regardless of
  // which intermediate phase the machine is in. The UI flow doesn't dispatch
  // FINISH_RECORDING / TRANSCRIBE_DONE, so the machine can land here from
  // "recording" directly — without this hoist, those events would be dropped
  // and the user would get stuck (next-station click becomes a no-op because
  // ADVANCE is only valid from "score-reveal").
  if (event.type === "SCORE_DONE" || event.type === "FAIL_SCORE") {
    const isTransientPrePhase =
      state.phase === "recording" ||
      state.phase === "transcribing" ||
      state.phase === "scoring";
    if (isTransientPrePhase) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          JSON.stringify({
            event: "session_machine.score_done_hoisted",
            ts: new Date().toISOString(),
            fromPhase: state.phase,
            eventType: event.type,
          }),
        );
      }
      return event.type === "SCORE_DONE"
        ? finishRepWithScore(state, event.composite, event.repId, false)
        : failScore(state, event.repId);
    }
  }

  // Phase 12 F-6 — the mirror image of the hoist above: BEGIN_RETRY can
  // arrive BEFORE this machine sees SCORE_DONE (RepSurface shows the v2
  // feedback + "Start your Retry" from its own local state; the async
  // rep path delays onComplete until the pending rep resolves). Without
  // this, the tap lands in "recording"/"scoring" and is silently
  // dropped — the user (or the e2e spec) is left on a dead screen.
  if (
    event.type === "BEGIN_RETRY" &&
    state.loop === "v2" &&
    state.attempt === "first" &&
    (state.phase === "recording" ||
      state.phase === "transcribing" ||
      state.phase === "scoring")
  ) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          event: "session_machine.begin_retry_buffered",
          ts: new Date().toISOString(),
          fromPhase: state.phase,
        }),
      );
    }
    return { ...state, pendingBeginRetry: true };
  }

  switch (state.phase) {
    case "idle":
      if (event.type === "START") {
        return { ...state, phase: "prompt-selecting" };
      }
      break;

    case "prompt-selecting":
      // "Skip station" (PromptPicker) — including the empty-bank recovery
      // path where skipping is the ONLY way forward. Same semantics as
      // advancing after a rep: walk to the next station, or bridge to the
      // graduation prompt on the last one.
      if (event.type === "ADVANCE") {
        return advanceStation(state);
      }
      if (event.type === "PICK_PROMPT") {
        return {
          ...state,
          // v2 engine surfaces the Coach's Insight (+ constraint, per
          // C19: topic first, THEN the system's constraint) before the
          // mic opens. v1 goes straight to recording.
          phase: state.loop === "v2" ? "insight" : "recording",
          attempt: "first",
          firstOutcome: null,
          selectedPrompt: {
            promptId: event.promptId,
            text: event.text,
            mode: event.mode,
          },
        };
      }
      break;

    case "insight":
      if (event.type === "INSIGHT_DONE") {
        return { ...state, phase: "recording" };
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
      // Re-score: RepSurface's error card lets the user re-record after a
      // scoring failure while the machine already sits at score-reveal.
      // Accept the fresh result in place — replace this station's last
      // outcome instead of appending a duplicate. Without this, a v2 user
      // whose first attempt failed scoring could never clear
      // lastScoreFailure and BEGIN_RETRY would stay refused (dead button).
      if (event.type === "SCORE_DONE") {
        return replaceCurrentStationOutcome(
          state,
          event.repId,
          event.composite,
          false,
        );
      }
      if (event.type === "FAIL_SCORE") {
        return replaceCurrentStationOutcome(state, event.repId, null, true);
      }
      if (event.type === "BEGIN_RETRY" && state.loop === "v2") {
        // Required Retry (D2): same prompt, Coach's Focus carried over.
        // Blocked only when the first attempt's scoring failed — forcing
        // a retry against a scoring hiccup would punish the user twice
        // (the UI offers ADVANCE in that degraded case instead).
        if (state.lastScoreFailure) return state;
        return { ...state, phase: "recording", attempt: "retry" };
      }
      if (event.type === "QUIT" && state.loop === "v2") {
        return { ...state, phase: "quit-summary" };
      }
      if (event.type === "ADVANCE") {
        // v2 requires the Retry before advancing — ADVANCE from
        // score-reveal is only honored on a failed-scoring first attempt
        // (degraded path) or in the legacy v1 loop.
        if (
          state.loop === "v2" &&
          state.attempt === "first" &&
          !state.lastScoreFailure
        ) {
          return state;
        }
        return advanceStation(state);
      }
      break;

    case "improvement-review":
      if (event.type === "RETRY_AGAIN") {
        // Optional extra attempt (PRD "Retry Again"; ADR-001 may overload).
        return { ...state, phase: "recording", attempt: "again" };
      }
      if (event.type === "QUIT") {
        return { ...state, phase: "quit-summary" };
      }
      if (event.type === "ADVANCE") {
        return advanceStation(state);
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
          attempt: "first",
          firstOutcome: null,
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
    case "quit-summary":
    case "paused":
    default:
      break;
  }

  return state;
}

/** Re-score at score-reveal: swap the current station's most recent
 *  outcome for the fresh result (RepSurface error-card re-record). */
function replaceCurrentStationOutcome(
  state: SessionMachineState,
  repId: string | null,
  composite: number | null,
  scoreFailure: boolean,
): SessionMachineState {
  const outcome: StationOutcome = {
    stationIndex: state.currentStationIndex,
    repId,
    composite,
    scoreFailure,
    isGraduationRep: false,
  };
  const idx = state.outcomes.findLastIndex(
    (o) => o.stationIndex === state.currentStationIndex && !o.isGraduationRep,
  );
  const outcomes =
    idx >= 0
      ? [...state.outcomes.slice(0, idx), outcome, ...state.outcomes.slice(idx + 1)]
      : [...state.outcomes, outcome];
  return {
    ...state,
    phase: "score-reveal",
    lastScore: composite,
    lastScoreFailure: scoreFailure,
    firstOutcome: { repId, composite },
    outcomes,
  };
}

/** Shared ADVANCE handling: last station bridges to the graduation
 *  prompt, otherwise walk to the next station. */
function advanceStation(state: SessionMachineState): SessionMachineState {
  if (state.currentStationIndex >= state.stations.length - 1) {
    return { ...state, phase: "day-complete-prompt" };
  }
  return { ...state, phase: "walking" };
}

function finishRepWithScore(
  state: SessionMachineState,
  composite: number,
  repId: string,
  scoreFailure: boolean,
): SessionMachineState {
  const outcome: StationOutcome = {
    stationIndex: state.currentStationIndex,
    repId,
    composite,
    scoreFailure,
    isGraduationRep: false,
  };
  // v2 retry/again attempts land on the Improvement Review and are
  // bookkept separately so `outcomes` keeps its one-first-attempt-per-
  // station shape for existing consumers (DayCompleteSummary et al.).
  if (state.loop === "v2" && state.attempt !== "first") {
    return {
      ...state,
      phase: "improvement-review",
      lastScore: composite,
      lastScoreFailure: scoreFailure,
      retryOutcomes: [...state.retryOutcomes, outcome],
    };
  }
  // A buffered early BEGIN_RETRY starts the retry the moment the score
  // lands — unless scoring failed (the degraded path offers ADVANCE, and
  // forcing a retry against a scoring hiccup punishes the user twice).
  if (state.pendingBeginRetry && !scoreFailure) {
    return {
      ...state,
      phase: "recording",
      attempt: "retry",
      pendingBeginRetry: false,
      lastScore: composite,
      lastScoreFailure: scoreFailure,
      firstOutcome: { repId, composite },
      outcomes: [...state.outcomes, outcome],
    };
  }
  return {
    ...state,
    phase: "score-reveal",
    lastScore: composite,
    lastScoreFailure: scoreFailure,
    firstOutcome: { repId, composite },
    ...(state.pendingBeginRetry ? { pendingBeginRetry: false } : {}),
    outcomes: [...state.outcomes, outcome],
  };
}

function failScore(
  state: SessionMachineState,
  repId: string | null,
): SessionMachineState {
  // Surface a degraded score-reveal so the user isn't stranded; flag
  // the rep so ops can re-grade. Composite is null (no signal) — the
  // UI renders a "scoring hiccup" card.
  const outcome: StationOutcome = {
    stationIndex: state.currentStationIndex,
    repId,
    composite: null,
    scoreFailure: true,
    isGraduationRep: false,
  };
  // A failed RETRY still reaches the Improvement Review (degraded copy);
  // the first attempt's data is intact so the review isn't empty.
  if (state.loop === "v2" && state.attempt !== "first") {
    return {
      ...state,
      pendingBeginRetry: false,
      phase: "improvement-review",
      lastScore: null,
      lastScoreFailure: true,
      retryOutcomes: [...state.retryOutcomes, outcome],
    };
  }
  return {
    ...state,
    // A buffered early BEGIN_RETRY must NOT fire against a failed score
    // (the degraded card offers ADVANCE instead) — drop it here.
    pendingBeginRetry: false,
    phase: "score-reveal",
    lastScore: null,
    lastScoreFailure: true,
    firstOutcome: { repId, composite: null },
    outcomes: [...state.outcomes, outcome],
  };
}
