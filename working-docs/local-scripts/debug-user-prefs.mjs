#!/usr/bin/env node
// Dump the most recent user's vertical/personas/goals and try the
// exact picker queries against today's exercise. Identifies which
// tier (if any) is exploding.

import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

  // Latest day + its user.
  const [day] = await sql`
    SELECT id::text, user_id::text, day_date, dimension::text AS dim, planned_exercise_ids
    FROM cognify_v2.muscle_group_days
    ORDER BY day_date DESC, created_at DESC
    LIMIT 1
  `;
  if (!day) { console.log("no day"); return; }
  const userId = day.user_id;
  const exerciseId = day.planned_exercise_ids[0];

  const [user] = await sql`
    SELECT id::text, email, vertical, personas, improvement_goals
    FROM cognify_v2.users WHERE id = ${userId}
  `;
  console.log("=== User ===");
  console.log(`  id: ${user.id}`);
  console.log(`  email: ${user.email}`);
  console.log(`  vertical: ${user.vertical}`);
  console.log(`  personas (raw): ${JSON.stringify(user.personas)}`);
  console.log(`  personas typeof: ${typeof user.personas}  isArray=${Array.isArray(user.personas)}`);
  console.log(`  improvement_goals: ${JSON.stringify(user.improvement_goals)}`);
  console.log(`  goals typeof: ${typeof user.improvement_goals}  isArray=${Array.isArray(user.improvement_goals)}`);

  const personas = Array.isArray(user.personas) ? user.personas : [];
  const goals = Array.isArray(user.improvement_goals) ? user.improvement_goals : [];
  const vertical = user.vertical;

  console.log(`\n=== Trying picker tiers for exercise ${exerciseId.slice(0,8)} ===`);

  // Vertical+persona+goal
  if (vertical && personas.length > 0 && goals.length > 0) {
    try {
      const [{ n }] = await sql`
        SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
        WHERE exercise_id = ${exerciseId} AND is_active = true
          AND tags ? ${vertical}
          AND tags ?| ${personas}::text[]
          AND tags ?| ${goals}::text[]
      `;
      console.log(`  v+p+g: n=${n}`);
    } catch (e) { console.log(`  v+p+g THREW: ${e.message}`); }
  }

  // Vertical
  if (vertical) {
    try {
      const [{ n }] = await sql`
        SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
        WHERE exercise_id = ${exerciseId} AND is_active = true
          AND tags ? ${vertical}
      `;
      console.log(`  v: n=${n}`);
    } catch (e) { console.log(`  v THREW: ${e.message}`); }
  }

  // General
  try {
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
      WHERE exercise_id = ${exerciseId} AND is_active = true AND tags ? 'general'
    `;
    console.log(`  general: n=${n}`);
  } catch (e) { console.log(`  general THREW: ${e.message}`); }

  // Any
  try {
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
      WHERE exercise_id = ${exerciseId} AND is_active = true
    `;
    console.log(`  any: n=${n}`);
  } catch (e) { console.log(`  any THREW: ${e.message}`); }

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
