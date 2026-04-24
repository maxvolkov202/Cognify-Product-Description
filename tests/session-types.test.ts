/**
 * Session type orchestrator tests — WS-6 invariants for Focus + Flow.
 *
 * Run: npx tsx tests/session-types.test.ts
 */

import {
  planTodaysWorkout,
  planFocusWorkout,
  planFlowSession,
} from "@/lib/ai/workout-prompts";
import { PRESSURE_ARCHETYPE_IDS } from "@/lib/ai/pressure-archetypes";
import { SKILL_DIMENSIONS } from "@/types/domain";

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
// COMBINED (default planTodaysWorkout) tags sessionType correctly
// ————————————————————————————————————————————————————————————————
section("Combined session is tagged sessionType='combined'");

const combined = planTodaysWorkout({ count: 4 });
assert(combined.sessionType === "combined", "planTodaysWorkout returns sessionType='combined'");
assert(combined.focusDimension === undefined, "combined has no focusDimension");

// ————————————————————————————————————————————————————————————————
// FOCUS orchestrator
// ————————————————————————————————————————————————————————————————
section("Focus session tags sessionType + focusDimension");

for (const dim of SKILL_DIMENSIONS) {
  const plan = planFocusWorkout({ focusDimension: dim, count: 4 });
  assert(
    plan.sessionType === "focus",
    `Focus session for ${dim} has sessionType='focus'`,
  );
  assert(
    plan.focusDimension === dim,
    `Focus session for ${dim} has focusDimension=${dim}`,
  );
}

section("Focus session non-pressure reps touch the focus dimension");

// For each dim, ensure non-pressure reps all have focus dim as primary OR secondary
for (const dim of SKILL_DIMENSIONS) {
  const plan = planFocusWorkout({ focusDimension: dim, count: 4 });
  const nonPressure = plan.reps.filter((r) => r.pressureArchetype === undefined);
  const hits = nonPressure.filter(
    (r) =>
      r.repType.primaryDimension === dim ||
      r.repType.secondaryDimensions.includes(dim),
  );
  // Some dims have narrow coverage — allow at least half to match
  const matchRatio = nonPressure.length === 0 ? 1 : hits.length / nonPressure.length;
  assert(
    matchRatio >= 0.5,
    `Focus on ${dim}: at least 50% of non-pressure reps touch ${dim} (got ${hits.length}/${nonPressure.length})`,
  );
}

section("Focus session still has pressure rep at N-1");

for (const dim of SKILL_DIMENSIONS) {
  const plan = planFocusWorkout({ focusDimension: dim, count: 4 });
  const pressureIdx = plan.reps.findIndex((r) => r.pressureArchetype !== undefined);
  assert(
    pressureIdx === 2,
    `Focus on ${dim}: pressure rep at index 2 (got ${pressureIdx})`,
  );
}

// ————————————————————————————————————————————————————————————————
// FLOW orchestrator
// ————————————————————————————————————————————————————————————————
section("Flow session is always 5 reps, all pressure");

const flow = planFlowSession();
assert(flow.sessionType === "flow", "Flow session has sessionType='flow'");
assert(flow.reps.length === 5, `Flow session has exactly 5 reps (got ${flow.reps.length})`);
assert(
  flow.reps.every((r) => r.pressureArchetype !== undefined),
  "Every Flow rep has a pressureArchetype",
);

section("Flow session uses all 5 archetypes exactly once");

const archetypesUsed = new Set(flow.reps.map((r) => r.pressureArchetype?.id));
assert(archetypesUsed.size === 5, `Flow uses 5 distinct archetypes (got ${archetypesUsed.size})`);
for (const id of PRESSURE_ARCHETYPE_IDS) {
  assert(archetypesUsed.has(id), `Flow includes ${id} archetype`);
}

section("Flow archetype order matches the design ramp (time → audience → pushback → interrupt → stakes)");

const expectedOrder = [
  "time_compression",
  "audience_switch",
  "pushback",
  "clarifying_interrupt",
  "stakes_raise",
];
for (let i = 0; i < expectedOrder.length; i++) {
  assert(
    flow.reps[i]?.pressureArchetype?.id === expectedOrder[i],
    `Flow rep ${i + 1} is ${expectedOrder[i]} (got ${flow.reps[i]?.pressureArchetype?.id})`,
  );
}

section("Flow session estimated duration is reasonable (≤ 10 min)");

// Flow should be short per Direction.md (<10 min). 5 reps × ~45s each + 5s feedback
// Max expected: 5 × (60 + 5) = 325s ≈ 5.5 min
assert(
  flow.estimatedDurationSec <= 600,
  `Flow estimated duration ≤ 10 min (got ${flow.estimatedDurationSec}s)`,
);
assert(
  flow.estimatedDurationSec >= 60,
  `Flow estimated duration ≥ 1 min sanity check (got ${flow.estimatedDurationSec}s)`,
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
