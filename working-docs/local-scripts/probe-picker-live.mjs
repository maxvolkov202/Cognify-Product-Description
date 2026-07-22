#!/usr/bin/env node
/**
 * Reproduces what fetchPromptCandidates would do for Max's user on his
 * current muscle-group day's first exercise, with personalize=true. If
 * the live server is returning what we see here, we know the picker
 * code is correct end-to-end. If the live UI shows something else,
 * the bug is in the client → server boundary (toggle flow, session,
 * caching, etc.).
 */
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const MAX_USER_ID = "1cdb5187-ac45-41b9-b76d-8c6ade19456d";
const MIN_BANK_SIZE = 5;
const LEGACY = {
  sales: ["business", "leadership"], consulting: ["business", "leadership"],
  finance: ["finance", "business"], healthcare: ["healthcare", "science"],
  law: ["business", "current events"], education: ["education", "science"],
  leadership: ["leadership", "business"], other: [],
};

const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

const [user] = await sql`
  SELECT id::text, email, vertical, improvement_goals
  FROM cognify_v2.users WHERE id = ${MAX_USER_ID}
`;
console.log("Max:", { vertical: user.vertical, goals: user.improvement_goals });

const [day] = await sql`
  SELECT id::text, day_date, dimension::text AS dimension, planned_exercise_ids
  FROM cognify_v2.muscle_group_days
  WHERE user_id = ${MAX_USER_ID}
  ORDER BY day_date DESC, created_at DESC LIMIT 1
`;
if (!day) { console.log("No muscle_group_day for this user."); process.exit(0); }
console.log("Day:", { date: day.day_date.toISOString().slice(0,10), dim: day.dimension, exercises: day.planned_exercise_ids.length });

for (const exerciseId of day.planned_exercise_ids.slice(0, 2)) {
  const [ex] = await sql`SELECT id::text, name, dimension::text AS dim FROM cognify_v2.exercises WHERE id=${exerciseId}`;
  console.log(`\n=== Exercise: ${ex.name} (${ex.dim}) ===`);

  const vertical = user.vertical;
  const goals = Array.isArray(user.improvement_goals) ? user.improvement_goals : [];
  const legacy = LEGACY[vertical] ?? [];

  // Tier 1: vertical+goal (this is what we want the picker to land on)
  const vgQuery = legacy.length > 0
    ? sql`SELECT id, prompt_id, prompt_text, difficulty, tags FROM cognify_v2.exercise_prompts
          WHERE exercise_id=${exerciseId} AND is_active=true
            AND (jsonb_exists(tags, ${vertical}) OR jsonb_exists_any(tags, ${legacy}::text[]))
            AND jsonb_exists_any(tags, ${goals}::text[])`
    : sql`SELECT id, prompt_id, prompt_text, difficulty, tags FROM cognify_v2.exercise_prompts
          WHERE exercise_id=${exerciseId} AND is_active=true
            AND jsonb_exists(tags, ${vertical})
            AND jsonb_exists_any(tags, ${goals}::text[])`;
  const vgRows = await vgQuery;
  console.log(`  Tier "vertical+goal":  ${vgRows.length} prompts`);

  if (vgRows.length >= MIN_BANK_SIZE) {
    console.log(`  → Picker WOULD return tier=vertical+goal. Sample 3:`);
    for (const r of vgRows.slice(0, 3)) {
      console.log(`    [${r.tags.join(",")}] ${r.prompt_text}`);
    }
    continue;
  }

  // Tier 2: vertical
  const vQuery = legacy.length > 0
    ? sql`SELECT * FROM cognify_v2.exercise_prompts
          WHERE exercise_id=${exerciseId} AND is_active=true
            AND (jsonb_exists(tags, ${vertical}) OR jsonb_exists_any(tags, ${legacy}::text[]))`
    : sql`SELECT * FROM cognify_v2.exercise_prompts
          WHERE exercise_id=${exerciseId} AND is_active=true
            AND jsonb_exists(tags, ${vertical})`;
  const vRows = await vQuery;
  console.log(`  Tier "vertical":      ${vRows.length} prompts`);
}

await sql.end();
