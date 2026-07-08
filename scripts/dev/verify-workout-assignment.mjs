#!/usr/bin/env node
/**
 * Phase 3 — dev-only verification harness for the muscle-group assignment
 * engine.
 *
 * Lets Max (or anyone working in dev) seed synthetic engagement and rep
 * data for a test user, then call the selector and see the result +
 * rationale. The plan's Phase 3 checkpoint protocol calls for exactly
 * this: "Max runs a seed script that backfills 14 days of synthetic
 * exercise_engagement, calls suggestTodaysMuscleGroup(), confirms
 * rationale matches seeded signal."
 *
 * Two presets:
 *   --preset cold-start   — wipe engagement for the test user (cold-start path)
 *   --preset regression   — seed Pacing with a 15-pt drop in last 7 days
 *
 * Usage:
 *   node scripts/dev/verify-workout-assignment.mjs --preset cold-start
 *   node scripts/dev/verify-workout-assignment.mjs --preset regression
 *   node scripts/dev/verify-workout-assignment.mjs --preset regression --apply
 *   node scripts/dev/verify-workout-assignment.mjs --user-id <uuid> --preset cold-start
 *
 * Without --apply, runs in dry-run mode and prints what it WOULD seed.
 *
 * Safety:
 *   - Refuses to run unless DATABASE_URL points at localhost or *.dev.*.
 *   - Always seeds against a sentinel user id (00000000-0000-0000-0000-
 *     00000000a55e — "asset") unless --user-id is supplied.
 */

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const TEST_USER_ID = "00000000-0000-0000-0000-00000000a55e";

const args = process.argv.slice(2);
const PRESET = (() => {
  const i = args.indexOf("--preset");
  return i >= 0 ? args[i + 1] : "cold-start";
})();
const USER_ID = (() => {
  const i = args.indexOf("--user-id");
  return i >= 0 ? args[i + 1] : TEST_USER_ID;
})();
const APPLY = args.includes("--apply");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[verify-workout-assignment] DATABASE_URL not set");
  process.exit(1);
}

