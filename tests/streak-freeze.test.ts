/**
 * S2 — streak-freeze walk (PRD §10.7.1) + committed-days guards (G4).
 *
 *   • walkBackStreak is a PURE read-time computation (no DB writes)
 *   • up to `maxFreezes` freezes apply per streak — the 3-freeze bank
 *     really covers 3 isolated misses (previously capped at ONE)
 *   • two CONSECUTIVE missed committed days always break the streak
 *   • rest days neither count nor break; freezes never spend on them
 *   • appliedFreezeDate (singular) stays the most-recent covered date
 *   • MIN_COMMITTED_DAYS = 2 ("Tuesday and Thursday" is first-class)
 *   • isFinalCycleDay guards cycleLength < 2
 *
 * Run: npx tsx tests/streak-freeze.test.ts
 * Pure — @/lib/db/client is a lazy Proxy, so importing the module is
 * safe without DATABASE_URL as long as no query runs.
 */

import { walkBackStreak } from "@/lib/db/queries/streak-freeze";
import {
  MIN_COMMITTED_DAYS,
  assertValidMask,
  committedDayCount,
  dayIdsToMask,
  isFinalCycleDay,
} from "@/lib/onboarding/committed-days";

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

// Fixture week (UTC weekdays verified):
//   2026-07-06 Mon · 07 Tue · 08 Wed · 09 Thu · 10 Fri · 11 Sat · 12 Sun
const MON_FRI = 0b0011111; // bits 0..4 = Mon..Fri
const MWF = dayIdsToMask(["mon", "wed", "fri"]); // 0b0010101
const TZ = "UTC";

function walk(opts: {
  start: string;
  maxFreezes: number;
  reps: string[];
  mask?: number;
}) {
  return walkBackStreak({
    startDate: opts.start,
    maxFreezes: opts.maxFreezes,
    repDates: new Set(opts.reps),
    committedDays: opts.mask ?? MON_FRI,
    tz: TZ,
  });
}

section("no misses — freeze-free baseline");
{
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 0,
    reps: ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"],
  });
  assert(r.streakDays === 5, `full week streak (got ${r.streakDays})`);
  assert(r.freezesUsed === 0, "no freezes consumed when none needed");
  assert(r.appliedFreezeDates.length === 0, "no applied dates");
  assert(r.appliedFreezeDate === null, "singular field null");

  // With freezes banked, the walk extends the TAIL past the natural
  // start (the committed day before the first rep gets frozen, then the
  // one before that breaks on adjacency). Pre-existing single-freeze
  // behavior, preserved: document it rather than hide it.
  const tail = walk({
    start: "2026-07-10",
    maxFreezes: 3,
    reps: ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"],
  });
  assert(
    tail.streakDays === 6 && tail.freezesUsed === 1,
    `banked freeze extends the tail by exactly one committed day (got ${tail.streakDays}/${tail.freezesUsed})`,
  );
  assert(
    tail.appliedFreezeDate === "2026-07-03",
    "tail freeze covers the committed day before the streak start",
  );
}

section("single miss — one freeze (legacy behavior preserved)");
{
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 1,
    reps: ["2026-07-06", "2026-07-07", "2026-07-09", "2026-07-10"], // missed Wed 08
  });
  assert(r.streakDays === 5, `freeze bridges the miss (got ${r.streakDays})`);
  assert(r.freezesUsed === 1, "one freeze spent");
  assert(
    r.appliedFreezeDate === "2026-07-08",
    "appliedFreezeDate = the covered day",
  );
  assert(
    JSON.stringify(r.appliedFreezeDates) === JSON.stringify(["2026-07-08"]),
    "appliedFreezeDates lists it",
  );
}

section("S2 fix — multiple NON-adjacent misses each consume a freeze");
{
  // Mon rep · Tue MISS · Wed rep · Thu MISS · Fri rep — 2 banked (a 3rd
  // would extend the tail into the prior week; see baseline section).
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 2,
    reps: ["2026-07-06", "2026-07-08", "2026-07-10"],
  });
  assert(
    r.streakDays === 5,
    `second isolated miss no longer breaks the streak (got ${r.streakDays})`,
  );
  assert(r.freezesUsed === 2, `two freezes spent (got ${r.freezesUsed})`);
  assert(
    JSON.stringify(r.appliedFreezeDates) ===
      JSON.stringify(["2026-07-09", "2026-07-07"]),
    "applied dates most-recent-first",
  );
  assert(
    r.appliedFreezeDate === "2026-07-09",
    "singular field = most recent (back-compat)",
  );
}

