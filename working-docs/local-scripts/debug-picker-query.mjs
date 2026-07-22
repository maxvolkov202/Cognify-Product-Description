#!/usr/bin/env node
// Replicate the exact picker query for "Explain Like I'm 12" to see what
// the server action would return.

import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

  const exerciseId = "1552dddb-cba6-4f0f-bc02-bb9bcfbd17ce"; // approximate — find by name
  const [ex] = await sql`
    SELECT id::text, name FROM cognify_v2.exercises
    WHERE name = 'Explain Like I''m 12' AND dimension = 'clarity'
  `;
  if (!ex) {
    console.log("NOT FOUND");
    return;
  }
  console.log(`Exercise: ${ex.id}  ${ex.name}`);

  // Check tag column shape
  const sample = await sql`
    SELECT id::text, prompt_text, tags, jsonb_typeof(tags) AS tag_type
    FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true
    LIMIT 5
  `;
  console.log("\n--- Sample rows ---");
  for (const row of sample) {
    console.log(`  ${row.id.slice(0,8)}  tag_type=${row.tag_type}  tags=${JSON.stringify(row.tags)}`);
    console.log(`    text: ${row.prompt_text.slice(0, 60)}...`);
  }

  // Run the EXACT picker query for general
  console.log("\n--- Picker general query ---");
  const generalRows = await sql`
    SELECT id::text, prompt_text, tags
    FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true AND tags ? 'general'
  `;
  console.log(`Returned: ${generalRows.length} rows`);
  for (const row of generalRows.slice(0, 3)) {
    console.log(`  ${row.id.slice(0,8)}  ${row.prompt_text.slice(0, 80)}`);
  }

  // Check what tags exist on this exercise
  console.log("\n--- Distinct first-tag (vertical?) values ---");
  const tagDistro = await sql`
    SELECT
      tags->>0 AS first_tag,
      COUNT(*)::int AS n
    FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true
    GROUP BY tags->>0
    ORDER BY n DESC
  `;
  for (const r of tagDistro) {
    console.log(`  ${r.first_tag ?? '(null)'}  ${r.n}`);
  }

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
