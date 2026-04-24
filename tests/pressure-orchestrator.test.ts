/**
 * Pressure orchestrator tests — verify WS-3 invariants.
 *
 * Run: npx tsx tests/pressure-orchestrator.test.ts
 *
 * Exits 0 on success, 1 on any failed assertion. No test runner dep
 * required — uses the same standalone pattern as `e2e-scoring-run.ts`.
 */

import { planTodaysWorkout } from "@/lib/ai/workout-prompts";
import {
  PRESSURE_ARCHETYPE_IDS,
  selectPressureArchetype,
  type PressureArchetypeId,
} from "@/lib/ai/pressure-archetypes";

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

// ————————————————————————————————————————————————————————————————
// 1. Every 4-rep session has a pressure rep at position N-1.
// ————————————————————————————————————————————————————————————————
section("4-rep session always has pressure rep at position 2 (N-1)");

const ITERATIONS = 100;
let positionHits = 0;
let hadAnyPressure = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const plan = planTodaysWorkout({ count: 4 });
  const pressureIdx = plan.reps.findIndex(
    (r) => r.pressureArchetype !== undefined,
  );
  if (pressureIdx >= 0) hadAnyPressure++;
  if (pressureIdx === 2) positionHits++;
}
assert(
  hadAnyPressure === ITERATIONS,
  `every 4-rep session has a pressure rep (got ${hadAnyPressure}/${ITERATIONS})`,
);
assert(
  positionHits === ITERATIONS,
  `pressure rep at position 2 in all 4-rep sessions (got ${positionHits}/${ITERATIONS})`,
);

// ————————————————————————————————————————————————————————————————
// 2. Every 5-rep session has a pressure rep at position N-1 (= 3).
// ————————————————————————————————————————————————————————————————
section("5-rep session always has pressure rep at position 3 (N-1)");

let pos3Hits = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const plan = planTodaysWorkout({ count: 5 });
  const pressureIdx = plan.reps.findIndex(
    (r) => r.pressureArchetype !== undefined,
  );
  if (pressureIdx === 3) pos3Hits++;
}
assert(
  pos3Hits === ITERATIONS,
  `pressure rep at position 3 in all 5-rep sessions (got ${pos3Hits}/${ITERATIONS})`,
);

// ————————————————————————————————————————————————————————————————
// 3. Pressure rep's rep type is always `handle_pressure`.
// ————————————————————————————————————————————————————————————————
section("Pressure rep type is always handle_pressure");

let typeMatches = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const plan = planTodaysWorkout({ count: 4 });
  const pressureSlot = plan.reps.find((r) => r.pressureArchetype);
  if (pressureSlot?.repType.id === "handle_pressure") typeMatches++;
}
assert(
  typeMatches === ITERATIONS,
  `pressure slot's repType is handle_pressure in all plans (got ${typeMatches}/${ITERATIONS})`,
);

// ————————————————————————————————————————————————————————————————
// 4. handle_pressure does NOT appear outside the pressure slot.
// ————————————————————————————————————————————————————————————————
section("handle_pressure never appears in non-pressure slots");

let leakCount = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const plan = planTodaysWorkout({ count: 4 });
  for (let idx = 0; idx < plan.reps.length; idx++) {
    const slot = plan.reps[idx]!;
    if (
      slot.repType.id === "handle_pressure" &&
      slot.pressureArchetype === undefined
    ) {
      leakCount++;
    }
  }
}
assert(
  leakCount === 0,
  `no handle_pressure leaks into non-pressure slots (got ${leakCount} leaks)`,
);

// ————————————————————————————————————————————————————————————————
// 5. Archetype rotation across sessions when previous archetype passed in.
// ————————————————————————————————————————————————————————————————
section("Archetype selection excludes previous archetype");

const sampleSize = 200;
let excludedCount = 0;
for (let i = 0; i < sampleSize; i++) {
  const prev: PressureArchetypeId = "pushback";
  const picked = selectPressureArchetype({ previousArchetype: prev });
  if (picked.id !== prev) excludedCount++;
}
assert(
  excludedCount === sampleSize,
  `previous archetype is never re-selected (got ${excludedCount}/${sampleSize})`,
);

