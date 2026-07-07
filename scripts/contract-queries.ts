/**
 * P3 — DB contract harness.
 *
 * Unit tests mock the DB, so a query that ALWAYS threw 42803 (broken
 * GROUP BY select-position vs repeated-parameter expression) shipped and
 * ran broken for 6 weeks — safeDb swallowed the error on every call and
 * returned the fallback (findings ledger F-3, plans/prd-e2e-findings.md).
 *
 * This harness imports the EXPORTED query functions directly (zero
 * production-code changes) and executes each against the REAL dev
 * database with the demo user. The assertion is "does not throw" — and
 * because safeDb swallows read errors, "does not throw" alone isn't
 * enough: we monkeypatch console.error around each call and FAIL the
 * contract when a swallowed-failure line ("[db] operation failed" or
 * event=db.write_failed) fired during it.
 *
 *   npm run test:contract        (= npx tsx scripts/contract-queries.ts)
 *
 * Dev-only: refuses to run when DATABASE_URL looks like production
 * (same guard style as scripts/seed-demo-user.ts). Exits 0 with a note
 * when the DB has no users at all (nothing to contract-test).
 *
 * Coverage policy: every exported async query function in the nine
 * modules below. Write functions are skipped UNLESS they are clearly
 * idempotent read-or-create (getOrCreateTodayQuests /
 * getOrCreateThisWeekChallenges are fine on the demo user). Skipped
 * writes: awardStreakFreeze, consumeStreakFreeze, markQuestsCompleted,
 * recordWeeklyChallengeEvent, incrementTeamChallenges.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Wave 3 — the workout-day raw-SQL fetchers early-return empty when the
// v2 training engine is off, which would make their contract checks
// vacuous. Default the flag ON for the harness run (an explicit value in
// the environment / .env.local still wins).
process.env.FF_TRAINING_ENGINE_V2 ??= "true";

import { randomUUID } from "node:crypto";

const DEMO_EMAIL = "demo@cognify.test";

/**
 * Findings ledger — GENUINELY broken queries this harness has caught.
 * Per the harness contract these are reported, not fixed here (the fix
 * belongs to the owning surface). Entries still run every time: they
 * print as ⚠ known-broken without failing the exit code, and if one
 * unexpectedly PASSES the harness warns that the entry is stale.
 *
 * Remove an entry once the underlying bug is fixed.
 */
// Fixed 2026-07-06: getRepWithDetails — dimensionScores/callouts
// relations back-references added in schema.ts; entry removed so the
// harness now ENFORCES it.
const KNOWN_BROKEN: Record<string, string> = {};

type CheckResult = { name: string; ok: boolean; message?: string };

/**
 * Run one contract check. Captures console.error for the duration of
 * the call so safeDb's swallowed read failures ("[db] operation failed")
 * and labeled write failures (event=db.write_failed) turn the check red
 * even though the function "succeeded" by returning its fallback.
 */
