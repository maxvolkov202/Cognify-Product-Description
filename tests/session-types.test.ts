/**
 * Lab session plan tests — Phase 2B.3 (D23) invariants for the pure
 * catalog-backed plan builders (src/lib/workout/lab-plan.ts). The DB
 * side (exercise choice, slates) lives in the planLabSession server
 * action and is exercised by dev smokes; these tests pin the pure
 * assembly: rep-type synthesis, framework rotation, budgets, focus
 * contexts, session typing.
 *
 * Run: npx tsx tests/session-types.test.ts
 */

import {
  buildCatalogRepType,
  buildLabSessionPlan,
  focusForFocusMode,
  focusForMixedRep0,
  focusForPressureRep,
  DIMENSION_BASE_REP_TYPE,
  type LabCatalogExercise,
  type LabSlotSeed,
} from "@/lib/workout/lab-plan";
import { getRepType } from "@/lib/ai/rep-types";
import { getPressureArchetype } from "@/lib/ai/pressure-archetypes";
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

function fakeExercise(
  overrides: Partial<LabCatalogExercise> & {
    dimension: LabCatalogExercise["dimension"];
  },
): LabCatalogExercise {
  return {
    id: `ex-${overrides.dimension}-${overrides.slug ?? "a"}`,
    slug: "explain-like-im-12",
    name: "Explain Like I'm 12",
    rule: "No word a 12-year-old wouldn't recognize.",
    secondaryCoreSkills: null,
    responseWindow: null,
    hiddenSkills: null,
    ...overrides,
  };
}

function slotSeed(
  exercise: LabCatalogExercise,
  extra?: Partial<LabSlotSeed>,
): LabSlotSeed {
  return {
    exercise,
    prompts: ["Prompt one?", "Prompt two?", "Prompt three?"],
    promptIds: ["p1", "p2", "p3"],
    focus: null,
    ...extra,
  };
}

// ————————————————————————————————————————————————————————————————
section("buildCatalogRepType overlays exercise identity on the base rep type");

for (const dim of SKILL_DIMENSIONS) {
  const ex = fakeExercise({
    dimension: dim,
    name: `Test ${dim}`,
    rule: "The rule.",
  });
  const rt = buildCatalogRepType(ex);
  assert(rt.name === `Test ${dim}`, `${dim}: name comes from the exercise`);
  assert(
    rt.displayTitle === `Test ${dim}`,
    `${dim}: displayTitle comes from the exercise`,
  );
  assert(rt.behavior === "The rule.", `${dim}: behavior is the exercise rule`);
  assert(
    rt.primaryDimension === dim,
    `${dim}: primaryDimension is the exercise dimension`,
  );
  const base = getRepType(DIMENSION_BASE_REP_TYPE[dim]);
  assert(
    rt.timeBudgetSec === base.timeBudgetSec,
    `${dim}: budget falls back to base rep type`,
  );
  assert(
    rt.framework === base.framework,
    `${dim}: framework scaffold comes from the base`,
  );
}

section("buildCatalogRepType respects response window + secondary dims + pacing alias");

{
  const ex = fakeExercise({
    dimension: "tone",
    responseWindow: { minSec: 45, maxSec: 90 },
    secondaryCoreSkills: ["pacing", "clarity", "tone"] as never,
  });
  const rt = buildCatalogRepType(ex);
  assert(rt.timeBudgetSec === 90, "response window max drives the budget");
  assert(
    rt.secondaryDimensions.includes("delivery") &&
      rt.secondaryDimensions.includes("clarity"),
    "legacy 'pacing' secondary aliases to 'delivery'",
  );
  assert(
    !rt.secondaryDimensions.includes("tone"),
    "primary dimension is filtered out of secondaries",
  );
}

// ————————————————————————————————————————————————————————————————
section("Focus plan typing");

{
  const slots = Array.from({ length: 4 }, (_, i) =>
    slotSeed(
      fakeExercise({ dimension: "clarity", slug: `s${i}`, id: `id-${i}` }),
      { focus: focusForFocusMode("clarity") },
    ),
  );
  const plan = buildLabSessionPlan({
    slots,
    sessionType: "focus",
    focusDimension: "clarity",
    planId: "test-focus",
  });
  assert(plan.sessionType === "focus", "sessionType='focus'");
  assert(plan.focusDimension === "clarity", "focusDimension set");
  assert(plan.id === "test-focus", "injected planId respected");
  assert(
    plan.reps.every((r) => r.repType.primaryDimension === "clarity"),
    "every rep trains the focus dimension",
  );
  assert(
    plan.reps.every((r) => r.exerciseId != null),
    "every rep carries its catalog exerciseId",
  );
  assert(
    plan.reps.every((r) => r.focus?.source === "session_intent"),
    "focus reps carry session_intent focus context",
  );
}

