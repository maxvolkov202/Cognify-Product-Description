// Mascot state machine — pure types + transition map.
//
// Phase 4 of the muscle-group adventure-path pivot. Imported by both the
// Mascot wrapper component (Phase 4) and the workout session runtime
// (Phase 7), which derives the mascot state from session events.
//
// The mascot is purely a presentational layer; it does not own session
// truth. The reducer in Phase 7 maps session phases → mascot states.

/** Discrete visual states the mascot can be in. */
export const MASCOT_STATES = [
  "idle", // pre-workout, subtle head-bob
  "walking-to-next-station", // body translateX + leg/arm swing
  "at-station-recording", // slight forward lean
  "at-station-scoring", // head tilt, waiting
  "celebrating-rep", // post-score, intensity from lastScore
  "celebrating-day", // bigger pose, end-of-day
  "stumbling", // FAIL_SCORE branch
] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

/** Score-band branching for celebrating-rep. */
export type ScoreBand = "poor" | "ok" | "strong" | "excellent";

/** Map a 0-100 composite to a score band. */
export function scoreBandFor(score: number | null | undefined): ScoreBand {
  if (score == null || !Number.isFinite(score)) return "ok";
  if (score < 50) return "poor";
  if (score < 75) return "ok";
  if (score < 90) return "strong";
  return "excellent";
}

/** Animation durations (ms) per state — read by both motion variants
 *  and the Phase 7 reducer (so WALK_DONE timing matches the visual). */
export const MASCOT_TIMINGS = {
  idle_loop_ms: 2000,
  walk_ms: 1700,
  at_station_settle_ms: 400,
  celebrate_rep_ms: 1400,
  celebrate_day_ms: 2200,
  reduced_motion_crossfade_ms: 200,
} as const;

/** Valid state transitions. Helps the wrapper assert nothing bogus
 *  leaks in from upstream. NOT enforced at runtime (use TS type at the
 *  prop boundary); this is for tests + documentation. */
export const MASCOT_TRANSITIONS: Record<MascotState, readonly MascotState[]> = {
  idle: ["walking-to-next-station", "at-station-recording"],
  "walking-to-next-station": ["at-station-recording", "idle"],
  "at-station-recording": [
    "at-station-scoring",
    "walking-to-next-station",
    "stumbling",
  ],
  "at-station-scoring": [
    "celebrating-rep",
    "stumbling",
    "walking-to-next-station",
  ],
  "celebrating-rep": [
    "walking-to-next-station",
    "celebrating-day",
    "at-station-recording",
  ],
  "celebrating-day": ["idle"],
  stumbling: ["walking-to-next-station", "at-station-recording"],
};

/** Human label for ARIA live announcements. */
export const MASCOT_ARIA_LABELS: Record<MascotState, string> = {
  idle: "Mascot waiting at start",
  "walking-to-next-station": "Mascot walking to next station",
  "at-station-recording": "Mascot ready — recording your rep",
  "at-station-scoring": "Mascot waiting — scoring your rep",
  "celebrating-rep": "Mascot celebrating",
  "celebrating-day": "Mascot celebrating end of workout",
  stumbling: "Mascot stumbled — let's reset",
};
