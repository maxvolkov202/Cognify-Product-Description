#!/usr/bin/env node
// Find muscle_group_days whose planned_exercise_ids reference exercise
// uuids that don't exist in the exercises table — the "orphan day" bug
// that surfaces as "No prompts available" because the picker is
// querying with an id that has no matching prompt bank.

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

  const exerciseIds = new Set(
    (await sql`SELECT id::text FROM cognify_v2.exercises`).map((r) => r.id),
  );
  console.log(`Active exercises in DB: ${exerciseIds.size}`);

  const days = await sql`
    SELECT id::text, user_id::text, day_date, dimension::text AS dim, status,
           planned_exercise_ids, completed_reps
    FROM cognify_v2.muscle_group_days
    ORDER BY day_date DESC
    LIMIT 200
  `;
  console.log(`\nLatest ${days.length} muscle_group_days:`);

  let orphanCount = 0;
  let openOrphanCount = 0;

  for (const day of days) {
    const ids = Array.isArray(day.planned_exercise_ids)
      ? day.planned_exercise_ids
      : [];
    const missing = ids.filter((id) => !exerciseIds.has(String(id)));
    const isOpen = day.status !== "complete";

    if (missing.length > 0) {
      orphanCount++;
      if (isOpen) openOrphanCount++;
      console.log(
        `  ⚠ ${day.day_date} ${day.dim.padEnd(20)} status=${day.status.padEnd(10)} ` +
          `reps=${day.completed_reps}/4 user=${day.user_id.slice(0,8)} ` +
          `missing=${missing.length}/${ids.length} ${isOpen ? "[OPEN]" : ""}`,
      );
    }
  }

  console.log(`\nOrphan days total: ${orphanCount}`);
  console.log(`Orphan days currently OPEN (would 'No prompts'): ${openOrphanCount}`);

  // For OPEN orphan days, show which exerciseIds are stale.
  if (openOrphanCount > 0) {
    console.log(`\n--- Detail on OPEN orphan days ---`);
    for (const day of days) {
      if (day.status === "complete") continue;
      const ids = Array.isArray(day.planned_exercise_ids)
        ? day.planned_exercise_ids
        : [];
      const missing = ids.filter((id) => !exerciseIds.has(String(id)));
      if (missing.length === 0) continue;
      console.log(
        `  Day ${day.id.slice(0,8)} (user ${day.user_id.slice(0,8)} ${day.day_date}):`,
      );
      for (const id of ids) {
        const ok = exerciseIds.has(String(id));
        console.log(`    ${ok ? "✓" : "✗"} ${id}`);
      }
    }
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
