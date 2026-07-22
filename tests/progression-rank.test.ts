/**
 * PRD v3 Phase 6 — Rank system + XP factors + weekly challenges tests.
 *
 *   • 32 strictly-ascending rank floors; level↔rank consistency (D4)
 *   • permanent-forward by construction; non-linear curve
 *   • §10.5.3 XP multipliers (implementation, improvement)
 *   • weekly challenge selection stability + counter mechanics
 *
 * Run: npx tsx tests/progression-rank.test.ts
 */

import {
  RANK_FLOORS,
  RANK_TIERS,
  TIER_DIVISION_XP,
  rankFromXp,
  rankChanged,
} from "@/lib/progression/rank";
import {
  computeXpGrant,
  implementationMultiplier,
  improvementMultiplier,
} from "@/lib/progression/xp";
import {
  applyChallengeEvent,
  pickChallengesForWeek,
  weekStartYmd,
  WEEKLY_CHALLENGE_BANK,
} from "@/lib/engagement/weekly-challenges";

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

section("rank floors — flat per-division, progressive per tier (P3 §3.3)");
{
  assert(RANK_FLOORS.length === 32, "32 ranks (8 tiers × 4 divisions)");
  assert(RANK_FLOORS[0]!.floorXp === 0, "Bronze I starts at 0 XP");

  // (c) strictly ascending across all 32.
  let ascending = true;
  for (let i = 1; i < RANK_FLOORS.length; i++) {
    if (RANK_FLOORS[i]!.floorXp <= RANK_FLOORS[i - 1]!.floorXp) {
      ascending = false;
      break;
    }
  }
  assert(ascending, "(c) floors strictly ascend across all 32");

  // Per-tier division deltas: (a) equal within a tier, (b) strictly
  // increasing tier over tier.
  const tierDeltas: number[] = [];
  let equalWithinTier = true;
  for (let t = 0; t < 8; t++) {
    const base = t * 4;
    const d1 = RANK_FLOORS[base + 1]!.floorXp - RANK_FLOORS[base]!.floorXp;
    const d2 = RANK_FLOORS[base + 2]!.floorXp - RANK_FLOORS[base + 1]!.floorXp;
    const d3 = RANK_FLOORS[base + 3]!.floorXp - RANK_FLOORS[base + 2]!.floorXp;
    if (!(d1 === d2 && d2 === d3)) equalWithinTier = false;
    tierDeltas.push(d1);
  }
  assert(equalWithinTier, "(a) all four divisions in a tier cost the same");
  assert(
    tierDeltas.every((d, i) => i === 0 || d > tierDeltas[i - 1]!),
    `(b) per-division cost increases every tier (${tierDeltas.join(" < ")})`,
  );
  assert(
    tierDeltas[0] === TIER_DIVISION_XP.bronze &&
      tierDeltas[7] === TIER_DIVISION_XP.grandmaster,
    "tier deltas equal the declared TIER_DIVISION_XP costs",
  );

  // Still non-linear (§10.5.4): reaching Grandmaster costs an order of
  // magnitude more total XP than clearing Bronze.
  const bronzeCleared = RANK_FLOORS[4]!.floorXp; // Silver I entry
  const grandmasterEntry = RANK_FLOORS[28]!.floorXp;
  assert(
    grandmasterEntry > bronzeCleared * 10,
    `curve stays non-linear (Bronze cleared at ${bronzeCleared}, Grandmaster entry ${grandmasterEntry})`,
  );
}

