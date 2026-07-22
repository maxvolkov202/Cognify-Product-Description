#!/usr/bin/env node
// Diagnose the rotation bug. Pulls Max's last 10 muscle_group_days,
// engagement state per dim, and per-dim 14d rep counts so we can see
// exactly what selectMuscleGroupForToday is seeing.
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const MAX = "1cdb5187-ac45-41b9-b76d-8c6ade19456d";
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

console.log("=== Recent muscle_group_days ===");
const days = await sql`
  SELECT day_date, dimension::text AS dim, created_at, completed_at
  FROM cognify_v2.muscle_group_days
  WHERE user_id = ${MAX}
  ORDER BY day_date DESC, created_at DESC LIMIT 10
`;
for (const d of days) {
  console.log(`  ${d.day_date.toISOString().slice(0,10)}  dim=${d.dim.padEnd(18)}  created=${d.created_at.toISOString()}  completed=${d.completed_at ? d.completed_at.toISOString() : '—'}`);
}

console.log("\n=== Engagement per dim (drives suggester) ===");
const eng = await sql`
  SELECT
    e.dimension::text AS dim,
    AVG(g.recent_composite)::real AS avg_recent,
    MAX(g.last_trained_at) AS last_trained,
    COUNT(g.*)::int AS row_count
  FROM cognify_v2.exercise_engagement g
  JOIN cognify_v2.exercises e ON e.id = g.exercise_id
  WHERE g.user_id = ${MAX}
  GROUP BY e.dimension
  ORDER BY e.dimension
`;
for (const e of eng) {
  console.log(`  ${e.dim.padEnd(18)}  avg=${e.avg_recent != null ? e.avg_recent.toFixed(1) : '—'}  last=${e.last_trained ? e.last_trained.toISOString() : '—'}  rows=${e.row_count}`);
}

console.log("\n=== Recent reps per dim (14d) ===");
const reps = await sql`
  SELECT
    e.dimension::text AS dim,
    COUNT(*)::int AS n,
    AVG(r.composite_score)::real AS avg_score,
    MAX(r.created_at) AS last_rep
  FROM cognify_v2.reps r
  JOIN cognify_v2.exercises e ON e.id = r.exercise_id
  WHERE r.user_id = ${MAX}
    AND r.created_at >= NOW() - INTERVAL '14 days'
  GROUP BY e.dimension
  ORDER BY e.dimension
`;
for (const r of reps) {
  console.log(`  ${r.dim.padEnd(18)}  n=${r.n}  avg=${r.avg_score != null ? r.avg_score.toFixed(1) : '—'}  last=${r.last_rep ? r.last_rep.toISOString() : '—'}`);
}

console.log("\n=== Users.vertical / focus_dim if present ===");
const [u] = await sql`SELECT vertical, improvement_goals FROM cognify_v2.users WHERE id = ${MAX}`;
console.log(`  vertical=${u.vertical}  goals=${JSON.stringify(u.improvement_goals)}`);

await sql.end();
