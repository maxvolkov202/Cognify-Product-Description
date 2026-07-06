/**
 * Phase 3 — muscle-group assignment engine tests.
 *
 * Run: npx tsx tests/workout-assignment.test.ts
 *
 * Pure-function tests — no DB, no auth. Covers:
 *   - cold-start (no engagement, no recent reps)
 *   - 6-day floor (eligible dim selected)
 *   - oldest-fallback (when no dim is past the floor)
 *   - sharp-regression surfaces early
 *   - sparse engagement falls back to recent reps
 *   - sampleExercises dedupes against last 2 days
 *   - sampleExercises gracefully relaxes when catalog is small
 *   - pickPromptCandidates biases away from recent prompts
 *   - pickPromptCandidates difficulty bias
 */

import {
  selectMuscleGroupForToday,
  sampleExercises,
  pickPromptCandidates,
  detectSharpRegression,
  effectiveCompositeFor,
  isAssessmentActive,
  ASSESSMENT_DAYS,
  type CatalogExercise,
  type CatalogPrompt,
  type EngagementSnapshot,
  type RecentDaySnapshot,
  type RecentRepsSnapshot,
} from "@/server/lib/workout/assignment";
import { MUSCLE_GROUP_IDS, type MuscleGroupId } from "@/types/domain";

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

