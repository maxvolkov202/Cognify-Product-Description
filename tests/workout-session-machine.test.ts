/**
 * Phase 7 — session-machine reducer tests.
 *
 * Pure-reducer assertions. No DOM, no DB. Covers every transition the
 * Phase 7 DoD calls out:
 *   • idle → START → prompt-selecting
 *   • PICK_PROMPT → recording (carries selectedPrompt)
 *   • recording → FINISH_RECORDING → transcribing → SCORE_DONE → score-reveal
 *   • score-reveal → ADVANCE → walking → WALK_DONE → prompt-selecting (next)
 *   • Last station's score-reveal → ADVANCE → day-complete-prompt
 *   • ACCEPT_GRADUATION → graduation-rep → GRADUATION_DONE → day-complete
 *   • SKIP_GRADUATION → day-complete
 *   • FAIL_SCORE → score-reveal with degraded card + outcome flagged
 *   • PAUSE/RESUME wrap arbitrary states
 *   • NETWORK_DROP/RECONNECT update buffered flag
 *
 * Run: npx tsx tests/workout-session-machine.test.ts
 */

import {
  initialMachineState,
  reduce,
  mascotStateForPhase,
  controlsDisabledFor,
  type SessionMachineState,
} from "@/lib/workout/session-machine";
import type { ShellStation } from "@/lib/workout/types";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

function mkStation(i: number): ShellStation {
  return {
    index: i,
    exerciseId: `ex-${i}`,
    exerciseSlug: `ex-${i}`,
    exerciseName: `Exercise ${i + 1}`,
    rule: "Rule",
    why: null,
    status: i === 0 ? "current" : "locked",
    compositeScore: null,
  };
}

const STATIONS: ShellStation[] = [0, 1, 2, 3].map(mkStation);

function startSession(): SessionMachineState {
  return initialMachineState(STATIONS, "idle", 0);
}

// ─── 1. Happy-path walk-through of one station ───────────────────────────
section("happy path: one rep");
{
  let s = startSession();
  assert(s.phase === "idle", "starts at idle");
  s = reduce(s, { type: "START" });
  assert(s.phase === "prompt-selecting", "START → prompt-selecting");

  s = reduce(s, {
    type: "PICK_PROMPT",
    promptId: "p1",
    text: "Explain X",
    mode: "shuffle",
  });
  assert(s.phase === "recording", "PICK_PROMPT → recording");
  assert(s.selectedPrompt?.promptId === "p1", "selectedPrompt carried");

  s = reduce(s, { type: "FINISH_RECORDING" });
  assert(s.phase === "transcribing", "FINISH_RECORDING → transcribing");

  s = reduce(s, { type: "TRANSCRIBE_DONE" });
  assert(s.phase === "scoring", "TRANSCRIBE_DONE → scoring");

  s = reduce(s, { type: "SCORE_PROGRESS" });
  assert(s.phase === "scoring", "SCORE_PROGRESS keeps phase=scoring");

  s = reduce(s, { type: "SCORE_DONE", composite: 82, repId: "r1" });
  assert(s.phase === "score-reveal", "SCORE_DONE → score-reveal");
  assert(s.lastScore === 82, "lastScore=82 after SCORE_DONE");
  assert(s.outcomes.length === 1, "outcome recorded");
  assert(s.outcomes[0]!.composite === 82, "outcome composite=82");

  s = reduce(s, { type: "ADVANCE" });
  assert(s.phase === "walking", "ADVANCE on non-last station → walking");

  s = reduce(s, { type: "WALK_DONE" });
  assert(
    s.phase === "prompt-selecting",
    "WALK_DONE → prompt-selecting (next station)",
  );
  assert(s.currentStationIndex === 1, "station advanced to 1");
  assert(s.selectedPrompt === null, "selectedPrompt cleared between stations");
}

// ─── 2. Last station → graduation prompt ─────────────────────────────────
section("last station → graduation");
{
  let s = initialMachineState(STATIONS, "prompt-selecting", 3);
  s = reduce(s, {
    type: "PICK_PROMPT",
    promptId: "p4",
    text: "Final rep",
    mode: "shuffle",
  });
  s = reduce(s, { type: "FINISH_RECORDING" });
  s = reduce(s, { type: "TRANSCRIBE_DONE" });
  s = reduce(s, { type: "SCORE_DONE", composite: 90, repId: "r4" });
  s = reduce(s, { type: "ADVANCE" });
  assert(
    s.phase === "day-complete-prompt",
    "ADVANCE on last station → day-complete-prompt",
  );
}

// ─── 3. Graduation accept path ───────────────────────────────────────────
section("graduation accept");
{
  let s = initialMachineState(STATIONS, "day-complete-prompt", 3);
  s = reduce(s, { type: "ACCEPT_GRADUATION" });
  assert(s.phase === "graduation-rep", "ACCEPT_GRADUATION → graduation-rep");

  s = reduce(s, { type: "GRADUATION_DONE", composite: 88, repId: "g1" });
  assert(s.phase === "day-complete", "GRADUATION_DONE → day-complete");
  assert(
    s.outcomes.some((o) => o.isGraduationRep && o.repId === "g1"),
    "graduation outcome recorded",
  );
}