// ————————————————————————————————————————————————————————————————
// 6. Archetype selection distributes uniformly across the 5 when no prev.
// ————————————————————————————————————————————————————————————————
section("Archetype distribution is approximately uniform");

const distSample = 5000;
const counts: Record<PressureArchetypeId, number> = {
  pushback: 0,
  time_compression: 0,
  audience_switch: 0,
  clarifying_interrupt: 0,
  stakes_raise: 0,
};
for (let i = 0; i < distSample; i++) {
  const a = selectPressureArchetype();
  counts[a.id]++;
}
const expected = distSample / PRESSURE_ARCHETYPE_IDS.length; // 1000
const tolerance = expected * 0.2; // 20% tolerance
let uniformOk = true;
for (const id of PRESSURE_ARCHETYPE_IDS) {
  const delta = Math.abs(counts[id] - expected);
  if (delta > tolerance) uniformOk = false;
  console.log(`  ${id.padEnd(22)} ${counts[id]} (expected ~${expected}, delta ${delta})`);
}
assert(
  uniformOk,
  `archetype distribution within ±20% of uniform over ${distSample} samples`,
);

// ————————————————————————————————————————————————————————————————
// 7. Pressure slot has prompts (from the pressure bank, not empty).
// ————————————————————————————————————————————————————————————————
section("Pressure rep has 5 prompts drawn from the archetype bank");

let promptsOk = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const plan = planTodaysWorkout({ count: 4 });
  const pressureSlot = plan.reps.find((r) => r.pressureArchetype);
  if (
    pressureSlot &&
    pressureSlot.prompts.length === 5 &&
    pressureSlot.prompts.every((p) => p.length > 0)
  ) {
    promptsOk++;
  }
}
assert(
  promptsOk === ITERATIONS,
  `pressure slot has 5 non-empty prompts (got ${promptsOk}/${ITERATIONS})`,
);

// ————————————————————————————————————————————————————————————————
// 8. Pressure rep time budget respects archetype durationDeltaSec.
// ————————————————————————————————————————————————————————————————
section("Pressure rep time budget = repType.timeBudgetSec + archetype.durationDeltaSec");

let budgetOk = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const plan = planTodaysWorkout({ count: 4 });
  const pressureSlot = plan.reps.find((r) => r.pressureArchetype);
  if (!pressureSlot || !pressureSlot.pressureArchetype) continue;
  const baseSec = pressureSlot.repType.timeBudgetSec;
  const delta = pressureSlot.pressureArchetype.durationDeltaSec;
  const expectedSec = Math.max(15, baseSec + delta);
  const actualSec = pressureSlot.timeBudgetMs / 1000;
  if (Math.abs(actualSec - expectedSec) < 0.001) budgetOk++;
}
assert(
  budgetOk === ITERATIONS,
  `time budget = base + delta for all pressure reps (got ${budgetOk}/${ITERATIONS})`,
);

// ————————————————————————————————————————————————————————————————
// 9. Sessions of count < 4 skip the pressure rep (no arc room).
// ————————————————————————————————————————————————————————————————
section("Sessions with count < 4 skip the pressure rep");

const plan3 = planTodaysWorkout({ count: 3 });
const plan2 = planTodaysWorkout({ count: 2 });
assert(
  !plan3.reps.some((r) => r.pressureArchetype),
  "3-rep session has no pressure rep",
);
assert(
  !plan2.reps.some((r) => r.pressureArchetype),
  "2-rep session has no pressure rep",
);

// ————————————————————————————————————————————————————————————————
// 10. disablePressureRep flag opts out cleanly.
// ————————————————————————————————————————————————————————————————
section("disablePressureRep=true skips pressure rep in 4-rep session");

const disabledPlan = planTodaysWorkout({ count: 4, disablePressureRep: true });
assert(
  !disabledPlan.reps.some((r) => r.pressureArchetype),
  "disablePressureRep=true produces no pressure rep",
);

// ————————————————————————————————————————————————————————————————
// Summary
// ————————————————————————————————————————————————————————————————
console.log(`\n${"═".repeat(60)}`);
console.log(`  Passed: ${pass}   Failed: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`${"═".repeat(60)}\n`);

process.exit(fail === 0 ? 0 : 1);