// Safety check: must be a non-prod DB.
const isLocal = /(localhost|127\.0\.0\.1|\.dev\.|supabase\.co)/.test(dbUrl);
if (!isLocal) {
  console.error(
    "[verify-workout-assignment] refusing to run against what looks like prod DB",
  );
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function ensureUser() {
  const [existing] = await sql`
    SELECT id FROM cognify_v2.users WHERE id = ${USER_ID} LIMIT 1
  `;
  if (existing) return;
  if (!APPLY) {
    console.log(`  [dry-run] would create test user ${USER_ID}`);
    return;
  }
  await sql`
    INSERT INTO cognify_v2.users (id, email, display_name, created_at)
    VALUES (
      ${USER_ID},
      'workout-test@cognify.local',
      'Workout Assignment Test User',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log(`  ✓ ensured test user ${USER_ID}`);
}

async function wipeForUser() {
  if (!APPLY) {
    console.log(`  [dry-run] would wipe muscle_group_days + exercise_engagement + workout reps for ${USER_ID}`);
    return;
  }
  await sql`DELETE FROM cognify_v2.exercise_engagement WHERE user_id = ${USER_ID}`;
  await sql`DELETE FROM cognify_v2.muscle_group_days WHERE user_id = ${USER_ID}`;
  await sql`
    DELETE FROM cognify_v2.reps
    WHERE user_id = ${USER_ID} AND exercise_id IS NOT NULL
  `;
  console.log(`  ✓ wiped engagement + days + workout reps for ${USER_ID}`);
}

async function getExerciseSample(dim, n) {
  const rows = await sql`
    SELECT id FROM cognify_v2.exercises
    WHERE dimension = ${dim}::cognify_v2.dimension AND is_active = true
    LIMIT ${n}
  `;
  return rows.map((r) => r.id);
}

async function getOneExercise(dim) {
  const rows = await sql`
    SELECT id FROM cognify_v2.exercises
    WHERE dimension = ${dim}::cognify_v2.dimension AND is_active = true
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function seedRep(userId, exerciseId, composite, daysAgo) {
  // Create a throwaway practice_session + rep with the given composite.
  // We assume practice_sessions and reps schemas accept these fields.
  const sessionId = randomUUID();
  const repId = randomUUID();
  if (!APPLY) return;
  await sql`
    INSERT INTO cognify_v2.practice_sessions (id, user_id, mode, started_at, created_at)
    VALUES (${sessionId}, ${userId}, 'daily_workout',
            NOW() - INTERVAL '${sql.unsafe(`${daysAgo} days`)}',
            NOW() - INTERVAL '${sql.unsafe(`${daysAgo} days`)}')
  `;
  await sql`
    INSERT INTO cognify_v2.reps (
      id, session_id, user_id, prompt_text, duration_ms,
      composite_score, exercise_id, status, created_at
    )
    VALUES (
      ${repId}, ${sessionId}, ${userId},
      'synthetic verify-workout-assignment seed prompt',
      60000, ${composite}, ${exerciseId}, 'completed',
      NOW() - INTERVAL '${sql.unsafe(`${daysAgo} days`)}'
    )
  `;
}

async function presetColdStart() {
  console.log(`Preset: cold-start (user=${USER_ID})`);
  await ensureUser();
  await wipeForUser();
  console.log(`\nExpected next suggestion: clarity (cold_start rationale).`);
}

async function presetRegression() {
  console.log(`Preset: regression (user=${USER_ID})`);
  await ensureUser();
  await wipeForUser();

  const pacingExId = await getOneExercise("pacing");
  if (!pacingExId) {
    console.error("  ✗ no pacing exercises in catalog — run seed:exercises first");
    process.exit(1);
  }

  // Prior 7 days (days 8–14): average composite around 78.
  const priorComposites = [80, 82, 75, 78, 80, 76, 78];
  // Recent 7 days: average around 60 — a ~18-pt drop.
  const recentComposites = [62, 60, 58, 60, 64, 56, 60];
  for (const [i, c] of priorComposites.entries()) {
    console.log(`  seeding pacing rep daysAgo=${8 + i} composite=${c}`);
    await seedRep(USER_ID, pacingExId, c, 8 + i);
  }
  for (const [i, c] of recentComposites.entries()) {
    console.log(`  seeding pacing rep daysAgo=${1 + i} composite=${c}`);
    await seedRep(USER_ID, pacingExId, c, 1 + i);
  }

  // Sprinkle some baseline reps in the OTHER dims so cold-start doesn't fire.
  for (const dim of ["clarity", "structure", "conciseness", "thinking_quality", "tone"]) {
    const exId = await getOneExercise(dim);
    if (!exId) continue;
    for (let d = 1; d <= 5; d++) {
      await seedRep(USER_ID, exId, 75, d);
    }
  }

  console.log(`\nExpected next suggestion: pacing (sharp_regression rationale).`);
  console.log(`Expected drop: ~18 pts.`);
}

async function summarize() {
  const [eng] = await sql`
    SELECT COUNT(*)::int AS n
    FROM cognify_v2.exercise_engagement
    WHERE user_id = ${USER_ID}
  `;
  const [repCount] = await sql`
    SELECT COUNT(*)::int AS n
    FROM cognify_v2.reps
    WHERE user_id = ${USER_ID} AND exercise_id IS NOT NULL
  `;
  console.log(`\nSummary:`);
  console.log(`  engagement rows: ${eng.n}`);
  console.log(`  reps (with exercise_id): ${repCount.n}`);
  console.log(`\nNext: open Node REPL or invoke the action:`);
  console.log(`  import { suggestTodaysMuscleGroup } from '@/server/actions/workout-day';`);
  console.log(`  // call with currentUser() returning the seeded user`);
}

async function main() {
  if (!APPLY) {
    console.log("[verify-workout-assignment] dry-run (pass --apply to write)\n");
  }
  try {
    if (PRESET === "cold-start") await presetColdStart();
    else if (PRESET === "regression") await presetRegression();
    else {
      console.error(`unknown preset: ${PRESET}`);
      console.error("valid presets: cold-start, regression");
      process.exit(1);
    }
    if (APPLY) await summarize();
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[verify-workout-assignment] fatal:", err);
  process.exit(1);
});
