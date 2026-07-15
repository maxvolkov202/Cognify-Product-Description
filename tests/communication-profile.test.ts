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
  COACHED_ATTEMPT_WEIGHT,
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

section("coached attempts fold at half weight (Phase 15 I-9)");
{
  assert(COACHED_ATTEMPT_WEIGHT === 0.5, "half weight pinned (doc contract)");

  // Same prior, same evidence — the retry moves the estimate exactly
  // half as far as a first attempt would.
  const prior = applyRepToProfile(emptyProfile(), {
    dimensions: dims(70),
    at: AT,
  });
  const asFirst = applyRepToProfile(prior, {
    dimensions: dims(90),
    attemptKind: "first",
    at: AT,
  });
  const asRetry = applyRepToProfile(prior, {
    dimensions: dims(90),
    attemptKind: "retry",
    at: AT,
  });
  // prior 70, k=0.5: first → 80; retry (k=0.25) → 75.
  assert(asFirst.coreSkills.clarity?.score === 80, "first attempt moves full k");
  assert(
    asRetry.coreSkills.clarity?.score === 75,
    `retry moves half k (got ${asRetry.coreSkills.clarity?.score})`,
  );
  const firstMove = asFirst.coreSkills.clarity!.score - 70;
  const retryMove = asRetry.coreSkills.clarity!.score - 70;
  assert(
    Math.abs(retryMove - firstMove * COACHED_ATTEMPT_WEIGHT) < 1e-9,
    "retry movement is exactly half the first-attempt movement",
  );

  // "again" attempts are coached too.
  const asAgain = applyRepToProfile(prior, {
    dimensions: dims(90),
    attemptKind: "again",
    at: AT,
  });
  assert(asAgain.coreSkills.clarity?.score === 75, "again moves half k");

  // PRD "every rep contributes" preserved: the retry still moves the
  // estimate, still counts as a sample, still increments totalReps.
  assert(retryMove > 0, "retry still moves the estimate");
  assert(
    asRetry.coreSkills.clarity?.sampleCount === 2 && asRetry.totalReps === 2,
    "retry still counts as a sample + rep",
  );

  // Half weight applies to hidden skills and application estimates too.
  const hiddenPrior = applyRepToProfile(emptyProfile(), {
    dimensions: dims(70),
    subSkillScores: { vocabulary_precision: 60 },
    applicationId: "storytelling",
    composite: 60,
    at: AT,
  });
  const hiddenRetry = applyRepToProfile(hiddenPrior, {
    dimensions: dims(70),
    subSkillScores: { vocabulary_precision: 80 },
    applicationId: "storytelling",
    composite: 80,
    attemptKind: "retry",
    at: AT,
  });
  assert(
    hiddenRetry.hiddenSkills.vocabulary_precision?.score === 65,
    `hidden skill folds at half k (got ${hiddenRetry.hiddenSkills.vocabulary_precision?.score})`,
  );
  assert(
    hiddenRetry.applications.storytelling?.score === 65,
    `application estimate folds at half k (got ${hiddenRetry.applications.storytelling?.score})`,
  );

  // First evidence for a skill is adopted outright even on a retry —
  // an EMA with no prior has nothing to blend against.
  const coldRetry = applyRepToProfile(emptyProfile(), {
    dimensions: dims(66),
    attemptKind: "retry",
    at: AT,
  });
  assert(
    coldRetry.coreSkills.clarity?.score === 66,
    "no prior estimate → evidence adopted outright even when coached",
  );

  // Legacy callers that omit attemptKind keep full weight (back-compat).
  const omitted = applyRepToProfile(prior, { dimensions: dims(90), at: AT });
  assert(
    omitted.coreSkills.clarity?.score === 80,
    "omitted attemptKind → full weight",
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
      vocabulary_precision: 65,
      not_a_real_skill: 90,
    },
    at: AT,
  });
  assert(p.hiddenSkills.vocabulary_precision?.score === 65, "valid hidden skill folded");
  assert(
    !("not_a_real_skill" in p.hiddenSkills),
    "invalid hidden skill id rejected",
  );
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    subSkillScores: { vocabulary_precision: 85 },
    at: AT,
  });
  assert(p.hiddenSkills.vocabulary_precision?.score === 75, "hidden skill EMA (k=0.5)");
}

section("application performance (PRD §8.3.6)");
{
  let p = emptyProfile();
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    applicationId: "storytelling",
    composite: 72,
    at: AT,
  });
  assert(
    p.applications.storytelling?.score === 72,
    "first app rep adopts composite",
  );
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    applicationId: "storytelling",
    composite: 80,
    at: AT,
  });
  assert(
    p.applications.storytelling?.score === 76,
    "app estimate EMAs (k=0.5)",
  );
  // Daily Workout reps (no applicationId) leave applications untouched.
  p = applyRepToProfile(p, { dimensions: dims(60), at: AT });
  assert(
    p.applications.storytelling?.sampleCount === 2,
    "non-app reps don't touch application estimates",
  );
}

section("application skills (PRD §8.4.5)");
{
  let p = emptyProfile();
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    applicationId: "storytelling",
    applicationSkills: ["establishing_stakes", "narrative_tension"],
    composite: 72,
    at: AT,
  });
  assert(
    p.applications.storytelling?.skills?.establishing_stakes?.score === 72,
    "first app rep seeds each tagged skill with the composite",
  );
  assert(
    p.applications.storytelling?.skills?.narrative_tension?.sampleCount === 1,
    "all tagged skills tracked",
  );
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    applicationId: "storytelling",
    applicationSkills: ["establishing_stakes"],
    composite: 80,
    at: AT,
  });
  assert(
    p.applications.storytelling?.skills?.establishing_stakes?.score === 76,
    "tagged skill EMAs (k=0.5)",
  );
  assert(
    p.applications.storytelling?.skills?.narrative_tension?.score === 72,
    "untagged skill untouched by later reps",
  );
  // Skills outside the app's canonical set are skipped.
  p = applyRepToProfile(p, {
    dimensions: dims(70),
    applicationId: "storytelling",
    applicationSkills: ["clear_ask", "concrete_detail"],
    composite: 90,
    at: AT,
  });
  assert(
    p.applications.storytelling?.skills?.clear_ask === undefined,
    "skills from other applications are rejected",
  );
  assert(
    p.applications.storytelling?.skills?.concrete_detail?.score === 90,
    "valid skill in the same rep still folds",
  );
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