section("rank well-formedness + visible XP labels (DEC-2)");
{
  assert(rankFromXp(0).label === "Bronze I", "0 XP = Bronze I");
  const top = rankFromXp(10_000_000);
  assert(
    top.label === "Grandmaster IV" && top.nextLabel === null,
    "ceiling is Grandmaster IV",
  );
  assert(
    top.progress === 1 && top.xpToNext === null,
    "max rank has no 'to next'",
  );

  // xpInRank / xpToNext drive the "N XP · M to <next>" copy DEC-2 surfaces.
  const silverIIFloor = RANK_FLOORS[5]!.floorXp;
  const r = rankFromXp(silverIIFloor + 300);
  assert(r.label === "Silver II", `XP inside Silver II band → Silver II (got ${r.label})`);
  assert(r.xpInRank === 300, `xpInRank counts up from the floor (got ${r.xpInRank})`);
  assert(
    r.xpToNext === RANK_FLOORS[6]!.floorXp - (silverIIFloor + 300),
    `xpToNext counts down to the next floor (got ${r.xpToNext})`,
  );
  assert(
    Math.abs(r.progress - r.xpInRank / (r.xpInRank + (r.xpToNext ?? 0))) < 1e-9,
    "progress matches the xpInRank / division ratio",
  );
}

section("re-floor safety — no demotions vs live prod XP (2026-07-22)");
{
  // The Overhaul-P3 retune re-labels ranks at the same XP. Validated
  // against the prod distribution (718 users, 710 at 0 XP, top user
  // 3,400 XP): every real user must stay at their prior division or
  // promote — never demote. These are the only non-Bronze-I users and
  // their PRE-retune divisions.
  const order = RANK_FLOORS.map((f) => {
    const roman = ["I", "II", "III", "IV"][f.division - 1];
    return `${RANK_TIERS[f.tier]!.label} ${roman}`;
  });
  const idxOf = (label: string) => order.indexOf(label);
  const historical: [number, string][] = [
    [0, "Bronze I"],
    [423, "Bronze I"],
    [1781, "Bronze III"],
    [2663, "Bronze III"],
    [3400, "Bronze IV"],
  ];
  for (const [xp, was] of historical) {
    const now = rankFromXp(xp).label;
    assert(
      idxOf(now) >= idxOf(was),
      `xp ${xp}: ${was} → ${now} must not be a demotion`,
    );
  }
}

section("permanent-forward + change detection");
{
  assert(!rankChanged(100, 120), "small gain, same rank");
  const silverFloor = RANK_FLOORS[4]!.floorXp;
  assert(rankChanged(silverFloor - 1, silverFloor), "crossing a floor = rank up");
  const r1 = rankFromXp(5000);
  const r2 = rankFromXp(5001);
  assert(r2.rankIndex >= r1.rankIndex, "rank never decreases as XP grows");
}

section("XP factors (§10.5.3)");
{
  assert(implementationMultiplier("nailed") === 1.5, "nailed = ×1.5");
  assert(implementationMultiplier("partial") === 1.25, "partial = ×1.25");
  assert(implementationMultiplier("missed") === 1.0, "missed = ×1.0");
  assert(implementationMultiplier(null) === 1.0, "first attempts unaffected");
  assert(improvementMultiplier(10) === 1.1, "+10 composite = ×1.1");
  assert(improvementMultiplier(100) === 1.3, "improvement bonus capped at ×1.3");
  assert(improvementMultiplier(-5) === 1.0, "regression never penalizes XP");
  const base = computeXpGrant({ composite: 80, streakDays: 0 });
  const nailedImproved = computeXpGrant({
    composite: 80,
    streakDays: 0,
    implementationVerdict: "nailed",
    scoreImprovement: 10,
  });
  assert(
    nailedImproved === Math.round(base * 1.5 * 1.1),
    `factors compose multiplicatively (${base} → ${nailedImproved})`,
  );
}

section("weekly challenge selection");
{
  const week = weekStartYmd(new Date("2026-07-08T10:00:00Z")); // Wednesday
  assert(week === "2026-07-05", `Sunday-UTC week key (got ${week})`);
  const a = pickChallengesForWeek("user-1", week);
  const b = pickChallengesForWeek("user-1", week);
  assert(
    JSON.stringify(a.map((c) => c.id)) === JSON.stringify(b.map((c) => c.id)),
    "stable per (user, week)",
  );
  assert(a.length === 3, "3 challenges per week");
  const c = pickChallengesForWeek("user-2", week);
  assert(
    WEEKLY_CHALLENGE_BANK.length >= 6,
    "bank large enough for variety",
  );
  assert(new Set(a.map((x) => x.id)).size === 3, "no duplicate picks");
  void c;
}

