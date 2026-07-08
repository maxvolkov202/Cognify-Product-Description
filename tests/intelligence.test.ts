/**
 * PRD v3 Phase 7 — intelligence deepening tests.
 *
 *   • 7.2 confidence builder: fires after two rough days, leans on a
 *     genuinely strong dim, never fires without evidence
 *   • 7.3 multi-session planning: projects future picks, respects floors
 *   • 7.1 coaching-effectiveness line in the memory block
 *   • 7.4 stage benchmark notes
 *
 * Run: npx tsx tests/intelligence.test.ts
 */

import {
  selectMuscleGroupForToday,
  planUpcomingDims,
  CONFIDENCE_LOW_THRESHOLD,
  type SelectInput,
  type RecentDaySnapshot,
} from "@/server/lib/workout/assignment";
import { renderCoachingMemoryBlock } from "@/lib/profile/snapshot";
import type { CommunicationSnapshot } from "@/lib/profile/snapshot";
import { benchmarkNote } from "@/lib/profile/stage-benchmarks";
import { MUSCLE_GROUP_IDS, type MuscleGroupId } from "@/types/domain";

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

const TODAY = new Date("2026-07-06T12:00:00Z");

function day(
  dim: MuscleGroupId,
  daysAgo: number,
  composite: number | null,
): RecentDaySnapshot {
  const d = new Date(TODAY.getTime() - daysAgo * 86_400_000);
  return {
    dayId: `d-${dim}-${daysAgo}`,
    dimension: dim,
    dayDate: d.toISOString().slice(0, 10),
    plannedExerciseIds: [],
    compositeAtClose: composite,
  };
}

/** Engagement snapshot with a chosen composite per dim. */
function engagementWith(
  composites: Partial<Record<MuscleGroupId, number>>,
): SelectInput["engagement"] {
  return MUSCLE_GROUP_IDS.map((dim) => ({
    dimension: dim,
    recentComposite: composites[dim] ?? null,
    lastTrainedAt: null,
    rowCount: composites[dim] != null ? 5 : 0,
  }));
}

const NO_REPS: SelectInput["recentReps"] = MUSCLE_GROUP_IDS.map((dim) => ({
  dimension: dim,
  avgComposite14d: null,
  avgComposite7d: null,
  avgCompositePrior7d: null,
  count14d: 0,
}));

section("confidence builder (7.2)");
{
  const base: SelectInput = {
    today: TODAY,
    engagement: engagementWith({
      clarity: 48,
      structure: 50,
      tone: 78, // clearly strong — something to lean on
    }),
    recentReps: NO_REPS,
    recentDays: [
      day("clarity", 1, 45),
      day("structure", 2, 50),
      // enough history to be out of assessment
      ...Array.from({ length: 12 }, (_, i) =>
        day(MUSCLE_GROUP_IDS[i % 6]!, i + 3, 60),
      ),
    ],
    confidenceBoostEnabled: true,
  };
  const r = selectMuscleGroupForToday(base);
  assert(
    r.rationaleCode === "confidence_builder",
    `two rough days → confidence builder (got ${r.rationaleCode})`,
  );
  assert(r.suggested === "tone", `leans on the strongest dim (got ${r.suggested})`);

  const offFlag = selectMuscleGroupForToday({
    ...base,
    confidenceBoostEnabled: false,
  });
  assert(
    offFlag.rationaleCode !== "confidence_builder",
    "flag off → legacy behavior",
  );

  const oneRoughDay = selectMuscleGroupForToday({
    ...base,
    recentDays: [
      day("clarity", 1, 45),
      day("structure", 2, 70),
      ...base.recentDays.slice(2),
    ],
  });
  assert(
    oneRoughDay.rationaleCode !== "confidence_builder",
    "one rough day is not enough",
  );

  const nothingStrong = selectMuscleGroupForToday({
    ...base,
    engagement: engagementWith({ clarity: 48, structure: 50, tone: 52 }),
  });
  assert(
    nothingStrong.rationaleCode !== "confidence_builder",
    "no genuinely strong dim → no confidence day",
  );
  assert(CONFIDENCE_LOW_THRESHOLD === 55, "threshold pinned (doc contract)");
}

section("multi-session planning (7.3)");
{
  const input: SelectInput = {
    today: TODAY,
    engagement: engagementWith({
      clarity: 55,
      structure: 60,
      conciseness: 65,
      thinking_quality: 70,
      pacing: 72,
      tone: 75,
    }),
    recentReps: NO_REPS,
    recentDays: Array.from({ length: 13 }, (_, i) =>
      day(MUSCLE_GROUP_IDS[i % 6]!, i + 1, 62),
    ),
    weightedRotationEnabled: true,
  };
  const upcoming = planUpcomingDims(input, "clarity", 2);
  assert(upcoming.length === 2, "projects exactly 2 days");
  assert(
    upcoming[0] !== "clarity",
    "day+1 never repeats today's pick (floor honored)",
  );
  const again = planUpcomingDims(input, "clarity", 2);
  assert(
    JSON.stringify(upcoming) === JSON.stringify(again),
    "deterministic projection",
  );
}

