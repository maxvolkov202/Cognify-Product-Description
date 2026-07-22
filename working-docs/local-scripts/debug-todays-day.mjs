#!/usr/bin/env node
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

  const days = await sql`
    SELECT d.id::text, d.user_id::text, d.day_date, d.dimension::text AS dim,
           d.status, d.planned_exercise_ids, d.completed_reps
    FROM cognify_v2.muscle_group_days d
    ORDER BY d.day_date DESC, d.created_at DESC
  `;
  console.log(`Total muscle_group_days: ${days.length}`);

  for (const day of days) {
    console.log(`\n=== ${day.day_date} ${day.dim} status=${day.status} reps=${day.completed_reps}/4 ===`);
    console.log(`  Day id: ${day.id}`);
    console.log(`  User:   ${day.user_id}`);
    const ids = Array.isArray(day.planned_exercise_ids) ? day.planned_exercise_ids : [];
    for (const id of ids) {
      const ex = await sql`
        SELECT id::text, name, dimension::text AS dim
        FROM cognify_v2.exercises WHERE id = ${id}
      `;
      if (ex.length === 0) {
        console.log(`    ✗ ${id} — exercise NOT FOUND`);
        continue;
      }
      const [{ total }] = await sql`
        SELECT COUNT(*)::int AS total FROM cognify_v2.exercise_prompts
        WHERE exercise_id = ${id} AND is_active = true
      `;
      const [{ gen }] = await sql`
        SELECT COUNT(*)::int AS gen FROM cognify_v2.exercise_prompts
        WHERE exercise_id = ${id} AND is_active = true AND tags ? 'general'
      `;
      console.log(`    ✓ ${id.slice(0,8)}  ${ex[0].dim}/${ex[0].name.padEnd(35)}  total=${total} general=${gen}`);
    }
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
