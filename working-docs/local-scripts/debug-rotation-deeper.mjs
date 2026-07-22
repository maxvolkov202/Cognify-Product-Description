#!/usr/bin/env node
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const MAX = "1cdb5187-ac45-41b9-b76d-8c6ade19456d";
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

console.log("=== All reps ever for Max ===");
const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM cognify_v2.reps WHERE user_id = ${MAX}`;
console.log(`  total: ${total}`);

if (total > 0) {
  const recent = await sql`
    SELECT r.created_at, e.dimension::text AS dim, r.composite_score, r.exercise_id::text AS ex_id
    FROM cognify_v2.reps r
    LEFT JOIN cognify_v2.exercises e ON e.id = r.exercise_id
    WHERE r.user_id = ${MAX}
    ORDER BY r.created_at DESC LIMIT 10
  `;
  console.log("  most recent 10:");
  for (const r of recent) {
    console.log(`    ${r.created_at.toISOString()}  dim=${(r.dim ?? '(null)').padEnd(18)}  score=${r.composite_score}  ex=${(r.ex_id ?? '(NULL)').slice(0,12)}`);
  }
}

console.log("\n=== All exercise_engagement rows ever for Max ===");
const [{ engTotal }] = await sql`SELECT COUNT(*)::int AS "engTotal" FROM cognify_v2.exercise_engagement WHERE user_id = ${MAX}`;
console.log(`  total: ${engTotal}`);

console.log("\n=== Workout sessions for Max ===");
const [{ wsTotal }] = await sql`SELECT COUNT(*)::int AS "wsTotal" FROM cognify_v2.workout_sessions WHERE user_id = ${MAX}`;
console.log(`  total: ${wsTotal}`);

const wsCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='cognify_v2' AND table_name='workout_sessions'
  ORDER BY ordinal_position
`;
console.log("  workout_sessions columns:", wsCols.map(c=>c.column_name).join(", "));

const engCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='cognify_v2' AND table_name='exercise_engagement'
  ORDER BY ordinal_position
`;
console.log("\n  exercise_engagement columns:", engCols.map(c=>c.column_name).join(", "));

const [{ engGlobal }] = await sql`SELECT COUNT(*)::int AS "engGlobal" FROM cognify_v2.exercise_engagement`;
console.log(`\n  exercise_engagement TOTAL ROWS (all users): ${engGlobal}`);

console.log("\n=== Stations in last 5 muscle_group_days (any user) — compare engagement patterns ===");
const otherUsers = await sql`
  SELECT user_id::text, COUNT(*)::int AS days, COUNT(DISTINCT dimension::text)::int AS distinct_dims
  FROM cognify_v2.muscle_group_days
  GROUP BY user_id
  HAVING COUNT(*) >= 3
  ORDER BY COUNT(*) DESC
  LIMIT 5
`;
console.log("  Other users with ≥3 days:");
for (const u of otherUsers) {
  console.log(`    ${u.user_id.slice(0,8)}  days=${u.days}  distinct_dims=${u.distinct_dims}`);
}

await sql.end();
