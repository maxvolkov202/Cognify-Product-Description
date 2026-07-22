#!/usr/bin/env node
// Diagnose specifically WHICH path Max's recent daily_workout reps used,
// and whether exerciseId/muscleGroupDayId ever made it into the row.
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

// Look at the 10 most recent reps belonging to a daily_workout session,
// joining practice_sessions to confirm mode.
const rows = await sql`
  SELECT r.id::text AS rep_id,
         r.created_at,
         r.exercise_id::text AS ex_id,
         r.muscle_group_day_id::text AS mgd_id,
         r.status,
         r.composite_score,
         r.user_id::text AS user_id,
         ps.mode AS session_mode,
         ps.ended_at
  FROM cognify_v2.reps r
  JOIN cognify_v2.practice_sessions ps ON ps.id = r.session_id
  WHERE ps.mode = 'daily_workout'
  ORDER BY r.created_at DESC
  LIMIT 20
`;

console.log("=== 20 most recent daily_workout reps ===\n");
for (const r of rows) {
  console.log(
    `${r.created_at.toISOString()} rep=${r.rep_id.slice(0,8)} ex=${r.ex_id ?? "NULL"} mgd=${r.mgd_id ?? "NULL"} status=${r.status} score=${r.composite_score}`
  );
}

const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM cognify_v2.reps r JOIN cognify_v2.practice_sessions ps ON ps.id = r.session_id WHERE ps.mode = 'daily_workout'`;
const [{ withEx }] = await sql`SELECT COUNT(*)::int AS "withEx" FROM cognify_v2.reps r JOIN cognify_v2.practice_sessions ps ON ps.id = r.session_id WHERE ps.mode = 'daily_workout' AND r.exercise_id IS NOT NULL`;
const [{ withMgd }] = await sql`SELECT COUNT(*)::int AS "withMgd" FROM cognify_v2.reps r JOIN cognify_v2.practice_sessions ps ON ps.id = r.session_id WHERE ps.mode = 'daily_workout' AND r.muscle_group_day_id IS NOT NULL`;
console.log(`\n=== daily_workout reps total: ${total}, with exercise_id: ${withEx}, with muscle_group_day_id: ${withMgd} ===`);

// Check engagement table
const [{ engTotal }] = await sql`SELECT COUNT(*)::int AS "engTotal" FROM cognify_v2.exercise_engagement`;
console.log(`\n=== exercise_engagement rows total: ${engTotal} ===`);

// Check if there are ANY reps with a muscle_group_day_id at all (any mode)
const dailyWithMgd = await sql`
  SELECT r.id::text, r.created_at, r.exercise_id::text AS ex_id, r.muscle_group_day_id::text AS mgd_id
  FROM cognify_v2.reps r
  WHERE r.muscle_group_day_id IS NOT NULL
  ORDER BY r.created_at DESC
  LIMIT 5
`;
console.log(`\n=== Any rep with muscle_group_day_id (any mode): ${dailyWithMgd.length} found ===`);
for (const r of dailyWithMgd) console.log(`  ${r.created_at.toISOString()} ex=${r.ex_id ?? "NULL"} mgd=${r.mgd_id}`);

await sql.end();