section("coaching effectiveness line (7.1)");
{
  const snapshot: CommunicationSnapshot = {
    profile: {
      coreSkills: {},
      hiddenSkills: {},
      applications: {},
      overallScore: null,
      totalReps: 20,
    },
    weakestCoreSkill: null,
    strongestCoreSkill: null,
    recentCoaching: [
      {
        dimension: "structure",
        subSkill: null,
        focusText: "Lead with the answer",
        implementedVerdict: "missed",
        at: "2026-07-05T00:00:00Z",
      },
    ],
    recurringWeaknesses: [],
    improvementTrends: [],
    mostImprovedCoreSkill: null,
    mostConsistentCoreSkill: null,
    strongestApplication: null,
    coachingEffectiveness: [
      { dimension: "structure", coached: 6, implemented: 1, rate: 1 / 6 },
      { dimension: "clarity", coached: 5, implemented: 4, rate: 4 / 5 },
    ],
    eventReadiness: [],
  };
  const block = renderCoachingMemoryBlock(snapshot)!;
  assert(
    block.includes("EFFECTIVENESS") && block.includes("structure coaching implemented 1/6"),
    "resistant dim surfaces with counts",
  );
  assert(
    !block.includes("clarity coaching implemented"),
    "responsive dims don't trigger technique change",
  );
  assert(
    block.includes("DIFFERENT coaching technique"),
    "instructs a technique switch",
  );
}

section("upcoming event line (I2)");
{
  const base: CommunicationSnapshot = {
    profile: {
      coreSkills: {},
      hiddenSkills: {},
      applications: {},
      overallScore: null,
      totalReps: 20,
    },
    weakestCoreSkill: null,
    strongestCoreSkill: null,
    recentCoaching: [
      {
        dimension: "structure",
        subSkill: null,
        focusText: "Lead with the answer",
        implementedVerdict: "missed",
        at: "2026-07-05T00:00:00Z",
      },
    ],
    recurringWeaknesses: [],
    improvementTrends: [],
    mostImprovedCoreSkill: null,
    mostConsistentCoreSkill: null,
    strongestApplication: null,
    coachingEffectiveness: [],
    eventReadiness: [],
  };

  const noEvent = renderCoachingMemoryBlock(base)!;
  assert(
    !noEvent.includes("UPCOMING EVENT"),
    "no active prep event → no event line",
  );

  const withEvent = renderCoachingMemoryBlock({
    ...base,
    eventReadiness: [
      { title: "Board pitch", readinessScore: 62 },
      { title: "Team offsite talk", readinessScore: null },
    ],
  })!;
  assert(
    withEvent.includes(
      'UPCOMING EVENT: the user is preparing for "Board pitch" — when natural, angle one example toward it.',
    ),
    "event line renders the exact operator copy for the most recent event",
  );
  assert(
    (withEvent.match(/UPCOMING EVENT/g) ?? []).length === 1,
    "exactly ONE event line even with multiple active events",
  );
  // Calibration guardrail: aside from that single line, the prompt is
  // byte-identical to the non-prep user's prompt.
  const stripped = withEvent
    .split("\n")
    .filter((l) => !l.startsWith("UPCOMING EVENT"))
    .join("\n");
  assert(
    stripped === noEvent,
    "non-event prompt is byte-identical apart from the one line",
  );
  // No coaching history → block stays null even with an active event
  // (calibration reference reps never gain a block from prep events).
  assert(
    renderCoachingMemoryBlock({
      ...base,
      recentCoaching: [],
      eventReadiness: [{ title: "Board pitch", readinessScore: 62 }],
    }) === null,
    "no coaching history → block null even with an event",
  );
}

section("stage benchmarks (7.4)");
{
  assert(benchmarkNote(72, "manager") === "Typical manager band: 60–75", "in-band note");
  assert(
    benchmarkNote(80, "manager")?.startsWith("Above typical"),
    "above-band note",
  );
  assert(
    benchmarkNote(50, "manager")?.startsWith("Building toward"),
    "below-band note",
  );
  assert(benchmarkNote(70, null) === null, "no stage → no note");
  assert(benchmarkNote(70, "bogus") === null, "unknown stage → no note");
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all intelligence tests pass`);
