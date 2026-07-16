/**
 * Pressure archetype tests — WS-3 invariants that survive the System A
 * retirement (Phase 2B.3, D23): archetype selection + weight-profile
 * integrity. Plan-level pressure invariants (slot position, budgets,
 * flow ramp) live in tests/session-types.test.ts against the pure
 * builders; the DB-backed planner is covered by dev smokes.
 *
 * Run: npx tsx tests/pressure-orchestrator.test.ts
 */

import {
  PRESSURE_ARCHETYPE_IDS,
  PRESSURE_ARCHETYPES,
  getPressureArchetype,
  selectPressureArchetype,
  type PressureArchetypeId,
} from "@/lib/ai/pressure-archetypes";
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
section("Archetype registry integrity");

assert(
  PRESSURE_ARCHETYPE_IDS.length === 5,
  `5 archetypes (got ${PRESSURE_ARCHETYPE_IDS.length})`,
);
for (const id of PRESSURE_ARCHETYPE_IDS) {
  const a = PRESSURE_ARCHETYPES[id];
  assert(a.id === id, `${id}: registry key matches archetype id`);
  assert(a.name.length > 0 && a.tagline.length > 0, `${id}: name + tagline set`);
  assert(
    a.stressedDimensions.length > 0 &&
      a.stressedDimensions.every((d) =>
        (SKILL_DIMENSIONS as readonly string[]).includes(d),
      ),
    `${id}: stressedDimensions are valid SkillDimensions`,
  );
  assert(
    getPressureArchetype(id) === a,
    `${id}: getPressureArchetype round-trips`,
  );
}

section("Weight profiles cover all six dimensions");

for (const id of PRESSURE_ARCHETYPE_IDS) {
  const profile = PRESSURE_ARCHETYPES[id].weightProfile;
  for (const dim of SKILL_DIMENSIONS) {
    const w = profile[dim];
    assert(
      typeof w === "number" && w > 0,
      `${id}: weightProfile[${dim}] is a positive number (got ${w})`,
    );
  }
}

// ————————————————————————————————————————————————————————————————
section("Archetype selection excludes previous archetype");

for (const prev of PRESSURE_ARCHETYPE_IDS) {
  for (let i = 0; i < 20; i++) {
    const picked = selectPressureArchetype({ previousArchetype: prev });
    assert(
      picked.id !== prev,
      `selection after ${prev} never repeats it (got ${picked.id})`,
    );
    if (picked.id === prev) break;
  }
}

section("Archetype distribution is approximately uniform");

{
  const counts = new Map<PressureArchetypeId, number>();
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const a = selectPressureArchetype();
    counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
  }
  for (const id of PRESSURE_ARCHETYPE_IDS) {
    const share = (counts.get(id) ?? 0) / N;
    assert(
      share > 0.12 && share < 0.28,
      `${id} share ≈ 20% over ${N} draws (got ${(share * 100).toFixed(1)}%)`,
    );
  }
}

section("Deterministic selection with injected rand");

{
  const a = selectPressureArchetype({ rand: () => 0 });
  const b = selectPressureArchetype({ rand: () => 0 });
  assert(a.id === b.id, "same rand → same archetype");
}

// ————————————————————————————————————————————————————————————————
console.log(`\n${"═".repeat(60)}`);
console.log(`  Passed: ${pass}   Failed: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`${"═".repeat(60)}\n`);

process.exit(fail === 0 ? 0 : 1);