function emptyEngagement(): EngagementSnapshot[] {
  return MUSCLE_GROUP_IDS.map((d) => ({
    dimension: d,
    recentComposite: null,
    lastTrainedAt: null,
    rowCount: 0,
  }));
}
function emptyRecentReps(): RecentRepsSnapshot[] {
  return MUSCLE_GROUP_IDS.map((d) => ({
    dimension: d,
    avgComposite14d: null,
    avgComposite7d: null,
    avgCompositePrior7d: null,
    count14d: 0,
  }));
}
function daysAgo(today: Date, n: number): string {
  const d = new Date(today.getTime() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
function repsSnap(
  dim: MuscleGroupId,
  patch: Partial<RecentRepsSnapshot>,
  base: RecentRepsSnapshot[],
): RecentRepsSnapshot[] {
  return base.map((r) => (r.dimension === dim ? { ...r, ...patch } : r));
}
function engSnap(
  dim: MuscleGroupId,
  patch: Partial<EngagementSnapshot>,
  base: EngagementSnapshot[],
): EngagementSnapshot[] {
  return base.map((r) => (r.dimension === dim ? { ...r, ...patch } : r));
}

const TODAY = new Date("2026-05-21T12:00:00Z");

// ─── 1. Cold-start ───────────────────────────────────────────────────────
section("cold-start");
{
  const result = selectMuscleGroupForToday({
    today: TODAY,
    engagement: emptyEngagement(),
    recentReps: emptyRecentReps(),
    recentDays: [],
  });
  assert(result.suggested === "clarity", "cold-start suggests clarity");
  assert(
    result.alternates.length === 2,
    "cold-start returns 2 alternates",
  );
  assert(
    result.alternates[0] === "structure" && result.alternates[1] === "conciseness",
    "cold-start alternates are [structure, conciseness]",
  );
  assert(
    result.rationaleCode === "cold_start",
    "cold-start rationale code is cold_start",
  );
  assert(
    result.rationale.length <= 80,
    `cold-start rationale concise (was ${result.rationale.length} chars)`,
  );
}

// ─── 2. 6-day floor — eligible dim selected ──────────────────────────────
section("6-day floor");
{
  // All dims trained recently except `pacing` (8 days ago).
  const recentDays: RecentDaySnapshot[] = MUSCLE_GROUP_IDS.map((dim) => ({
    dayId: `day-${dim}`,
    dimension: dim,
    dayDate:
      dim === "pacing"
        ? daysAgo(TODAY, 8) // past the 6-day floor
        : daysAgo(TODAY, 2), // within floor
    plannedExerciseIds: [],
    compositeAtClose: 70,
  }));
  // Engagement: every dim has a composite. Pacing is mid-pack.
  const engagement = MUSCLE_GROUP_IDS.map((dim) => ({
    dimension: dim,
    recentComposite: 70,
    lastTrainedAt: TODAY.toISOString(),
    rowCount: 5,
  }));

  const result = selectMuscleGroupForToday({
    today: TODAY,
    engagement,
    recentReps: emptyRecentReps(),
    recentDays,
  });
  assert(
    result.suggested === "pacing",
    `6-day floor: only pacing eligible → suggested=pacing (got ${result.suggested})`,
  );
  assert(
    result.rationaleCode === "six_day_floor",
    "6-day floor rationale code",
  );
}

// ─── 3. Oldest fallback (no dim past 6-day floor) ────────────────────────
section("oldest fallback");
{
  // Every dim trained within 5 days. None past floor.
  const recentDays: RecentDaySnapshot[] = MUSCLE_GROUP_IDS.map((dim, i) => ({
    dayId: `day-${dim}`,
    dimension: dim,
    dayDate: daysAgo(TODAY, i), // clarity=0, structure=1, ... tone=5
    plannedExerciseIds: [],
    compositeAtClose: 70,
  }));
  const engagement = MUSCLE_GROUP_IDS.map((dim) => ({
    dimension: dim,
    recentComposite: 70,
    lastTrainedAt: TODAY.toISOString(),
    rowCount: 5,
  }));

  const result = selectMuscleGroupForToday({
    today: TODAY,
    engagement,
    recentReps: emptyRecentReps(),
    recentDays,
  });
  assert(
    result.rationaleCode === "oldest_fallback",
    "oldest_fallback rationale when nothing past floor",
  );
  assert(
    result.suggested === "tone",
    `oldest fallback: tone (trained 5d ago) → got ${result.suggested}`,
  );
}

// ─── 4. Sharp regression surfaces early ──────────────────────────────────
section("sharp regression");
{
  // Tone regressed: 7d avg 60, prior 7d avg 75 → drop of 15.
  let reps = emptyRecentReps();
  reps = repsSnap(
    "tone",
    {
      avgComposite14d: 67,
      avgComposite7d: 60,
      avgCompositePrior7d: 75,
      count14d: 8,
    },
    reps,
  );
  // Clarity has even bigger drop but only 2 reps → not enough signal.
  reps = repsSnap(
    "clarity",
    {
      avgComposite14d: 50,
      avgComposite7d: 30,
      avgCompositePrior7d: 80,
      count14d: 2, // below threshold
    },
    reps,
  );
  // All dims trained within last day so 6-day floor would NOT trigger.
  const recentDays: RecentDaySnapshot[] = MUSCLE_GROUP_IDS.map((dim) => ({
    dayId: `day-${dim}`,
    dimension: dim,
    dayDate: daysAgo(TODAY, 1),
    plannedExerciseIds: [],
    compositeAtClose: 70,
  }));
  const engagement = MUSCLE_GROUP_IDS.map((dim) => ({
    dimension: dim,
    recentComposite: 70,
    lastTrainedAt: TODAY.toISOString(),
    rowCount: 5,
  }));

  const result = selectMuscleGroupForToday({
    today: TODAY,
    engagement,
    recentReps: reps,
    recentDays,
  });
  assert(
    result.rationaleCode === "sharp_regression",
    "sharp_regression takes priority over 6-day floor",
  );
  assert(
    result.suggested === "tone",
    `regression: tone surfaces (got ${result.suggested})`,
  );
  assert(
    result.regressionDrop != null && result.regressionDrop >= 8,
    `regression drop reported (got ${result.regressionDrop})`,
  );
  assert(
    /tone/i.test(result.rationale.toLowerCase()) || result.rationale.includes("Tone"),
    "regression rationale names the dim",
  );
}

// ─── 5. detectSharpRegression edge cases ─────────────────────────────────
section("detectSharpRegression");
{
  assert(
    detectSharpRegression({
      dimension: "tone",
      avgComposite14d: null,
      avgComposite7d: null,
      avgCompositePrior7d: null,
      count14d: 0,
    }) === null,
    "no data → no regression",
  );
  assert(
    detectSharpRegression({
      dimension: "tone",
      avgComposite14d: 65,
      avgComposite7d: 60,
      avgCompositePrior7d: 65,
      count14d: 8,
    }) === null,
    "5-pt drop below threshold → no regression",
  );
  const hit = detectSharpRegression({
    dimension: "tone",
    avgComposite14d: 65,
    avgComposite7d: 55,
    avgCompositePrior7d: 75,
    count14d: 8,
  });
  assert(hit?.drop === 20, `20-pt drop detected (got ${hit?.drop})`);
  assert(
    detectSharpRegression({
      dimension: "tone",
      avgComposite14d: 60,
      avgComposite7d: 50,
      avgCompositePrior7d: 75,
      count14d: 2,
    }) === null,
    "count below threshold → no regression",
  );
}

// ─── 6. effectiveCompositeFor / sparse engagement fallback ───────────────
section("effectiveCompositeFor");
{
  const base = emptyEngagement();
  const recentReps = emptyRecentReps();
  // Pacing has 1 engagement row only (below sparse threshold of 3).
  const eng = engSnap(
    "pacing",
    { recentComposite: 90, rowCount: 1 },
    base,
  );
  // Recent reps backfill says Pacing is actually at 50.
  const reps = repsSnap(
    "pacing",
    {
      avgComposite14d: 50,
      avgComposite7d: 50,
      avgCompositePrior7d: 50,
      count14d: 4,
    },
    recentReps,
  );
  const effective = effectiveCompositeFor("pacing", eng, reps);
  assert(
    effective === 50,
    `sparse engagement → falls back to reps (got ${effective})`,
  );
  // Now bump engagement to 5 rows; should use engagement directly.
  const engFull = engSnap(
    "pacing",
    { recentComposite: 90, rowCount: 5 },
    base,
  );
  const eff2 = effectiveCompositeFor("pacing", engFull, reps);
  assert(
    eff2 === 90,
    `sufficient engagement → uses engagement (got ${eff2})`,
  );
}

// ─── 7. Weakest-recent ranking ───────────────────────────────────────────
section("weakest-recent ranking");
{
  // All dims trained ≥6 days ago. Engagement: clarity=80, structure=60,
  // conciseness=65, thinking_quality=85, pacing=null (untrained), tone=75.
  const composites: Record<MuscleGroupId, number | null> = {
    clarity: 80,
    structure: 60,
    conciseness: 65,
    thinking_quality: 85,
    pacing: null,
    tone: 75,
  };
  const recentDays: RecentDaySnapshot[] = MUSCLE_GROUP_IDS.filter(
    (d) => d !== "pacing",
  ).map((dim) => ({
    dayId: `day-${dim}`,
    dimension: dim,
    dayDate: daysAgo(TODAY, 8),
    plannedExerciseIds: [],
    compositeAtClose: composites[dim] ?? 70,
  }));
  const engagement = MUSCLE_GROUP_IDS.map((dim) => ({
    dimension: dim,
    recentComposite: composites[dim],
    lastTrainedAt: composites[dim] == null ? null : TODAY.toISOString(),
    rowCount: composites[dim] == null ? 0 : 5,
  }));

  const result = selectMuscleGroupForToday({
    today: TODAY,
    engagement,
    recentReps: emptyRecentReps(),
    recentDays,
  });
  // pacing is untrained → highest priority.
  assert(
    result.suggested === "pacing",
    `untrained dim takes priority → pacing (got ${result.suggested})`,
  );
  // Suggested dim was last trained ≥6 days ago → six_day_floor framing wins.
  assert(
    result.rationaleCode === "six_day_floor" ||
      result.rationaleCode === "weakest_recent",
    `rationale either six_day_floor or weakest_recent (got ${result.rationaleCode})`,
  );
}

// ─── 8. sampleExercises dedupes against last 2 days ──────────────────────
section("sampleExercises dedupe");
{
  const dim: MuscleGroupId = "clarity";
  const available: CatalogExercise[] = Array.from({ length: 9 }, (_, i) => ({
    id: `ex-${i + 1}`,
    slug: `ex-${i + 1}`,
    name: `Exercise ${i + 1}`,
    dimension: dim,
    description: "rule",
    instructions: null,
    sortOrder: i + 1,
    objective: null,
    hiddenSkills: null,
    responseWindow: null,
  constraintTypes: null,
  }));
  // Last 2 days used ex-1, ex-2, ex-3, ex-4 (the first 4).
  const recentDays: RecentDaySnapshot[] = [
    {
      dayId: "d1",
      dimension: dim,
      dayDate: daysAgo(TODAY, 6),
      plannedExerciseIds: ["ex-1", "ex-2", "ex-3", "ex-4"],
      compositeAtClose: 70,
    },
    {
      dayId: "d2",
      dimension: dim,
      dayDate: daysAgo(TODAY, 12),
      plannedExerciseIds: ["ex-3", "ex-4"],
      compositeAtClose: 70,
    },
  ];
  const sampled = sampleExercises({
    available,
    recentDays,
    n: 4,
    seed: "deterministic-seed",
  });
  const sampledIds = new Set(sampled.map((e) => e.id));
  assert(sampled.length === 4, "sampleExercises returns 4");
  assert(
    !sampledIds.has("ex-1") &&
      !sampledIds.has("ex-2") &&
      !sampledIds.has("ex-3") &&
      !sampledIds.has("ex-4"),
    "sampleExercises dedupes against last-2-days IDs",
  );
}

// ─── 9. sampleExercises relaxes when catalog is small ────────────────────
section("sampleExercises small catalog");
{
  const dim: MuscleGroupId = "clarity";
  const available: CatalogExercise[] = Array.from({ length: 5 }, (_, i) => ({
    id: `ex-${i + 1}`,
    slug: `ex-${i + 1}`,
    name: `Exercise ${i + 1}`,
    dimension: dim,
    description: "rule",
    instructions: null,
    sortOrder: i + 1,
    objective: null,
    hiddenSkills: null,
    responseWindow: null,
  constraintTypes: null,
  }));
  const recentDays: RecentDaySnapshot[] = [
    {
      dayId: "d1",
      dimension: dim,
      dayDate: daysAgo(TODAY, 1),
      plannedExerciseIds: ["ex-1", "ex-2", "ex-3"],
      compositeAtClose: 70,
    },
  ];
  // After dedupe only ex-4, ex-5 remain (2 — less than n=4). Should relax
  // and use the full pool.
  const sampled = sampleExercises({
    available,
    recentDays,
    n: 4,
    seed: "seed",
  });
  assert(
    sampled.length === 4,
    `relaxes dedupe when catalog too small (got ${sampled.length})`,
  );
}

// ─── 10. pickPromptCandidates biases away from recent prompts ─────────────
section("pickPromptCandidates bias");
{
  const bank: CatalogPrompt[] = Array.from({ length: 15 }, (_, i) => ({
    id: `p-${i + 1}`,
    promptId: `pid-${i + 1}`,
    text: `prompt ${i + 1}`,
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    tags: [],
  }));
  const recentIds = ["pid-1", "pid-2", "pid-3", "pid-4", "pid-5"];
  const picked = pickPromptCandidates({
    available: bank,
    recentPromptIds: recentIds,
    k: 5,
    seed: "seed",
  });
  assert(picked.length === 5, "pickPromptCandidates returns k=5");
  const pickedIds = picked.map((p) => p.promptId);
  const recentInPicked = pickedIds.filter((id) => recentIds.includes(id));
  assert(
    recentInPicked.length === 0,
    `biased away from recent (got ${recentInPicked.length} recent in pick)`,
  );
}

// ─── 11. pickPromptCandidates preferEasier sort ──────────────────────────
section("pickPromptCandidates preferEasier");
{
  const bank: CatalogPrompt[] = [
    { id: "a", promptId: "a", text: "easy", difficulty: 1, tags: [] },
    { id: "b", promptId: "b", text: "hard", difficulty: 3, tags: [] },
    { id: "c", promptId: "c", text: "mid", difficulty: 2, tags: [] },
  ];
  const picked = pickPromptCandidates({
    available: bank,
    recentPromptIds: [],
    k: 3,
    seed: "seed",
    preferEasier: true,
  });
  assert(
    picked[0]!.difficulty === 1 &&
      picked[1]!.difficulty === 2 &&
      picked[2]!.difficulty === 3,
    "preferEasier sorts ascending by difficulty",
  );
}

// ─── 13. PRD v3 Phase 2.4 — Assessment Phase rotation ────────────────────
section("assessment phase");
{
  const mkDay = (i: number, dim: MuscleGroupId): RecentDaySnapshot => ({
    dayId: `d${i}`,
    dimension: dim,
    dayDate: daysAgo(TODAY, i + 1),
    plannedExerciseIds: [`e${i}`],
    compositeAtClose: 70,
  });

  // Brand-new user: assessment picks clarity (canonical first).
  const fresh = selectMuscleGroupForToday({
    today: TODAY,
    engagement: emptyEngagement(),
    recentReps: emptyRecentReps(),
    recentDays: [],
    assessmentEnabled: true,
  });
  assert(fresh.rationaleCode === "assessment", "new user → assessment");
  assert(fresh.suggested === "clarity", "assessment day 1 = clarity");

  // After clarity + structure: next least-covered = conciseness.
  const twoDays = [mkDay(0, "structure"), mkDay(1, "clarity")];
  const third = selectMuscleGroupForToday({
    today: TODAY,
    engagement: emptyEngagement(),
    recentReps: emptyRecentReps(),
    recentDays: twoDays,
    assessmentEnabled: true,
  });
  assert(third.suggested === "conciseness", "assessment covers uncovered dims in canonical order");

  // A full first cycle → second cycle starts at clarity again.
  const oneCycle = MUSCLE_GROUP_IDS.map((d, i) => mkDay(i, d));
  const seventh = selectMuscleGroupForToday({
    today: TODAY,
    engagement: emptyEngagement(),
    recentReps: emptyRecentReps(),
    recentDays: oneCycle,
    assessmentEnabled: true,
  });
  assert(
    seventh.rationaleCode === "assessment" && seventh.suggested === "clarity",
    "cycle 2 restarts at clarity",
  );

  // After ASSESSMENT_DAYS days, adaptive rotation takes over.
  const done = Array.from({ length: ASSESSMENT_DAYS }, (_, i) =>
    mkDay(i, MUSCLE_GROUP_IDS[i % 6]!),
  );
  const adaptive = selectMuscleGroupForToday({
    today: TODAY,
    engagement: emptyEngagement(),
    recentReps: emptyRecentReps(),
    recentDays: done,
    assessmentEnabled: true,
  });
  assert(
    adaptive.rationaleCode !== "assessment",
    "assessment ends after ASSESSMENT_DAYS attempted days",
  );
  assert(!isAssessmentActive(done), "isAssessmentActive false after window");
  assert(isAssessmentActive(oneCycle), "isAssessmentActive true mid-window");

  // Flag off → legacy cold-start unchanged.
  const legacy = selectMuscleGroupForToday({
    today: TODAY,
    engagement: emptyEngagement(),
    recentReps: emptyRecentReps(),
    recentDays: [],
  });
  assert(legacy.rationaleCode === "cold_start", "flag off keeps cold_start");
}

// ─── 12. PRD v3 Phase 2.3 — Hidden-Skill-aware sampling ─────────────────
section("sampleExercises hidden-skill weighting");
{
  const dim: MuscleGroupId = "clarity";
  const mk = (
    i: number,
    hiddenSkills: string[] | null,
  ): CatalogExercise => ({
    id: `ex-${i}`,
    slug: `ex-${i}`,
    name: `Exercise ${i}`,
    dimension: dim,
    description: "rule",
    instructions: null,
    sortOrder: i,
    objective: null,
    hiddenSkills,
    responseWindow: null,
  constraintTypes: null,
  });
  const available = [
    mk(1, ["word_choice"]),
    mk(2, ["word_choice", "precision"]),
    mk(3, ["concreteness"]),
    mk(4, ["audience_awareness"]),
    mk(5, ["idea_isolation"]),
    mk(6, ["precision"]),
  ];

  // Weakest skill = audience_awareness (30). Its exercise must be picked.
  const averages: Record<string, number | null> = {
    word_choice: 80,
    precision: 75,
    concreteness: 70,
    audience_awareness: 30,
    idea_isolation: 65,
    logical_sequencing: null,
  };
  const picked = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "s1",
    subSkillAverages: averages,
  });
  assert(picked.length === 3, "returns n exercises");
  assert(
    picked.some((e) => e.hiddenSkills?.includes("audience_awareness")),
    "weakest hidden skill's exercise is selected",
  );
  // Diversity: the three picks should not all share one hidden skill.
  const skillLists = picked.map((e) => e.hiddenSkills ?? []);
  const allShareWordChoice = skillLists.every((l) => l.includes("word_choice"));
  assert(!allShareWordChoice, "picks spread across different hidden skills");

  // Determinism: same inputs → same output.
  const again = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "s1",
    subSkillAverages: averages,
  });
  assert(
    JSON.stringify(picked.map((e) => e.id)) ===
      JSON.stringify(again.map((e) => e.id)),
    "hidden-skill-aware pick is deterministic",
  );

  // Legacy path: omitting subSkillAverages = pure seeded shuffle.
  const legacy = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "s1",
  });
  assert(legacy.length === 3, "legacy path still returns n");

  // Unmeasured skills (null avg) beat strong measured skills — the
  // engine explores unmeasured behaviors before re-drilling strengths.
  const unmeasured = sampleExercises({
    available: [mk(1, ["word_choice"]), mk(2, ["logical_sequencing"])],
    recentDays: [],
    n: 1,
    seed: "s2",
    subSkillAverages: { word_choice: 85, logical_sequencing: null },
  });
  assert(
    unmeasured[0]!.hiddenSkills?.includes("logical_sequencing"),
    "unmeasured hidden skill preferred over a strong one",
  );
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all assignment tests pass`);
