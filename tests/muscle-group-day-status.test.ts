/**
 * Phase 10 — closeOutDay decision-logic tests.
 *
 * Run: npx tsx tests/muscle-group-day-status.test.ts
 *
 * Pure-function assertions for the 5 end-states:
 *   complete            — 4 reps, no graduation
 *   complete_graduated  — 4 reps + graduation rep done
 *   partial             — 1-3 reps
 *   frozen_skip         — 0 reps + freeze available
 *   missed              — 0 reps + no freeze
 * Plus the streak-preserved / freeze-consume / baseline-set columns.
 */

import { decideStatus, dayTargetReps } from "@/lib/muscle-groups/day-status";

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

section("complete");
{
  const r = decideStatus({
    completedReps: 4,
    hasGraduated: false,
    freezeAvailable: false,
  });
  assert(r.status === "complete", "status = complete");
  assert(r.preservesStreak === true, "preserves streak");
  assert(r.consumesFreeze === false, "no freeze consumed");
  assert(r.setsBaseline === true, "sets baseline");
  assert(r.notificationKind === "day_complete", "notif = day_complete");
}

section("complete_graduated");
{
  const r = decideStatus({
    completedReps: 4,
    hasGraduated: true,
    freezeAvailable: false,
  });
  assert(r.status === "complete_graduated", "status = complete_graduated");
  assert(r.preservesStreak === true, "preserves streak");
  assert(r.setsBaseline === true, "sets baseline");
  assert(r.notificationKind === "day_complete", "notif = day_complete");
}

section("partial");
{
  for (const reps of [1, 2, 3]) {
    const r = decideStatus({
      completedReps: reps,
      hasGraduated: false,
      freezeAvailable: false,
    });
    assert(r.status === "partial", `${reps} reps → partial`);
    assert(r.preservesStreak === true, `${reps} reps preserves streak`);
    assert(r.consumesFreeze === false, `${reps} reps no freeze`);
    assert(r.setsBaseline === false, `${reps} reps no baseline`);
  }
}

section("frozen_skip");
{
  const r = decideStatus({
    completedReps: 0,
    hasGraduated: false,
    freezeAvailable: true,
  });
  assert(r.status === "frozen_skip", "0 reps + freeze → frozen_skip");
  assert(r.preservesStreak === true, "preserves streak");
  assert(r.consumesFreeze === true, "consumes freeze");
  assert(r.setsBaseline === false, "no baseline");
  assert(
    r.notificationKind === "freeze_consumed",
    "notif = freeze_consumed",
  );
}

section("missed");
{
  const r = decideStatus({
    completedReps: 0,
    hasGraduated: false,
    freezeAvailable: false,
  });
  assert(r.status === "missed", "0 reps + no freeze → missed");
  assert(r.preservesStreak === false, "streak resets");
  assert(r.consumesFreeze === false, "no freeze consumed");
  assert(r.setsBaseline === false, "no baseline");
  assert(r.notificationKind === "day_missed", "notif = day_missed");
}

section("partial-vs-frozen edge: 1 rep doesn't burn a freeze");
{
  const r = decideStatus({
    completedReps: 1,
    hasGraduated: false,
    freezeAvailable: true,
  });
  assert(r.status === "partial", "1 rep w/ freeze still partial");
  assert(r.consumesFreeze === false, "freeze NOT consumed for partial");
}

// PRD v3 Phase 2.1 — day-complete target derives from the planned
// exercise count (3 in the v2 engine, 4 legacy default).
section("v2: targetReps=3 day");
{
  const complete = decideStatus({
    completedReps: 3,
    hasGraduated: false,
    freezeAvailable: false,
    targetReps: 3,
  });
  assert(complete.status === "complete", "3 of 3 → complete");
  assert(complete.setsBaseline === true, "3 of 3 sets baseline");

  const partial = decideStatus({
    completedReps: 2,
    hasGraduated: false,
    freezeAvailable: false,
    targetReps: 3,
  });
  assert(partial.status === "partial", "2 of 3 → partial");

  const graduated = decideStatus({
    completedReps: 3,
    hasGraduated: true,
    freezeAvailable: false,
    targetReps: 3,
  });
  assert(
    graduated.status === "complete_graduated",
    "3 of 3 + graduation → complete_graduated",
  );

  // Legacy default: 3 reps is still partial on a 4-target day.
  const legacy = decideStatus({
    completedReps: 3,
    hasGraduated: false,
    freezeAvailable: false,
  });
  assert(legacy.status === "partial", "3 reps w/o targetReps stays partial (default 4)");
}

section("dayTargetReps derivation");
{
  assert(dayTargetReps(["a", "b", "c"]) === 3, "3 planned ids → 3");
  assert(dayTargetReps(["a", "b", "c", "d"]) === 4, "4 planned ids → 4");
  assert(dayTargetReps([]) === 4, "empty list → fallback 4");
  assert(dayTargetReps(null) === 4, "null → fallback 4");
  assert(dayTargetReps("junk") === 4, "malformed → fallback 4");
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all day-status tests pass`);