section("Framework rotation across repeat slots of the same dimension");

{
  const slots = Array.from({ length: 3 }, (_, i) =>
    slotSeed(
      fakeExercise({ dimension: "structure", slug: `s${i}`, id: `id-${i}` }),
    ),
  );
  const plan = buildLabSessionPlan({
    slots,
    sessionType: "focus",
    focusDimension: "structure",
  });
  const names = plan.reps.map((r) => r.framework.name);
  assert(
    new Set(names.slice(0, 2)).size === 2,
    `first two structure slots rotate frameworks (got ${names.join(" | ")})`,
  );
}

// ————————————————————————————————————————————————————————————————
section("Mixed plan typing + rep-0 focus");

{
  const slots = [
    slotSeed(fakeExercise({ dimension: "clarity" }), {
      focus: focusForMixedRep0("clarity"),
    }),
    slotSeed(fakeExercise({ dimension: "tone" })),
  ];
  const plan = buildLabSessionPlan({ slots, sessionType: "combined" });
  assert(plan.sessionType === "combined", "mixed plan is 'combined'");
  assert(
    plan.focusDimension === undefined,
    "mixed plan has no focusDimension",
  );
  assert(
    plan.reps[0]!.focus?.bannerText.includes("mixed set"),
    "rep 0 carries the mixed-set banner",
  );
  assert(plan.reps[1]!.focus === null, "later mixed reps have no focus context");
}

// ————————————————————————————————————————————————————————————————
section("Pressure slots: archetype, budget delta, focus");

{
  const archetype = getPressureArchetype("time_compression");
  const ex = fakeExercise({
    dimension: "conciseness",
    responseWindow: { minSec: 30, maxSec: 60 },
  });
  const plan = buildLabSessionPlan({
    slots: [
      slotSeed(ex, {
        focus: focusForPressureRep(archetype),
        pressureArchetype: archetype,
      }),
    ],
    sessionType: "flow",
  });
  const rep = plan.reps[0]!;
  assert(
    rep.pressureArchetype?.id === "time_compression",
    "archetype carried onto the slot",
  );
  assert(
    rep.timeBudgetMs === 60_000,
    `explicit response window wins over the archetype delta (got ${rep.timeBudgetMs})`,
  );
  const noWindow = buildLabSessionPlan({
    slots: [
      slotSeed(fakeExercise({ dimension: "conciseness" }), {
        focus: focusForPressureRep(archetype),
        pressureArchetype: archetype,
      }),
    ],
    sessionType: "flow",
  });
  const baseBudget = noWindow.reps[0]!.repType.timeBudgetSec;
  assert(
    noWindow.reps[0]!.timeBudgetMs ===
      Math.max(15, baseBudget + archetype.durationDeltaSec) * 1000,
    `windowless pressure slot applies the archetype delta (got ${noWindow.reps[0]!.timeBudgetMs})`,
  );
  assert(
    rep.focus?.bannerText.toLowerCase().startsWith("pressure:"),
    "pressure focus banner names the mechanism",
  );
  assert(plan.sessionType === "flow", "pressure plan is 'flow'");
}

section("Duration estimate scales with slots");

{
  const one = buildLabSessionPlan({
    slots: [slotSeed(fakeExercise({ dimension: "clarity" }))],
    sessionType: "focus",
    focusDimension: "clarity",
  });
  const three = buildLabSessionPlan({
    slots: Array.from({ length: 3 }, (_, i) =>
      slotSeed(fakeExercise({ dimension: "clarity", id: `id-${i}` })),
    ),
    sessionType: "focus",
    focusDimension: "clarity",
  });
  assert(
    three.estimatedDurationSec === one.estimatedDurationSec * 3,
    "estimate is linear in identical slots",
  );
  assert(one.estimatedDurationSec >= 60, "single-rep estimate ≥ 1 min sanity");
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
