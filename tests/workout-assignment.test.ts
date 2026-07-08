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
  adaptResponseWindow,
  ASSESSMENT_DAYS,
  PROFILE_FALLBACK_WEIGHT,
  WINDOW_TIGHTEN_DIM_ESTIMATE,
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
    coachInsight: null,
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
    coachInsight: null,
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
    coachInsight: null,
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

// ─── 14. I3 — Communication Profile fallback ─────────────────────────────
section("profile fallback (I3)");
{
  const noEng = emptyEngagement();
  const noReps = emptyRecentReps();
  const profile: Partial<Record<MuscleGroupId, number>> = {
    pacing: 40,
    tone: 80,
  };

  // Zero window signal → plain profile estimate.
  const plain = effectiveCompositeFor("pacing", noEng, noReps, profile);
  assert(plain === 40, `empty windows → profile score (got ${plain})`);

  // Thin window (count < sparse threshold, but avg exists) → 0.7/0.3 blend.
  const thinReps = repsSnap(
    "pacing",
    { avgComposite14d: 60, avgComposite7d: 60, count14d: 2 },
    noReps,
  );
  const blended = effectiveCompositeFor("pacing", noEng, thinReps, profile);
  const expected =
    PROFILE_FALLBACK_WEIGHT * 40 + (1 - PROFILE_FALLBACK_WEIGHT) * 60;
  assert(
    blended != null && Math.abs(blended - expected) < 1e-9,
    `sparse window blends 0.7 profile / 0.3 window (got ${blended}, want ${expected})`,
  );

  // Ample engagement (rowCount ≥ 3) still wins outright — profile ignored.
  const engFull = engSnap(
    "pacing",
    { recentComposite: 90, rowCount: 5 },
    noEng,
  );
  assert(
    effectiveCompositeFor("pacing", engFull, noReps, profile) === 90,
    "ample engagement ignores the profile",
  );

  // Dim absent from the profile → legacy null (nothing invented).
  assert(
    effectiveCompositeFor("clarity", noEng, noReps, profile) === null,
    "no profile entry for dim → null",
  );

  // Omitting the fallback entirely → byte-identical legacy behavior.
  assert(
    effectiveCompositeFor("pacing", noEng, thinReps) === 60,
    "no profileFallback arg → legacy window value",
  );

  // Integration: user back from a 2-week break. Engagement rows persist
  // (rowCount 1 = sparse), 14d rep windows are empty, all dims past the
  // floor. Without the profile every dim looks untrained (null) and the
  // ranking is arbitrary; with it, the profile's weakest dim wins.
  const postBreakEngagement: EngagementSnapshot[] = MUSCLE_GROUP_IDS.map(
    (dim) => ({
      dimension: dim,
      recentComposite: null,
      lastTrainedAt: null,
      rowCount: 1,
    }),
  );
  const postBreakDays: RecentDaySnapshot[] = MUSCLE_GROUP_IDS.map(
    (dim, i) => ({
      dayId: `day-${dim}`,
      dimension: dim,
      dayDate: daysAgo(TODAY, 15 + i),
      plannedExerciseIds: [],
      compositeAtClose: 65,
    }),
  );
  const fullProfile: Partial<Record<MuscleGroupId, number>> = {
    clarity: 70,
    structure: 65,
    conciseness: 75,
    thinking_quality: 72,
    pacing: 40,
    tone: 80,
  };
  const postBreak = selectMuscleGroupForToday({
    today: TODAY,
    engagement: postBreakEngagement,
    recentReps: emptyRecentReps(),
    recentDays: postBreakDays,
    profileFallback: fullProfile,
  });
  assert(
    postBreak.suggested === "pacing",
    `post-break: profile's weakest dim suggested (got ${postBreak.suggested})`,
  );
}