section("challenge counters");
{
  const challenges = [
    { id: "wc_reps_20", target: 20, bonusXp: 120 },
    { id: "wc_implemented_5", target: 5, bonusXp: 150 },
    { id: "wc_strong_reps_8", target: 8, bonusXp: 120 },
  ];
  const first = applyChallengeEvent({
    challenges,
    progress: {},
    alreadyCompletedIds: new Set(),
    event: {
      mode: "daily_workout",
      composite: 80,
      implementedRetry: true,
      newTrainingDay: true,
      trainedOnCommittedDay: true,
    },
    });
  assert(first.progress.wc_reps_20 === 1, "rep counted");
  assert(first.progress.wc_implemented_5 === 1, "implementation counted");
  assert(first.progress.wc_strong_reps_8 === 1, "75+ counted");
  assert(first.newlyCompletedIds.length === 0, "nothing completes early");

  const nearDone = applyChallengeEvent({
    challenges,
    progress: { wc_implemented_5: 4 },
    alreadyCompletedIds: new Set(),
    event: {
      mode: "skill_lab",
      composite: 60,
      implementedRetry: true,
      newTrainingDay: false,
      trainedOnCommittedDay: true,
    },
  });
  assert(
    nearDone.newlyCompletedIds.includes("wc_implemented_5") &&
      nearDone.bonusXp === 150,
    "hitting target completes + grants bonus",
  );
  assert(
    nearDone.progress.wc_implemented_5 === 5,
    "progress clamps at target",
  );

  const already = applyChallengeEvent({
    challenges,
    progress: { wc_implemented_5: 5 },
    alreadyCompletedIds: new Set(["wc_implemented_5"]),
    event: {
      mode: "skill_lab",
      composite: 60,
      implementedRetry: true,
      newTrainingDay: false,
      trainedOnCommittedDay: true,
    },
  });
  assert(
    already.newlyCompletedIds.length === 0 && already.bonusXp === 0,
    "completed challenges never re-award",
  );
}

section("wc_committed_week — maintain committed schedule (G6)");
{
  // Target is personalized at assignment time (persistence layer); the
  // pure counter just consumes whatever target the row carries.
  const challenges = [{ id: "wc_committed_week", target: 2, bonusXp: 150 }];
  const base = {
    mode: "daily_workout",
    composite: 70,
    implementedRetry: false,
  };
  const committedFirstRep = applyChallengeEvent({
    challenges,
    progress: {},
    alreadyCompletedIds: new Set(),
    event: { ...base, newTrainingDay: true, trainedOnCommittedDay: true },
  });
  assert(
    committedFirstRep.progress.wc_committed_week === 1,
    "first rep on a committed day counts",
  );
  const secondRepSameDay = applyChallengeEvent({
    challenges,
    progress: { wc_committed_week: 1 },
    alreadyCompletedIds: new Set(),
    event: { ...base, newTrainingDay: false, trainedOnCommittedDay: true },
  });
  assert(
    secondRepSameDay.progress.wc_committed_week === 1,
    "second rep on the same day does NOT double-count",
  );
  const restDayRep = applyChallengeEvent({
    challenges,
    progress: { wc_committed_week: 1 },
    alreadyCompletedIds: new Set(),
    event: { ...base, newTrainingDay: true, trainedOnCommittedDay: false },
  });
  assert(
    restDayRep.progress.wc_committed_week === 1,
    "training on a REST day does not advance the committed-schedule challenge",
  );
  const completes = applyChallengeEvent({
    challenges,
    progress: { wc_committed_week: 1 },
    alreadyCompletedIds: new Set(),
    event: { ...base, newTrainingDay: true, trainedOnCommittedDay: true },
  });
  assert(
    completes.newlyCompletedIds.includes("wc_committed_week") &&
      completes.bonusXp === 150,
    "hitting the committed-day count completes the challenge",
  );
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all progression-rank tests pass`);