// ─── 4. Graduation skip path ─────────────────────────────────────────────
section("graduation skip");
{
  let s = initialMachineState(STATIONS, "day-complete-prompt", 3);
  s = reduce(s, { type: "SKIP_GRADUATION" });
  assert(s.phase === "day-complete", "SKIP_GRADUATION → day-complete");
}

// ─── 5. FAIL_SCORE produces degraded reveal ──────────────────────────────
section("FAIL_SCORE");
{
  let s = initialMachineState(STATIONS, "scoring", 1);
  s = reduce(s, { type: "FAIL_SCORE", repId: "rx" });
  assert(s.phase === "score-reveal", "FAIL_SCORE → score-reveal (degraded)");
  assert(s.lastScore === null, "lastScore null on failure");
  assert(s.lastScoreFailure === true, "lastScoreFailure=true");
  assert(
    s.outcomes.at(-1)?.scoreFailure === true,
    "outcome scoreFailure=true",
  );
  // FAIL_SCORE during transcribing also works:
  let s2 = initialMachineState(STATIONS, "transcribing", 2);
  s2 = reduce(s2, { type: "FAIL_SCORE", repId: null });
  assert(s2.phase === "score-reveal", "FAIL_SCORE from transcribing also reveals");
}

// ─── 6. PAUSE/RESUME wrap any state ──────────────────────────────────────
section("pause / resume");
{
  let s = initialMachineState(STATIONS, "recording", 1);
  s = reduce(s, { type: "PAUSE" });
  assert(s.phase === "paused", "PAUSE → paused");
  assert(s.resumePhase === "recording", "resumePhase captured");
  s = reduce(s, { type: "RESUME" });
  assert(s.phase === "recording", "RESUME restores prior phase");

  // Pause during walking → resume back to walking
  let s2 = initialMachineState(STATIONS, "walking", 1);
  s2 = reduce(s2, { type: "PAUSE" });
  s2 = reduce(s2, { type: "RESUME" });
  assert(s2.phase === "walking", "PAUSE/RESUME mid-walk preserves walking");

  // Day-complete shouldn't accept PAUSE
  let s3 = initialMachineState(STATIONS, "day-complete", 3);
  s3 = reduce(s3, { type: "PAUSE" });
  assert(s3.phase === "day-complete", "PAUSE no-ops in day-complete");
}

// ─── 7. NETWORK_DROP / RECONNECT toggles buffered flag ───────────────────
section("network buffering");
{
  let s = initialMachineState(STATIONS, "recording", 0);
  s = reduce(s, { type: "NETWORK_DROP" });
  assert(s.networkBuffered === true, "NETWORK_DROP sets buffered=true");
  assert(s.phase === "recording", "NETWORK_DROP doesn't change phase");
  s = reduce(s, { type: "NETWORK_RECONNECT" });
  assert(s.networkBuffered === false, "NETWORK_RECONNECT clears buffered");
}

// ─── 8. Mascot state derivation ──────────────────────────────────────────
section("mascot state derivation");
{
  assert(
    mascotStateForPhase("recording", false) === "at-station-recording",
    "recording → at-station-recording",
  );
  assert(
    mascotStateForPhase("scoring", false) === "at-station-scoring",
    "scoring → at-station-scoring",
  );
  assert(
    mascotStateForPhase("walking", false) === "walking-to-next-station",
    "walking → walking-to-next-station",
  );
  assert(
    mascotStateForPhase("score-reveal", false) === "celebrating-rep",
    "score-reveal → celebrating-rep",
  );
  assert(
    mascotStateForPhase("score-reveal", true) === "stumbling",
    "score-reveal + failure → stumbling",
  );
  assert(
    mascotStateForPhase("day-complete", false) === "celebrating-day",
    "day-complete → celebrating-day",
  );
}

// ─── 9. controlsDisabled gates input ─────────────────────────────────────
section("controlsDisabled");
{
  assert(controlsDisabledFor("walking") === true, "walking disabled");
  assert(controlsDisabledFor("transcribing") === true, "transcribing disabled");
  assert(controlsDisabledFor("scoring") === true, "scoring disabled");
  assert(controlsDisabledFor("idle") === false, "idle enabled");
  assert(
    controlsDisabledFor("prompt-selecting") === false,
    "prompt-selecting enabled",
  );
}

// ─── 10. Unhandled events are no-ops ─────────────────────────────────────
section("unhandled events are no-ops");
{
  let s = initialMachineState(STATIONS, "idle", 0);
  const before = s;
  s = reduce(s, {
    type: "PICK_PROMPT",
    promptId: "x",
    text: "y",
    mode: "shuffle",
  });
  assert(s === before, "PICK_PROMPT in idle is a no-op");

  let s2 = initialMachineState(STATIONS, "day-complete", 3);
  const before2 = s2;
  s2 = reduce(s2, { type: "START" });
  assert(s2 === before2, "START in day-complete is a no-op");
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all session-machine tests pass`);
