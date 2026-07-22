#!/usr/bin/env node
// One-shot prompt-bank health check.
// For every exercise:
//   - count prompts tagged 'general'
//   - count prompts per vertical tag (sales, consulting, etc.)
//   - count total active prompts
// Flag exercises with general < 10 or total < 10.

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const VERTICALS = [
  "sales", "consulting", "finance", "healthcare",
  "law", "education", "leadership", "other",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(2);
  }
  const sql = postgres(url, { max: 4, prepare: false });

  const exercises = await sql`
    SELECT id::text, name, dimension::text AS dimension
    FROM cognify_v2.exercises
    ORDER BY dimension, name
  `;
  console.log(`Total exercises: ${exercises.length}`);

  const totals = await sql`
    SELECT exercise_id::text AS exercise_id, COUNT(*)::int AS n
    FROM cognify_v2.exercise_prompts
    WHERE is_active = true
    GROUP BY exercise_id
  `;
  const totalsMap = new Map(totals.map((r) => [r.exercise_id, r.n]));

  const generalCounts = await sql`
    SELECT exercise_id::text AS exercise_id, COUNT(*)::int AS n
    FROM cognify_v2.exercise_prompts
    WHERE is_active = true AND tags ? 'general'
    GROUP BY exercise_id
  `;
  const generalMap = new Map(generalCounts.map((r) => [r.exercise_id, r.n]));

  const verticalCounts = {};
  for (const v of VERTICALS) {
    const rows = await sql`
      SELECT exercise_id::text AS exercise_id, COUNT(*)::int AS n
      FROM cognify_v2.exercise_prompts
      WHERE is_active = true AND tags ? ${v}
      GROUP BY exercise_id
    `;
    verticalCounts[v] = new Map(rows.map((r) => [r.exercise_id, r.n]));
  }

  console.log("\n=== Per-exercise prompt counts ===");
  console.log("EXERCISE".padEnd(40) + "TOTAL".padStart(7) + "GEN".padStart(7) +
    VERTICALS.map((v) => v.slice(0,4).padStart(6)).join(""));
  console.log("-".repeat(110));

  let exercisesWithoutGeneral = 0;
  let exercisesWithLowTotal = 0;
  let exercisesWithLowGeneral = 0;

  for (const ex of exercises) {
    const total = totalsMap.get(ex.id) ?? 0;
    const gen = generalMap.get(ex.id) ?? 0;
    const flags = [];
    if (gen === 0) { flags.push("NO-GEN"); exercisesWithoutGeneral++; }
    else if (gen < 10) { flags.push("LOW-GEN"); exercisesWithLowGeneral++; }
    if (total < 10) { flags.push("LOW-TOTAL"); exercisesWithLowTotal++; }
    const label = `${ex.dimension}/${ex.name}`.slice(0,40).padEnd(40);
    const verticalsStr = VERTICALS.map((v) =>
      String(verticalCounts[v].get(ex.id) ?? 0).padStart(6)).join("");
    const flagStr = flags.length > 0 ? `  ⚠ ${flags.join(",")}` : "";
    console.log(label + String(total).padStart(7) + String(gen).padStart(7) +
      verticalsStr + flagStr);
  }

  console.log("\n=== Summary ===");
  console.log(`Total exercises: ${exercises.length}`);
  console.log(`Exercises with ZERO general prompts: ${exercisesWithoutGeneral}`);
  console.log(`Exercises with < 10 general prompts: ${exercisesWithLowGeneral}`);
  console.log(`Exercises with < 10 TOTAL prompts: ${exercisesWithLowTotal}`);

  const grandTotal = await sql`
    SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts WHERE is_active = true
  `;
  console.log(`Total active prompts in DB: ${grandTotal[0].n}`);

  const genTotal = await sql`
    SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
    WHERE is_active = true AND tags ? 'general'
  `;
  console.log(`Total general-tagged prompts: ${genTotal[0].n}`);

  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