// ─── 15. I4 — plateau inverts hidden-skill weighting ─────────────────────
section("plateau stimulus inversion (I4)");
{
  const dim: MuscleGroupId = "clarity";
  const mk = (i: number, hiddenSkills: string[] | null): CatalogExercise => ({
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
    coachInsight: null,
  });
  const available = [
    mk(1, ["word_choice"]), // weak measured (30) — normal mode's pick
    mk(2, ["precision"]), // strong measured (85) — least-drilled
    mk(3, ["logical_sequencing"]), // never measured
  ];
  const averages: Record<string, number | null> = {
    word_choice: 30,
    precision: 85,
    logical_sequencing: null,
  };

  // Normal weighting drills the weakest measured skill.
  const normal = sampleExercises({
    available,
    recentDays: [],
    n: 1,
    seed: "plateau-seed",
    subSkillAverages: averages,
  });
  assert(
    normal[0]!.hiddenSkills?.includes("word_choice") === true,
    `normal mode picks the weakest skill (got ${normal[0]!.id})`,
  );

  // Plateaued: inversion — unmeasured first, then the least-trained
  // (strongest measured), and the already-drilled weak skill LAST.
  const inverted = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "plateau-seed",
    subSkillAverages: averages,
    plateaued: true,
  });
  assert(
    inverted[0]!.hiddenSkills?.includes("logical_sequencing") === true,
    `plateau prefers the unmeasured sub-skill first (got ${inverted[0]!.id})`,
  );
  assert(
    inverted[1]!.hiddenSkills?.includes("precision") === true,
    `plateau then prefers the least-drilled measured skill (got ${inverted[1]!.id})`,
  );
  assert(
    inverted[2]!.hiddenSkills?.includes("word_choice") === true,
    "the over-drilled weak skill drops to last — the stimulus changed",
  );

  // The plateau pick genuinely differs from the normal pick.
  assert(
    inverted[0]!.id !== normal[0]!.id,
    "plateaued day is not byte-identical to a normal day",
  );

  // Deterministic under the same seed.
  const again = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "plateau-seed",
    subSkillAverages: averages,
    plateaued: true,
  });
  assert(
    JSON.stringify(inverted.map((e) => e.id)) ===
      JSON.stringify(again.map((e) => e.id)),
    "inverted pick is deterministic",
  );

  // plateaued: false (or omitted) keeps the weakness-first ordering.
  const explicitFalse = sampleExercises({
    available,
    recentDays: [],
    n: 1,
    seed: "plateau-seed",
    subSkillAverages: averages,
    plateaued: false,
  });
  assert(
    explicitFalse[0]!.id === normal[0]!.id,
    "plateaued=false is byte-identical to the legacy weighting",
  );
}

