/**
 * PRD v3 Phase 3 — Communication Profile update-rule tests.
 *
 * Pure-function assertions over src/lib/profile/communication-profile.ts:
 *   • first evidence adopted outright; mature profile moves slowly
 *   • overall score needs ≥3 measured skills; uses DIMENSION_WEIGHTS
 *   • hidden-skill folding validates ids; legacy dims skipped
 *
 * Run: npx tsx tests/communication-profile.test.ts
 */

import {
  applyRepToProfile,
  computeOverallScore,
  emptyProfile,
  learningRate,
  PROFILE_MAX_SAMPLE_WEIGHT,
} from "@/lib/profile/communication-profile";
import { detectPlateau } from "@/lib/profile/plateau";

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

const dims = (clarity: number, structure?: number, tone?: number) => [
  { dimension: "clarity", score: clarity },
  ...(structure != null ? [{ dimension: "structure", score: structure }] : []),
  ...(tone != null ? [{ dimension: "tone", score: tone }] : []),
];
const AT = "2026-07-02T12:00:00Z";

section("learning rate");
{
  assert(learningRate(0) === 1, "first rep adopts evidence outright (k=1)");
  assert(learningRate(1) === 0.5, "second rep k=0.5");
  assert(
    learningRate(50) === 1 / PROFILE_MAX_SAMPLE_WEIGHT,
    "mature profile floors at 1/12",
  );
}

section("core skill folding");
{
  let p = emptyProfile();
  p = applyRepToProfile(p, { dimensions: dims(70), at: AT });
  assert(p.coreSkills.clarity?.score === 70, "first evidence adopted");
  assert(p.coreSkills.clarity?.sampleCount === 1, "sample count 1");
  assert(p.totalReps === 1, "totalReps increments");

  p = applyRepToProfile(p, { dimensions: dims(90), at: AT });
  assert(p.coreSkills.clarity?.score === 80, "second rep averages (k=0.5)");

  // Mature profile barely moves on an outlier.
  let mature = emptyProfile();
  for (let i = 0; i < 20; i++) {
    mature = applyRepToProfile(mature, { dimensions: dims(70), at: AT });
  }
  const before = mature.coreSkills.clarity!.score;
  mature = applyRepToProfile(mature, { dimensions: dims(20), at: AT });
  const moved = before - mature.coreSkills.clarity!.score;
  assert(
    moved > 0 && moved <= 70 / PROFILE_MAX_SAMPLE_WEIGHT + 0.1,
    `mature profile moves slowly on an outlier (moved ${moved.toFixed(1)})`,
  );

  // Legacy / unknown dims skipped.
  const legacy = applyRepToProfile(emptyProfile(), {
    dimensions: [
      { dimension: "relevance", score: 50 },
      { dimension: "structural_adherence", score: 50 },
    ],
    at: AT,
  });
  assert(
    Object.keys(legacy.coreSkills).length === 0,
    "legacy + structural dims skipped",
  );
}

section("overall score");
{
  let p = emptyProfile();
  p = applyRepToProfile(p, { dimensions: dims(70), at: AT });
  assert(p.overallScore === null, "1 skill → no overall");
  p = applyRepToProfile(p, { dimensions: dims(70, 80), at: AT });
  assert(p.overallScore === null, "2 skills → no overall");
  p = applyRepToProfile(p, { dimensions: dims(70, 80, 60), at: AT });
  assert(p.overallScore != null, "3 skills → overall appears");
  // Weighted: clarity .25, structure .20, tone .10 — check direction.
  const overall = computeOverallScore(p.coreSkills)!;
  assert(overall > 60 && overall < 85, `overall in plausible band (${overall})`);
}

section("hidden skills");
{
  let p = emptyProfile();
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    subSkillScores: {
      word_choice: 65,
      not_a_real_skill: 90,
    },
    at: AT,
  });
  assert(p.hiddenSkills.word_choice?.score === 65, "valid hidden skill folded");
  assert(
    !("not_a_real_skill" in p.hiddenSkills),
    "invalid hidden skill id rejected",
  );
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    subSkillScores: { word_choice: 85 },
    at: AT,
  });
  assert(p.hiddenSkills.word_choice?.score === 75, "hidden skill EMA (k=0.5)");
}

section("plateau detection");
{
  const now = new Date("2026-07-02T12:00:00Z");
  const daysAgo = (n: number, score: number) => ({
    at: new Date(now.getTime() - n * 86_400_000).toISOString(),
    score,
  });

  // Flat mid-band series with plenty of samples → plateau.
  const flat = Array.from({ length: 10 }, (_, i) => daysAgo(18 - i * 2, 65));
  assert(detectPlateau(flat, now) === true, "flat 65 series → plateaued");

  // Clearly improving series → not a plateau.
  const rising = Array.from({ length: 10 }, (_, i) =>
    daysAgo(18 - i * 2, 55 + i * 3),
  );
  assert(detectPlateau(rising, now) === false, "rising series → not plateaued");

  // Flat but at mastery level → maintenance, not plateau.
  const mastery = Array.from({ length: 10 }, (_, i) => daysAgo(18 - i * 2, 90));
  assert(detectPlateau(mastery, now) === false, "flat at 90 → mastery, not plateau");

  // Too few samples → no verdict.
  const sparse = Array.from({ length: 4 }, (_, i) => daysAgo(12 - i * 3, 65));
  assert(detectPlateau(sparse, now) === false, "sparse data → not plateaued");

  // Old samples outside the window don't count.
  const stale = Array.from({ length: 10 }, (_, i) => daysAgo(30 + i, 65));
  assert(detectPlateau(stale, now) === false, "stale data outside window ignored");
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all communication-profile tests pass`);
