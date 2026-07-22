#!/usr/bin/env node
// Diagnose whether tagWorkoutRep is firing for Max's recent reps.
// If exercise_id IS NULL but muscle_group_day_id IS NOT NULL → tagWorkoutRep
// ran partially. If BOTH null → tagWorkoutRep never ran.
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const MAX = "1cdb5187-ac45-41b9-b76d-8c6ade19456d";
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

const reps = await sql`
  SELECT r.id::text, r.created_at, r.exercise_id::text, r.muscle_group_day_id::text,
         r.session_id::text, r.composite_score
  FROM cognify_v2.reps r
  WHERE r.user_id = ${MAX}
  ORDER BY r.created_at DESC LIMIT 10
`;

console.log("=== Max's reps ===");
for (const r of reps) {
  console.log(`  ${r.created_at.toISOString()}`);
  console.log(`    id=${r.id.slice(0,8)}  ex_id=${r.exercise_id ?? 'NULL'}  mgd_id=${r.muscle_group_day_id ?? 'NULL'}  session=${(r.session_id ?? 'NULL').slice(0,8)}  score=${r.composite_score}`);
}

// Cross-reference with muscle_group_days
console.log("\n=== His muscle_group_days ===");
const days = await sql`
  SELECT id::text, day_date, dimension::text AS dim, planned_exercise_ids
  FROM cognify_v2.muscle_group_days
  WHERE user_id = ${MAX}
  ORDER BY day_date DESC
`;
for (const d of days) {
  console.log(`  ${d.day_date.toISOString().slice(0,10)}  id=${d.id.slice(0,8)}  dim=${d.dim}  planned=${d.planned_exercise_ids.length} exercises`);
}

// Check ALL users with reps — is there ANYONE with exercise_id set on reps?
console.log("\n=== Globally: any rep with exercise_id set? ===");
const [{ withEx }] = await sql`SELECT COUNT(*)::int AS "withEx" FROM cognify_v2.reps WHERE exercise_id IS NOT NULL`;
const [{ withoutEx }] = await sql`SELECT COUNT(*)::int AS "withoutEx" FROM cognify_v2.reps WHERE exercise_id IS NULL`;
console.log(`  reps with exercise_id: ${withEx}`);
console.log(`  reps without exercise_id (NULL): ${withoutEx}`);

console.log("\n=== Globally: any rep with muscle_group_day_id set? ===");
const [{ withMgd }] = await sql`SELECT COUNT(*)::int AS "withMgd" FROM cognify_v2.reps WHERE muscle_group_day_id IS NOT NULL`;
console.log(`  reps with muscle_group_day_id: ${withMgd}`);

console.log("\n=== Max's workout_sessions ===");
const ws = await sql`
  SELECT id::text, muscle_group_day_id::text, state, created_at, current_station_index
  FROM cognify_v2.workout_sessions
  WHERE user_id = ${MAX}
  ORDER BY created_at DESC LIMIT 5
`;
for (const w of ws) {
  console.log(`  ${w.created_at.toISOString()}  ws=${w.id.slice(0,8)}  mgd=${(w.muscle_group_day_id ?? 'NULL').slice(0,8)}  state=${w.state}  station_idx=${w.current_station_index}`);
}

console.log("\n=== Max's recent rep sessions ===");
// What kind of session is 60c1ba17 etc.?
const sessions = await sql`
  SELECT s.id::text, s.mode, s.started_at, s.ended_at
  FROM cognify_v2.practice_sessions s
  WHERE s.user_id = ${MAX}
  ORDER BY s.started_at DESC LIMIT 5
`;
for (const s of sessions) {
  console.log(`  ${s.started_at.toISOString()}  id=${s.id.slice(0,8)}  mode=${s.mode}  ended=${s.ended_at ? s.ended_at.toISOString() : 'NULL'}`);
}

await sql.end();