// ─── 16. I6 — Assessment Phase prefers never-seen exercises ──────────────
section("assessment prefers unseen exercises (I6)");
{
  const dim: MuscleGroupId = "clarity";
  const mk = (i: number): CatalogExercise => ({
    id: `ex-${i}`,
    slug: `ex-${i}`,
    name: `Exercise ${i}`,
    dimension: dim,
    description: "rule",
    instructions: null,
    sortOrder: i,
    objective: null,
    hiddenSkills: null,
    responseWindow: null,
    constraintTypes: null,
    coachInsight: null,
  });
  const available = Array.from({ length: 9 }, (_, i) => mk(i + 1));
  // 6 of 9 completed → ex-7, ex-8, ex-9 are the only unseen ones.
  const completed = new Set([
    "ex-1",
    "ex-2",
    "ex-3",
    "ex-4",
    "ex-5",
    "ex-6",
  ]);

  const sampled = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "assessment-seed",
    assessmentActive: true,
    completedExerciseIds: completed,
  });
  const ids = new Set(sampled.map((e) => e.id));
  assert(sampled.length === 3, "assessment sample returns n");
  assert(
    ids.has("ex-7") && ids.has("ex-8") && ids.has("ex-9"),
    `assessment samples ALL unseen exercises first (got ${[...ids].join(",")})`,
  );

  // Fewer unseen than n → unseen first, then fill from seen.
  const bigger = sampleExercises({
    available,
    recentDays: [],
    n: 4,
    seed: "assessment-seed",
    assessmentActive: true,
    completedExerciseIds: completed,
  });
  assert(bigger.length === 4, "assessment fill returns n");
  const unseenFirst3 = bigger
    .slice(0, 3)
    .every((e) => !completed.has(e.id));
  assert(
    unseenFirst3 && completed.has(bigger[3]!.id),
    "unseen fill first, then seen tops up the sample",
  );

  // Deterministic under the same seed.
  const again = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "assessment-seed",
    assessmentActive: true,
    completedExerciseIds: completed,
  });
  assert(
    JSON.stringify(sampled.map((e) => e.id)) ===
      JSON.stringify(again.map((e) => e.id)),
    "assessment-preferred sample is deterministic",
  );

  // assessmentActive absent → legacy behavior (completed set ignored).
  const legacy = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "assessment-seed",
  });
  const withSetButInactive = sampleExercises({
    available,
    recentDays: [],
    n: 3,
    seed: "assessment-seed",
    completedExerciseIds: completed,
  });
  assert(
    JSON.stringify(legacy.map((e) => e.id)) ===
      JSON.stringify(withSetButInactive.map((e) => e.id)),
    "completedExerciseIds without assessmentActive is byte-identical to legacy",
  );

  // Hidden-skill weighting still applies WITHIN the unseen partition.
  const skillAvailable = [
    { ...mk(1), hiddenSkills: ["word_choice"] },
    { ...mk(2), hiddenSkills: ["precision"] },
    { ...mk(3), hiddenSkills: ["audience_awareness"] }, // weakest, unseen
    { ...mk(4), hiddenSkills: ["concreteness"] }, // unseen
  ];
  const skillPick = sampleExercises({
    available: skillAvailable,
    recentDays: [],
    n: 1,
    seed: "assessment-skill-seed",
    assessmentActive: true,
    completedExerciseIds: new Set(["ex-1", "ex-2"]),
    subSkillAverages: {
      word_choice: 20, // weakest overall — but SEEN, so excluded first
      precision: 30,
      audience_awareness: 40,
      concreteness: 90,
    },
  });
  assert(
    skillPick[0]!.id === "ex-3",
    `hidden-skill weighting applies within the unseen partition (got ${skillPick[0]!.id})`,
  );
}

// ─── 17. G5 — slate-time topic diversity ─────────────────────────────────
section("prompt slate tag diversity (G5)");
{
  // Bank of 10: 5 share one tag, 5 varied. Same difficulty so the
  // diversity pass can always swap without touching the difficulty
  // profile of the slate.
  const bank: CatalogPrompt[] = [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `shared-${i + 1}`,
      promptId: `shared-${i + 1}`,
      text: `shared ${i + 1}`,
      difficulty: 2 as const,
      tags: ["career"],
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `varied-${i + 1}`,
      promptId: `varied-${i + 1}`,
      text: `varied ${i + 1}`,
      difficulty: 2 as const,
      tags: [`topic-${i + 1}`],
    })),
  ];

  // Across several seeds, every slate must land ≥3 distinct tags.
  for (const seed of ["g5-a", "g5-b", "g5-c", "g5-d"]) {
    const slate = pickPromptCandidates({
      available: bank,
      recentPromptIds: [],
      k: 5,
      seed,
    });
    const tags = new Set(slate.flatMap((p) => p.tags));
    assert(slate.length === 5, `G5 slate size 5 (seed ${seed})`);
    assert(
      tags.size >= 3,
      `G5 slate carries ≥3 distinct tags (seed ${seed}, got ${tags.size}: ${[...tags].join(",")})`,
    );
  }

  // Deterministic under the same seed.
  const a = pickPromptCandidates({
    available: bank,
    recentPromptIds: [],
    k: 5,
    seed: "g5-det",
  });
  const b = pickPromptCandidates({
    available: bank,
    recentPromptIds: [],
    k: 5,
    seed: "g5-det",
  });
  assert(
    JSON.stringify(a.map((p) => p.promptId)) ===
      JSON.stringify(b.map((p) => p.promptId)),
    "G5 diversity pass is deterministic under the same seed",
  );

  // Ordering contract preserved: fresh prompts are never displaced by
  // used ones. 5 fresh varied + 5 used shared → slate stays all-fresh.
  const slateFreshGuard = pickPromptCandidates({
    available: bank,
    recentPromptIds: [
      "shared-1",
      "shared-2",
      "shared-3",
      "shared-4",
      "shared-5",
    ],
    k: 5,
    seed: "g5-fresh",
  });
  assert(
    slateFreshGuard.every((p) => p.promptId.startsWith("varied-")),
    "G5 never swaps a used prompt over a fresh one",
  );

  // Difficulty profile preserved under preferEasier: mixed-difficulty
  // bank keeps ascending order after the diversity pass.
  const mixedBank: CatalogPrompt[] = [
    { id: "e1", promptId: "e1", text: "e1", difficulty: 1, tags: ["t1"] },
    { id: "e2", promptId: "e2", text: "e2", difficulty: 1, tags: ["t1"] },
    { id: "e3", promptId: "e3", text: "e3", difficulty: 1, tags: ["t9"] },
    { id: "m1", promptId: "m1", text: "m1", difficulty: 2, tags: ["t1"] },
    { id: "m2", promptId: "m2", text: "m2", difficulty: 2, tags: ["t2"] },
    { id: "h1", promptId: "h1", text: "h1", difficulty: 3, tags: ["t3"] },
  ];
  const easier = pickPromptCandidates({
    available: mixedBank,
    recentPromptIds: [],
    k: 5,
    seed: "g5-mixed",
    preferEasier: true,
  });
  const difficulties = easier.map((p) => p.difficulty);
  const sortedAsc = [...difficulties].sort((x, y) => x - y);
  assert(
    JSON.stringify(difficulties) === JSON.stringify(sortedAsc),
    `G5 preserves the preferEasier ascending difficulty profile (got ${difficulties.join(",")})`,
  );
}