async function check(
  name: string,
  fn: () => Promise<unknown>,
): Promise<CheckResult> {
  const original = console.error;
  const captured: string[] = [];
  console.error = (...args: unknown[]) => {
    captured.push(
      args
        .map((a) => {
          if (typeof a === "string") return a;
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" "),
    );
  };
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, ok: false, message: `threw: ${message}` };
  } finally {
    console.error = original;
  }
  const swallowed = captured.find(
    (line) =>
      line.includes("[db] operation failed") ||
      line.includes("db.write_failed"),
  );
  if (swallowed) {
    return {
      name,
      ok: false,
      message: `safeDb swallowed a failure: ${swallowed.slice(0, 500)}`,
    };
  }
  return { name, ok: true };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  if (/prod/i.test(dbUrl) && !/dev|local|staging/i.test(dbUrl)) {
    throw new Error(
      "Refusing to run the contract harness against a production-looking DATABASE_URL",
    );
  }

  // Env must be loaded before the db client module is evaluated, so all
  // production imports are dynamic (same pattern as seed-demo-user.ts).
  const { db } = await import("../src/lib/db/client");
  const schema = await import("../src/lib/db/schema");
  const { desc, eq } = await import("drizzle-orm");

  const progress = await import("../src/lib/db/queries/progress");
  const streakFreeze = await import("../src/lib/db/queries/streak-freeze");
  const leaderboard = await import("../src/lib/db/queries/leaderboard");
  const calendarHistory = await import(
    "../src/lib/db/queries/calendar-history"
  );
  const muscleGroupProgress = await import(
    "../src/lib/db/queries/muscle-group-progress"
  );
  const subSkills = await import("../src/lib/db/queries/sub-skills");
  const dailyQuests = await import("../src/lib/db/queries/daily-quests");
  const weeklyChallenges = await import(
    "../src/lib/db/queries/weekly-challenges"
  );
  const friends = await import("../src/lib/db/queries/friends");
  // Wave 3 — the Daily Workout's action-local raw-SQL fetchers
  // (db.execute path: timestamptz comes back as a STRING, the exact
  // class that silently broke plateau detection — see day-fetchers.ts).
  const dayFetchers = await import("../src/server/lib/workout/day-fetchers");

  // ── Fixture user: demo@cognify.test, else any user, else exit 0 ─────
  const demoUser = await db.query.users.findFirst({
    where: eq(schema.users.email, DEMO_EMAIL),
  });
  const user = demoUser ?? (await db.query.users.findFirst());
  if (!user) {
    console.log(
      "[contract] no fixture user (no users in DB at all) — nothing to contract-test; exiting 0.",
    );
    console.log(
      "[contract] hint: run `npx tsx scripts/seed-demo-user.ts` first for populated coverage.",
    );
    process.exit(0);
  }
  const userId = user.id;
  console.log(
    `[contract] fixture user ${userId} (${user.email ?? "no email"})${demoUser ? "" : " — demo user not found, using first user row"}`,
  );

  // ── Fixture rows for id-shaped args (fall back to random UUIDs —
  //    the SQL still executes, which is what the contract asserts). ───
  const [latestRep] = await db
    .select({ id: schema.reps.id, topic: schema.reps.topic })
    .from(schema.reps)
    .where(eq(schema.reps.userId, userId))
    .orderBy(desc(schema.reps.createdAt))
    .limit(1);
  const [latestMgDay] = await db
    .select({
      id: schema.muscleGroupDays.id,
      dimension: schema.muscleGroupDays.dimension,
    })
    .from(schema.muscleGroupDays)
    .where(eq(schema.muscleGroupDays.userId, userId))
    .orderBy(desc(schema.muscleGroupDays.dayDate))
    .limit(1);

  const repId = latestRep?.id ?? randomUUID();
  const repTopic = latestRep?.topic ?? "Daily rep";
  const mgDayId = latestMgDay?.id ?? randomUUID();
  const mgDim = (latestMgDay?.dimension ?? "clarity") as never;
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();

  // ── The contract suite ──────────────────────────────────────────────
  // Serial on purpose: console.error attribution must not interleave.
  const suite: Array<[string, () => Promise<unknown>]> = [
    // progress.ts
    ["progress.getSkillTrends", () => progress.getSkillTrends(userId, 30)],
    ["progress.getWeakestDimension", () => progress.getWeakestDimension(userId)],
    ["progress.getRunningAverages", () => progress.getRunningAverages(userId)],
    ["progress.getCurrentSkillScores", () => progress.getCurrentSkillScores(userId)],
    ["progress.getActivityHeatmap", () => progress.getActivityHeatmap(userId, 90)],
    ["progress.getRepById", () => progress.getRepById(repId)],
    ["progress.getRepWithDetails", () => progress.getRepWithDetails(repId)],
    ["progress.getRecentReps", () => progress.getRecentReps(userId, 10)],
    [
      "progress.getPressureRepStats(days)",
      () => progress.getPressureRepStats(userId, 60),
    ],
    [
      "progress.getPressureRepStats({since,until})",
      () =>
        progress.getPressureRepStats(userId, {
          since: new Date(weekAgoIso),
          until: new Date(nowIso),
        }),
    ],
    ["progress.getWeeklyRepSummary", () => progress.getWeeklyRepSummary(userId)],
    [
      "progress.getLastSessionWeakestDimension",
      () => progress.getLastSessionWeakestDimension(userId),
    ],
    [
      "progress.getUserDimensionMaxes",
      () => progress.getUserDimensionMaxes(userId),
    ],
    ["progress.getStreakDays", () => progress.getStreakDays(userId)],
    [
      "progress.getYesterdayDailyAverage",
      () => progress.getYesterdayDailyAverage(userId),
    ],
    [
      "progress.getRepsForDateRange",
      () => progress.getRepsForDateRange(userId, weekAgoIso, nowIso),
    ],
    [
      "progress.getDailyCompositeTrend",
      () => progress.getDailyCompositeTrend(userId, 60),
    ],
    ["progress.getBeforeAfterReps", () => progress.getBeforeAfterReps(userId)],
    [
      "progress.getRepsOnSameTopic",
      () => progress.getRepsOnSameTopic(userId, repTopic),
    ],

    // streak-freeze.ts (awardStreakFreeze / consumeStreakFreeze are
    // non-idempotent writes — skipped)
    ["streak-freeze.getStreakStatus", () => streakFreeze.getStreakStatus(userId)],

    // leaderboard.ts — one call per scope/metric branch
    [
      "leaderboard.getLeaderboard(global/composite)",
      () => leaderboard.getLeaderboard({ scope: "global", userId }),
    ],
    [
      "leaderboard.getLeaderboard(this_week/improvement)",
      () =>
        leaderboard.getLeaderboard({
          scope: "this_week",
          userId,
          metric: "improvement",
        }),
    ],
    [
      "leaderboard.getLeaderboard(global/communication_score)",
      () =>
        leaderboard.getLeaderboard({
          scope: "global",
          userId,
          metric: "communication_score",
        }),
    ],
    [
      "leaderboard.getLeaderboard(team)",
      () => leaderboard.getLeaderboard({ scope: "team", userId }),
    ],

    // calendar-history.ts
    [
      "calendar-history.getCalendarHistory",
      () => calendarHistory.getCalendarHistory(userId),
    ],

    // muscle-group-progress.ts
    [
      "muscle-group-progress.getLastMuscleGroupDay",
      () => muscleGroupProgress.getLastMuscleGroupDay(userId, mgDim),
    ],
    [
      "muscle-group-progress.getMuscleGroupTimeline(dim)",
      () => muscleGroupProgress.getMuscleGroupTimeline(userId, mgDim, 60),
    ],
    [
      "muscle-group-progress.getMuscleGroupTimeline(all)",
      () => muscleGroupProgress.getMuscleGroupTimeline(userId, null, 60),
    ],
    [
      "muscle-group-progress.getDayRepsBreakdown",
      () => muscleGroupProgress.getDayRepsBreakdown(mgDayId),
    ],
    [
      "muscle-group-progress.getMuscleGroupComparison",
      () => muscleGroupProgress.getMuscleGroupComparison(userId, mgDim, mgDayId),
    ],

    // sub-skills.ts (bucketByDimension / hasMeaningfulSubSkillData are
    // sync pure helpers — no DB contract to test)
    [
      "sub-skills.getSubSkillRunningAverages",
      () => subSkills.getSubSkillRunningAverages(userId),
    ],

    // daily-quests.ts (markQuestsCompleted is a write — skipped;
    // getOrCreateTodayQuests is idempotent read-or-create)
    [
      "daily-quests.getOrCreateTodayQuests",
      () => dailyQuests.getOrCreateTodayQuests(userId),
    ],

    // weekly-challenges.ts (recordWeeklyChallengeEvent /
    // incrementTeamChallenges are writes — skipped)
    [
      "weekly-challenges.getOrCreateThisWeekChallenges",
      () => weeklyChallenges.getOrCreateThisWeekChallenges(userId),
    ],
    [
      "weekly-challenges.getTeamChallenges",
      () => weeklyChallenges.getTeamChallenges(userId),
    ],

    // workout-day fetchers (src/server/lib/workout/day-fetchers.ts) —
    // the db.execute raw-SQL class. Beyond "executes without a swallowed
    // failure", the checks assert the timestamptz-as-string contract:
    // every ISO-string field the fetchers return must Date.parse to a
    // finite number (the .toISOString-on-a-string crash class reduces to
    // exactly this). fetchPlateauedDims parses its `at` fields
    // internally — a bad parse throws inside the call and fails the
    // check the same way.
    [
      "workout-day.fetchEngagement",
      async () => {
        const rows = await dayFetchers.fetchEngagement(userId);
        for (const r of rows) {
          if (
            r.lastTrainedAt != null &&
            !Number.isFinite(Date.parse(r.lastTrainedAt))
          ) {
            throw new Error(
              `lastTrainedAt is not a parseable timestamp: ${JSON.stringify(r.lastTrainedAt)} (dim=${r.dimension})`,
            );
          }
        }
      },
    ],
    [
      "workout-day.fetchRecentRepsAggregates",
      () => dayFetchers.fetchRecentRepsAggregates(userId),
    ],
    [
      "workout-day.fetchPlateauedDims",
      () => dayFetchers.fetchPlateauedDims(userId),
    ],
    [
      "workout-day.fetchRecentFocusByDim",
      () => dayFetchers.fetchRecentFocusByDim(userId),
    ],
    [
      "workout-day.fetchCompletedExerciseIds",
      () => dayFetchers.fetchCompletedExerciseIds(userId),
    ],

    // friends.ts
    ["friends.getFriendsForUser", () => friends.getFriendsForUser(userId)],
    [
      "friends.getPendingRequestsForUser",
      () => friends.getPendingRequestsForUser(userId),
    ],
    [
      "friends.getChallengesForUser",
      () => friends.getChallengesForUser(userId),
    ],
    ["friends.findUserByEmail", () => friends.findUserByEmail(DEMO_EMAIL)],
  ];

  const results: CheckResult[] = [];
  const knownBrokenHit: string[] = [];
  const staleKnownBroken: string[] = [];
  for (const [name, fn] of suite) {
    const result = await check(name, fn);
    const knownBroken = KNOWN_BROKEN[name];
    if (knownBroken && !result.ok) {
      // Expected failure — reported, not fixed (see KNOWN_BROKEN docs).
      knownBrokenHit.push(name);
      console.log(`  ⚠ ${name} (known-broken — see findings ledger)`);
      console.log(`      ${result.message}`);
      continue;
    }
    if (knownBroken && result.ok) {
      staleKnownBroken.push(name);
      console.log(
        `  ✓ ${name} — but it's on the KNOWN_BROKEN list; the entry is stale, remove it.`,
      );
      results.push(result);
      continue;
    }
    results.push(result);
    if (result.ok) {
      console.log(`  ✓ ${name}`);
    } else {
      console.log(`  ✗ ${name}`);
      console.log(`      ${result.message}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n[contract] ${results.length - failed.length}/${results.length} query contracts passed` +
      (knownBrokenHit.length > 0
        ? ` (+${knownBrokenHit.length} known-broken, excluded from exit code)`
        : ""),
  );
  for (const name of knownBrokenHit) {
    console.log(`[contract] KNOWN-BROKEN: ${name} — ${KNOWN_BROKEN[name]}`);
  }
  for (const name of staleKnownBroken) {
    console.log(
      `[contract] STALE KNOWN_BROKEN entry: ${name} now passes — remove it from the ledger.`,
    );
  }
  if (failed.length > 0) {
    console.log(`[contract] FAILED: ${failed.map((f) => f.name).join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  const e = err as { message?: string };
  console.error("[contract] harness failed:", e?.message ?? String(err));
  process.exit(1);
});
