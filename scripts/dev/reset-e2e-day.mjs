#!/usr/bin/env node
/**
 * Dev-only: reset the CURRENT (latest) muscle-group day for a test account so
 * the authed workout smoke can run a fresh 3-station loop. Strictly scoped to
 * ONE test user (default e2e-harness@cognify.test) and only that user's most
 * recent day + its sessions/reps/telemetry. Refuses to touch anything else.
 *
 * Usage: node scripts/dev/reset-e2e-day.mjs [email]
 */
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const EMAIL = process.argv[2] ?? "e2e-harness@cognify.test";

// Hard guard: only ever operate on @cognify.test harness accounts.
if (!EMAIL.endsWith("@cognify.test")) {
  console.error(`Refusing to reset a non-test account: ${EMAIL}`);
  process.exit(1);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

  // muscle_group_days.user_id references the INTERNAL cognify_v2.users.id
  // (mapped from Supabase auth via auth_user_id) — NOT auth.users.id.
  const users = await sql`
    SELECT id::text FROM cognify_v2.users WHERE email = ${EMAIL}
  `;
  if (users.length === 0) {
    console.error(`No cognify_v2.users row for ${EMAIL}`);
    await sql.end();
    process.exit(1);
  }
  const userId = users[0].id;
  console.log(`User ${EMAIL} = internal id ${userId}`);

  const days = await sql`
    SELECT id::text, day_date, dimension::text AS dim, status, completed_reps
    FROM cognify_v2.muscle_group_days
    WHERE user_id = ${userId}
    ORDER BY day_date DESC, created_at DESC
    LIMIT 1
  `;
  if (days.length === 0) {
    console.log("No day to reset — a fresh one will be created on next visit.");
    await sql.end();
    return;
  }
  const day = days[0];
  console.log(
    `Latest day: ${day.day_date} ${day.dim} status=${day.status} reps=${day.completed_reps} (id ${day.id})`,
  );

  const dayId = day.id;
  const delSessions = await sql`
    DELETE FROM cognify_v2.workout_sessions
    WHERE muscle_group_day_id = ${dayId} AND user_id = ${userId}
    RETURNING id
  `;
  const delTelemetry = await sql`
    DELETE FROM cognify_v2.scoring_telemetry
    WHERE muscle_group_day_id = ${dayId}
    RETURNING id
  `.catch(() => []);
  const delReps = await sql`
    DELETE FROM cognify_v2.reps
    WHERE muscle_group_day_id = ${dayId} AND user_id = ${userId}
    RETURNING id
  `;
  const delDay = await sql`
    DELETE FROM cognify_v2.muscle_group_days
    WHERE id = ${dayId} AND user_id = ${userId}
    RETURNING id
  `;
  console.log(
    `Deleted: sessions=${delSessions.length} telemetry=${delTelemetry.length} reps=${delReps.length} day=${delDay.length}`,
  );
  console.log("Fresh day will generate on next /workout visit.");

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
