#!/usr/bin/env node
// One-shot probe: for the most recent muscle-group day's user, count
// prompts at each cascade tier the new picker actually uses:
// v+g  →  v  →  general  →  any.
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

const [day] = await sql`
  SELECT user_id::text, planned_exercise_ids
  FROM cognify_v2.muscle_group_days
  ORDER BY day_date DESC, created_at DESC LIMIT 1
`;
const [user] = await sql`
  SELECT email, vertical, improvement_goals
  FROM cognify_v2.users WHERE id = ${day.user_id}
`;
const exerciseId = day.planned_exercise_ids[0];
const vertical = user.vertical;
const goals = Array.isArray(user.improvement_goals) ? user.improvement_goals : [];

console.log(`User: ${user.email}  vertical=${vertical}  goals=${JSON.stringify(goals)}`);
console.log(`Exercise: ${exerciseId.slice(0, 8)}`);

const [a] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
  WHERE exercise_id = ${exerciseId} AND is_active = true
    AND jsonb_exists(tags, ${vertical}) AND jsonb_exists_any(tags, ${goals}::text[])`;
const [b] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
  WHERE exercise_id = ${exerciseId} AND is_active = true
    AND jsonb_exists(tags, ${vertical})`;
const [c] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
  WHERE exercise_id = ${exerciseId} AND is_active = true
    AND jsonb_exists(tags, 'general')`;
const [d] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
  WHERE exercise_id = ${exerciseId} AND is_active = true`;

console.log(`v+g    : ${a.n}`);
console.log(`v      : ${b.n}`);
console.log(`general: ${c.n}`);
console.log(`any    : ${d.n}`);

await sql.end();
