/**
 * PRD v3 Phase 4 — Lab Personalization Engine tests (PRD §8.4.5, §6.6).
 *
 * Pure-function assertions over src/server/lib/skill-lab/selection.ts:
 *   • weakest Application Skill wins; unmeasured explores before strong
 *   • diversity penalty spreads a session across different skills
 *   • recent exercises deprioritized, never starved
 *   • count > catalog cycles deterministically; determinism per seed
 *
 * Run: npx tsx tests/skill-lab-selection.test.ts
 */

import {
  selectLabExercises,
  type LabExerciseCandidate,
} from "@/server/lib/skill-lab/selection";

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

const CATALOG: LabExerciseCandidate[] = [
  { id: "personal-story", applicationSkills: ["establishing_stakes", "concrete_detail"] },
  { id: "failure-story", applicationSkills: ["showing_change", "clear_takeaway"] },
  { id: "success-story", applicationSkills: ["narrative_tension", "making_listener_care"] },
  { id: "turning-point", applicationSkills: ["narrative_tension", "showing_change"] },
  { id: "origin-story", applicationSkills: ["establishing_stakes", "making_listener_care"] },
  { id: "lesson-story", applicationSkills: ["clear_takeaway", "concrete_detail"] },
];

section("weakness targeting");
{
  // narrative_tension is dramatically weak → its exercises come first.
  const picks = selectLabExercises({
    candidates: CATALOG,
    skillEstimates: {
      establishing_stakes: { score: 80, sampleCount: 4 },
      narrative_tension: { score: 30, sampleCount: 4 },
      concrete_detail: { score: 78, sampleCount: 4 },
      showing_change: { score: 75, sampleCount: 4 },
      clear_takeaway: { score: 82, sampleCount: 4 },
      making_listener_care: { score: 79, sampleCount: 4 },
    },
    recentExerciseIds: new Set(),
    count: 3,
    seed: "s1",
  });
  const first = picks[0]!;
  assert(
    first.id === "success-story" || first.id === "turning-point",
    `weakest-skill exercise picked first (got ${first.id})`,
  );
  assert(
    first.targetSkill === "narrative_tension",
    "target skill is the weakest estimated skill",
  );
}

section("baseline balance (all unmeasured)");
{
  const picks = selectLabExercises({
    candidates: CATALOG,
    skillEstimates: {},
    recentExerciseIds: new Set(),
    count: 3,
    seed: "s2",
  });
  assert(picks.length === 3, "3 picks");
  const skills = new Set(
    picks.flatMap(
      (p) => CATALOG.find((c) => c.id === p.id)!.applicationSkills!,
    ),
  );
  assert(
    skills.size >= 5,
    `diversity penalty spreads skills across the session (${skills.size} distinct)`,
  );
}

section("unmeasured explores before strong");
{
  // Everything strong except one UNMEASURED skill → its exercise leads.
  const picks = selectLabExercises({
    candidates: CATALOG,
    skillEstimates: {
      establishing_stakes: { score: 80, sampleCount: 4 },
      concrete_detail: { score: 78, sampleCount: 4 },
      showing_change: { score: 75, sampleCount: 4 },
      clear_takeaway: { score: 82, sampleCount: 4 },
      making_listener_care: { score: 79, sampleCount: 4 },
      // narrative_tension never measured → treated as 45.
    },
    recentExerciseIds: new Set(),
    count: 1,
    seed: "s3",
  });
  assert(
    picks[0]!.targetSkill === "narrative_tension",
    "unmeasured skill explored before strong ones",
  );
}

section("recent-use deprioritization");
{
  // Uniform estimates; the recent exercise should not lead.
  const uniform = Object.fromEntries(
    [
      "establishing_stakes",
      "narrative_tension",
      "concrete_detail",
      "showing_change",
      "clear_takeaway",
      "making_listener_care",
    ].map((s) => [s, { score: 60, sampleCount: 3 }]),
  );
  const seedsToTry = ["a", "b", "c", "d", "e"];
  let recentLedCount = 0;
  for (const seed of seedsToTry) {
    const picks = selectLabExercises({
      candidates: CATALOG,
      skillEstimates: uniform,
      recentExerciseIds: new Set(["personal-story"]),
      count: 1,
      seed,
    });
    if (picks[0]!.id === "personal-story") recentLedCount++;
  }
  assert(recentLedCount === 0, "recently-used exercise never leads on uniform estimates");

  // ...but genuine weakness still beats freshness (gap > penalty): with
  // BOTH exercises carrying the weak skill recently used, one of them
  // still leads because 20 + recent(20) < uniform 60.
  const picks = selectLabExercises({
    candidates: CATALOG,
    skillEstimates: {
      ...uniform,
      establishing_stakes: { score: 20, sampleCount: 5 },
    },
    recentExerciseIds: new Set(["personal-story", "origin-story"]),
    count: 1,
    seed: "s4",
  });
  assert(
    picks[0]!.targetSkill === "establishing_stakes",
    "a very weak skill outweighs the recent-use penalty",
  );
}

section("cycling + determinism");
{
  const input = {
    candidates: CATALOG,
    skillEstimates: {},
    recentExerciseIds: new Set<string>(),
    count: 10,
    seed: "s5",
  };
  const a = selectLabExercises(input);
  const b = selectLabExercises(input);
  assert(a.length === 10, "count > catalog still returns exactly count");
  assert(
    new Set(a.slice(0, 6).map((p) => p.id)).size === 6,
    "first cycle covers the whole catalog before repeating",
  );
  assert(a[6]!.id === a[0]!.id, "repeats cycle the weakness-priority order");
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "same seed → identical selection",
  );
  const c = selectLabExercises({ ...input, seed: "s6" });
  assert(
    JSON.stringify(a) !== JSON.stringify(c),
    "different seed can differ (shuffle tiebreak)",
  );
}

section("edge cases");
{
  assert(
    selectLabExercises({
      candidates: [],
      skillEstimates: {},
      recentExerciseIds: new Set(),
      count: 3,
      seed: "s7",
    }).length === 0,
    "empty catalog → empty result",
  );
  const noMeta = selectLabExercises({
    candidates: [{ id: "x", applicationSkills: null }],
    skillEstimates: {},
    recentExerciseIds: new Set(),
    count: 2,
    seed: "s8",
  });
  assert(
    noMeta.length === 2 && noMeta[0]!.id === "x" && noMeta[0]!.targetSkill === null,
    "metadata-less rows still selectable with null targetSkill",
  );
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all skill-lab-selection tests pass`);
