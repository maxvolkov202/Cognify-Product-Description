/**
 * UI + Feature Overhaul Wave — Phase 0 — Stepper clamp logic.
 *
 * Pure-function assertions over the exported clamp helpers in
 * `src/components/ui/Stepper.tsx` (the primitive reused by the 1–5 rep
 * stepper in Phase 1 and any other count picker). The React render is not
 * exercised here — this harness has no DOM renderer — only the math.
 *
 * Run: npx tsx tests/stepper.test.ts
 */

import { clampToRange, clampStep } from "@/components/ui/Stepper";

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

section("clampToRange");
{
  assert(clampToRange(3, 1, 5) === 3, "in-range value is unchanged");
  assert(clampToRange(0, 1, 5) === 1, "below-min clamps up to min");
  assert(clampToRange(9, 1, 5) === 5, "above-max clamps down to max");
  assert(clampToRange(1, 1, 5) === 1, "exact min stays at min");
  assert(clampToRange(5, 1, 5) === 5, "exact max stays at max");
}

section("clampStep — Phase 1 rep stepper range 1..5");
{
  const MIN = 1;
  const MAX = 5;
  assert(clampStep(3, 1, MIN, MAX) === 4, "+1 from 3 → 4");
  assert(clampStep(3, -1, MIN, MAX) === 2, "-1 from 3 → 2");
  assert(clampStep(5, 1, MIN, MAX) === 5, "+1 at max stays at 5");
  assert(clampStep(1, -1, MIN, MAX) === 1, "-1 at min stays at 1");
  assert(clampStep(1, 1, MIN, MAX) === 2, "+1 from min → 2");
  assert(clampStep(5, -1, MIN, MAX) === 4, "-1 from max → 4");
}

section("clampStep — reference MixedRepsStep range 0..5");
{
  const MIN = 0;
  const MAX = 5;
  assert(clampStep(0, -1, MIN, MAX) === 0, "-1 at 0 stays at 0 (skip)");
  assert(clampStep(0, 1, MIN, MAX) === 1, "+1 from 0 → 1");
  assert(clampStep(5, 2, MIN, MAX) === 5, "a multi-step overshoot still clamps to max");
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all stepper tests pass`);