// ─── I-7. adaptResponseWindow — adaptive time pressure ───────────────────
section("adaptResponseWindow (I-7)");
{
  const noSignals = { dimEstimate: null, confidenceBuilder: false };

  // Null window passes through untouched.
  const nullWin = adaptResponseWindow(null, {
    dimEstimate: 95,
    confidenceBuilder: true,
  });
  assert(
    nullWin.window === null && nullWin.adjusted === null,
    "null window → null window, adjusted null",
  );

  // No signals → unchanged, same object semantics.
  const plain = adaptResponseWindow({ minSec: 60, maxSec: 90 }, noSignals);
  assert(
    plain.window?.minSec === 60 &&
      plain.window?.maxSec === 90 &&
      plain.adjusted === null,
    "no signals → window unchanged, adjusted null",
  );

  // Tighten: dimEstimate exactly at the 80 boundary fires; 15% off,
  // rounded to 5s (60→51→50, 90→76.5→75).
  const tightened = adaptResponseWindow(
    { minSec: 60, maxSec: 90 },
    { dimEstimate: WINDOW_TIGHTEN_DIM_ESTIMATE, confidenceBuilder: false },
  );
  assert(
    tightened.window?.minSec === 50 &&
      tightened.window?.maxSec === 75 &&
      tightened.adjusted === "tightened",
    `dimEstimate=80 tightens 60–90 → 50–75 (got ${tightened.window?.minSec}–${tightened.window?.maxSec}, ${tightened.adjusted})`,
  );

  // Just under the boundary → unchanged.
  const under = adaptResponseWindow(
    { minSec: 60, maxSec: 90 },
    { dimEstimate: 79.9, confidenceBuilder: false },
  );
  assert(
    under.window?.minSec === 60 &&
      under.window?.maxSec === 90 &&
      under.adjusted === null,
    "dimEstimate=79.9 leaves the window unchanged",
  );

  // Rounding to nearest 5s: 62→52.7→55, 88→74.8→75.
  const rounded = adaptResponseWindow(
    { minSec: 62, maxSec: 88 },
    { dimEstimate: 85, confidenceBuilder: false },
  );
  assert(
    rounded.window?.minSec === 55 && rounded.window?.maxSec === 75,
    `tighten rounds to 5s: 62–88 → 55–75 (got ${rounded.window?.minSec}–${rounded.window?.maxSec})`,
  );

  // Min floor at 15s: 16→13.6→15(floored), 40→34→35.
  const floored = adaptResponseWindow(
    { minSec: 16, maxSec: 40 },
    { dimEstimate: 90, confidenceBuilder: false },
  );
  assert(
    floored.window?.minSec === 15 &&
      floored.window?.maxSec === 35 &&
      floored.adjusted === "tightened",
    `tighten floors min at 15s: 16–40 → 15–35 (got ${floored.window?.minSec}–${floored.window?.maxSec})`,
  );

  // Degenerate tiny window rounds back onto itself → adjusted stays null
  // (the UI must never claim an adjustment that didn't happen).
  const noop = adaptResponseWindow(
    { minSec: 15, maxSec: 15 },
    { dimEstimate: 90, confidenceBuilder: false },
  );
  assert(
    noop.window?.minSec === 15 &&
      noop.window?.maxSec === 15 &&
      noop.adjusted === null,
    "tighten that changes nothing reports adjusted=null",
  );

  // Max never tightens below min: 15–20 → min 15 (floor), max 17→15.
  const clamped = adaptResponseWindow(
    { minSec: 15, maxSec: 20 },
    { dimEstimate: 90, confidenceBuilder: false },
  );
  assert(
    clamped.window?.minSec === 15 &&
      clamped.window?.maxSec === 15 &&
      clamped.adjusted === "tightened",
    `tighten clamps max ≥ min: 15–20 → 15–15 (got ${clamped.window?.minSec}–${clamped.window?.maxSec}, ${clamped.adjusted})`,
  );

  // Loosen: confidence-builder day, 15% up (60→69→70, 90→103.5→105).
  const loosened = adaptResponseWindow(
    { minSec: 60, maxSec: 90 },
    { dimEstimate: null, confidenceBuilder: true },
  );
  assert(
    loosened.window?.minSec === 70 &&
      loosened.window?.maxSec === 105 &&
      loosened.adjusted === "loosened",
    `confidence builder loosens 60–90 → 70–105 (got ${loosened.window?.minSec}–${loosened.window?.maxSec}, ${loosened.adjusted})`,
  );

  // Loosen caps max at 300s: 230→264.5→265, 270→310.5→310→300.
  const capped = adaptResponseWindow(
    { minSec: 230, maxSec: 270 },
    { dimEstimate: null, confidenceBuilder: true },
  );
  assert(
    capped.window?.minSec === 265 &&
      capped.window?.maxSec === 300 &&
      capped.adjusted === "loosened",
    `loosen caps max at 300: 230–270 → 265–300 (got ${capped.window?.minSec}–${capped.window?.maxSec})`,
  );

  // Already at the cap → nothing changes → adjusted null.
  const atCap = adaptResponseWindow(
    { minSec: 300, maxSec: 300 },
    { dimEstimate: null, confidenceBuilder: true },
  );
  assert(
    atCap.window?.minSec === 300 &&
      atCap.window?.maxSec === 300 &&
      atCap.adjusted === null,
    "loosen at the 300s cap reports adjusted=null",
  );

  // Precedence: both signals set → confidenceBuilder WINS (loosen).
  const both = adaptResponseWindow(
    { minSec: 60, maxSec: 90 },
    { dimEstimate: 95, confidenceBuilder: true },
  );
  assert(
    both.adjusted === "loosened" &&
      both.window?.minSec === 70 &&
      both.window?.maxSec === 105,
    "confidenceBuilder wins over dimEstimate≥80 (loosened)",
  );

  // Deterministic: identical inputs → identical outputs.
  const a = adaptResponseWindow(
    { minSec: 45, maxSec: 75 },
    { dimEstimate: 88, confidenceBuilder: false },
  );
  const b = adaptResponseWindow(
    { minSec: 45, maxSec: 75 },
    { dimEstimate: 88, confidenceBuilder: false },
  );
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "adaptResponseWindow is deterministic",
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