section("adjacent missed committed days always break");
{
  // Mon rep · Tue MISS · Wed MISS · Thu MISS · Fri rep — freezes protect
  // an isolated slip, not a multi-session absence.
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 3,
    reps: ["2026-07-06", "2026-07-10"],
  });
  assert(
    r.streakDays === 2,
    `streak = Fri + frozen Thu, then breaks (got ${r.streakDays})`,
  );
  assert(r.freezesUsed === 1, "only one freeze spent before the break");
}

section("freeze spend caps at maxFreezes");
{
  // Two isolated misses but only 1 banked → breaks at the second.
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 1,
    reps: ["2026-07-06", "2026-07-08", "2026-07-10"],
  });
  assert(r.streakDays === 3, `breaks when the bank runs dry (got ${r.streakDays})`);
  assert(r.freezesUsed === 1, "never spends more than the bank");
}

section("raw walk (maxFreezes = 0) unchanged");
{
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 0,
    reps: ["2026-07-06", "2026-07-08", "2026-07-09", "2026-07-10"],
  });
  assert(r.streakDays === 3, `raw streak breaks at first miss (got ${r.streakDays})`);
  assert(r.freezesUsed === 0 && r.appliedFreezeDate === null, "raw spends nothing");
}

section("rest days are skipped, never frozen");
{
  // MWF schedule; trained all three committed days. Tue/Thu/weekend are
  // rest — the walk passes through without spending anything.
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 0,
    reps: ["2026-07-06", "2026-07-08", "2026-07-10"],
    mask: MWF,
  });
  assert(r.streakDays === 3, `MWF streak counts committed days only (got ${r.streakDays})`);
  assert(r.freezesUsed === 0, "no freeze spent on rest days");
}

section("adjacency = consecutive COMMITTED days (rest days between don't reset it)");
{
  // MWF schedule: Fri rep · Wed MISS (frozen) · Mon MISS — Wed and Mon
  // are adjacent committed days even though Tue sits between → break.
  const r = walk({
    start: "2026-07-10",
    maxFreezes: 3,
    reps: ["2026-07-10"],
    mask: MWF,
  });
  assert(
    r.streakDays === 2,
    `Fri + frozen Wed, then adjacent-committed Mon breaks (got ${r.streakDays})`,
  );
  assert(r.freezesUsed === 1, "one freeze before the adjacency break");

  // …but a rep between the misses resets adjacency (already covered in
  // the S2-fix section; this asserts the MWF variant).
  const ok = walk({
    start: "2026-07-10",
    maxFreezes: 3,
    reps: ["2026-07-08"], // Wed rep; Fri 10 MISS? start=Fri so Fri is frozen
    mask: MWF,
  });
  assert(
    ok.appliedFreezeDates[0] === "2026-07-10",
    "walk can freeze its own start day (committed, no rep)",
  );
}

section("G4 — 2-day committed schedules are first-class");
{
  assert(MIN_COMMITTED_DAYS === 2, "MIN_COMMITTED_DAYS is 2");
  const tueThu = dayIdsToMask(["tue", "thu"]);
  let threw = false;
  try {
    assertValidMask(tueThu);
  } catch {
    threw = true;
  }
  assert(!threw, "Tuesday+Thursday mask validates");
  assert(committedDayCount(tueThu) === 2, "count = 2");
  let threw1 = false;
  try {
    assertValidMask(dayIdsToMask(["sat"]));
  } catch {
    threw1 = true;
  }
  assert(threw1, "1-day mask still rejected");
  // Cycle-length guard: a (legacy/invalid) 1-day mask must not turn
  // every training day into a weakness day.
  const oneDay = dayIdsToMask(["mon"]);
  assert(
    !isFinalCycleDay(oneDay, new Date("2026-07-06T12:00:00Z"), TZ),
    "isFinalCycleDay guards cycleLength < 2",
  );
  // 2-day schedule: Thu IS the final cycle day, Tue is not.
  assert(
    isFinalCycleDay(tueThu, new Date("2026-07-09T12:00:00Z"), TZ),
    "Thu is final cycle day on Tue/Thu",
  );
  assert(
    !isFinalCycleDay(tueThu, new Date("2026-07-07T12:00:00Z"), TZ),
    "Tue is not final cycle day on Tue/Thu",
  );
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all streak-freeze tests pass`);
