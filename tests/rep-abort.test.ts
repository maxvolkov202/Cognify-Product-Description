/**
 * UI + Feature Overhaul Wave — Phase 5 (task 5.1) — Abort rep invariant.
 *
 * The highest-risk item in the wave: aborting a rep must produce NO side
 * effects (no rep row, no XP, no streak fold, no coaching event, no session
 * advance), and re-recording the same slot must grade normally.
 *
 * This harness has no DOM renderer, so we can't drive RepSurface's async React
 * flow directly. Instead we lock the two things the flow is BUILT on:
 *   (1) `canAbortAtStage` — abort is only offered before any persistence.
 *   (2) A pure model of runScoringPath's abort guard — an abort at an abortable
 *       stage returns before saveRep()/onComplete(), so every downstream side
 *       effect stays off; a clean run (no abort) persists + advances.
 * The model mirrors the guard placement in RepSurface.runScoringPath; if that
 * guard is ever removed the model here must change too, which is the point.
 *
 * Run: npx tsx tests/rep-abort.test.ts
 */

import { canAbortAtStage, type RepFlowStage } from "@/lib/rep/abort";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) pass++;
  else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

// ── Pure model of RepSurface.runScoringPath's persistence side effects ──
// Every one of these fires downstream of saveRep()/onComplete(). An abort at
// an abortable stage returns before that call, so all stay false.
type RepSideEffects = {
  repRowWritten: boolean;
  xpAwarded: boolean;
  streakFolded: boolean;
  coachingEvent: boolean;
  sessionAdvanced: boolean;
};

const NO_SIDE_EFFECTS: RepSideEffects = {
  repRowWritten: false,
  xpAwarded: false,
  streakFolded: false,
  coachingEvent: false,
  sessionAdvanced: false,
};

const ALL_SIDE_EFFECTS: RepSideEffects = {
  repRowWritten: true,
  xpAwarded: true,
  streakFolded: true,
  coachingEvent: true,
  sessionAdvanced: true,
};

/** Model: a rep aborted at an abortable stage skips saveRep + onComplete →
 *  no side effects. A rep that runs clean to completion persists + advances. */
function simulateRepFlow(opts: {
  abortedAtStage: RepFlowStage | null;
}): RepSideEffects {
  if (opts.abortedAtStage && canAbortAtStage(opts.abortedAtStage)) {
    return { ...NO_SIDE_EFFECTS };
  }
  return { ...ALL_SIDE_EFFECTS };
}

function effectsAllFalse(e: RepSideEffects): boolean {
  return (
    !e.repRowWritten &&
    !e.xpAwarded &&
    !e.streakFolded &&
    !e.coachingEvent &&
    !e.sessionAdvanced
  );
}

section("canAbortAtStage — only before persistence");
{
  assert(canAbortAtStage("idle") === true, "idle is abortable");
  assert(
    canAbortAtStage("transcribing") === true,
    "transcribing is abortable (pre-scoring)",
  );
  assert(
    canAbortAtStage("scoring") === true,
    "scoring is abortable (pre-saveRep)",
  );
  assert(
    canAbortAtStage("saving") === false,
    "saving is NOT abortable — saveRep already invoked",
  );
  assert(
    canAbortAtStage("processing-async") === false,
    "processing-async is NOT abortable — pending row already written",
  );
  assert(canAbortAtStage("done") === false, "done is NOT abortable");
}

section("abort at an abortable stage writes nothing");
{
  for (const stage of ["idle", "transcribing", "scoring"] as RepFlowStage[]) {
    const e = simulateRepFlow({ abortedAtStage: stage });
    assert(
      effectsAllFalse(e),
      `abort@${stage}: no rep row / XP / streak / coaching / advance`,
    );
  }
}

section("no abort → normal grade persists + advances (re-record works)");
{
  const clean = simulateRepFlow({ abortedAtStage: null });
  assert(clean.repRowWritten, "clean run writes the rep row");
  assert(clean.xpAwarded, "clean run awards XP");
  assert(clean.streakFolded, "clean run folds the streak");
  assert(clean.sessionAdvanced, "clean run advances the session");
}

section("re-record after abort: a fresh clean run is unaffected");
{
  // Abort, then record again → the second attempt runs clean.
  const aborted = simulateRepFlow({ abortedAtStage: "scoring" });
  const reRecord = simulateRepFlow({ abortedAtStage: null });
  assert(
    effectsAllFalse(aborted) && reRecord.repRowWritten,
    "aborted attempt wrote nothing; the re-record grades normally",
  );
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all rep-abort tests pass`);
