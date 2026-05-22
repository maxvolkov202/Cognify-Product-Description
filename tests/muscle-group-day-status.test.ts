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

import { decideStatus } from "@/lib/muscle-groups/day-status";

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

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all day-status tests pass`);
