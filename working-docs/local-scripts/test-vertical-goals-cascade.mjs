// Simulate a cascade without personas — only vertical + goals.
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

const exercises = await sql`SELECT id::text, name, dimension::text dim FROM cognify_v2.exercises ORDER BY dimension, name`;
const vertical = "law";
const legacy = ["business", "current events"];
const goals = ["thinking_on_the_spot","negotiation","confidence","persuasion","asking_questions","giving_feedback","explaining"];
const MIN = 5;

let vgWins = 0, vWins = 0, generalWins = 0, anyWins = 0, failed = 0;

for (const ex of exercises) {
  // v+g (with legacy union)
  const [{n: vgN}] = await sql`
    SELECT COUNT(*)::int n FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true
      AND (jsonb_exists(tags, ${vertical}) OR jsonb_exists_any(tags, ${legacy}::text[]))
      AND jsonb_exists_any(tags, ${goals}::text[])
  `;
  if (vgN >= MIN) { vgWins++; continue; }

  const [{n: vN}] = await sql`
    SELECT COUNT(*)::int n FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true
      AND (jsonb_exists(tags, ${vertical}) OR jsonb_exists_any(tags, ${legacy}::text[]))
  `;
  if (vN >= MIN) { vWins++; continue; }

  const [{n: gN}] = await sql`
    SELECT COUNT(*)::int n FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true
      AND jsonb_exists(tags, 'general')
  `;
  if (gN >= MIN) { generalWins++; continue; }

  const [{n: aN}] = await sql`
    SELECT COUNT(*)::int n FROM cognify_v2.exercise_prompts
    WHERE exercise_id = ${ex.id} AND is_active = true
  `;
  if (aN >= MIN) { anyWins++; continue; }

  failed++;
}

console.log(`Profile: vertical=law + 7 goals (no personas)`);
console.log(`  v+g (personalized) wins: ${vgWins}/${exercises.length}`);
console.log(`  v (vertical only):       ${vWins}`);
console.log(`  general fallback:        ${generalWins}`);
console.log(`  any fallback:            ${anyWins}`);
console.log(`  failed:                  ${failed}`);
console.log(`\n=> ${Math.round(vgWins / exercises.length * 100)}% of exercises personalize at v+g level`);

await sql.end();
