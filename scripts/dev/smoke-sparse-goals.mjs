#!/usr/bin/env node
/**
 * Sparse-goal smoke. The worst-case personalization scenario: a user
 * who picked exactly ONE improvement goal during onboarding. For every
 * (vertical, single-goal) pair × every exercise, walk the cascade
 * the actual picker uses (vertical+goal → vertical → general → any)
 * and assert the v+g tier lands a bank of ≥5 prompts.
 *
 * Exit 0 if 100% of cells land at v+g with ≥5; 1 if any miss.
 *
 * Mirrors src/server/actions/prompt-selection.ts cascade including the
 * LEGACY vertical-tag union — we want this smoke to reflect what the
 * production picker actually sees.
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const MIN_BANK_SIZE = 5;

const VERTICALS = [
  "sales", "consulting", "finance", "healthcare",
  "law", "education", "leadership", "other",
];
const GOALS = [
  "explaining", "handling_objections", "confidence",
  "thinking_on_the_spot", "giving_feedback", "negotiation",
  "presenting", "persuasion", "storytelling", "asking_questions",
];

// Mirror of LEGACY_VERTICAL_TAGS in prompt-selection.ts. Wave 1+2 prompts
// are tagged with the vertical id directly; the legacy Phase 2 bank used
// generic flavor tags ("business", "leadership", etc.). The picker unions
// both, so this smoke does too.
const LEGACY = {
  sales: ["business", "leadership"],
  consulting: ["business", "leadership"],
  finance: ["finance", "business"],
  healthcare: ["healthcare", "science"],
  law: ["business", "current events"],
  education: ["education", "science"],
  leadership: ["leadership", "business"],
  other: [],
};

const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

const exercises = await sql`
  SELECT id::text, name, dimension::text AS dimension
  FROM cognify_v2.exercises
  ORDER BY dimension, name
`;

const totalCells = VERTICALS.length * GOALS.length * exercises.length;
console.log(
  `Sparse-goal smoke: ${VERTICALS.length} verticals × ${GOALS.length} goals × ${exercises.length} exercises = ${totalCells} cells`,
);
console.log(`Each cell must land v+g tier with ≥${MIN_BANK_SIZE} prompts.\n`);

let failures = 0;
const tierHist = { "v+g": 0, v: 0, general: 0, any: 0, none: 0 };
const failExamples = [];

for (const vertical of VERTICALS) {
  let verticalFails = 0;
  for (const goal of GOALS) {
    for (const ex of exercises) {
      const legacy = LEGACY[vertical] ?? [];
      const vgQuery = legacy.length > 0
        ? sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
              WHERE exercise_id = ${ex.id} AND is_active = true
                AND (jsonb_exists(tags, ${vertical}) OR jsonb_exists_any(tags, ${legacy}::text[]))
                AND jsonb_exists(tags, ${goal})`
        : sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
              WHERE exercise_id = ${ex.id} AND is_active = true
                AND jsonb_exists(tags, ${vertical})
                AND jsonb_exists(tags, ${goal})`;
      const [{ n: vg }] = await vgQuery;
      if (vg >= MIN_BANK_SIZE) { tierHist["v+g"] += 1; continue; }

      // v
      const vQuery = legacy.length > 0
        ? sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
              WHERE exercise_id = ${ex.id} AND is_active = true
                AND (jsonb_exists(tags, ${vertical}) OR jsonb_exists_any(tags, ${legacy}::text[]))`
        : sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
              WHERE exercise_id = ${ex.id} AND is_active = true
                AND jsonb_exists(tags, ${vertical})`;
      const [{ n: v }] = await vQuery;
      if (v >= MIN_BANK_SIZE) {
        tierHist.v += 1;
      } else {
        const [{ n: g }] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
          WHERE exercise_id = ${ex.id} AND is_active = true AND jsonb_exists(tags, 'general')`;
        if (g >= MIN_BANK_SIZE) tierHist.general += 1;
        else {
          const [{ n: a }] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts
            WHERE exercise_id = ${ex.id} AND is_active = true`;
          tierHist[a >= MIN_BANK_SIZE ? "any" : "none"] += 1;
        }
      }
      failures += 1;
      verticalFails += 1;
      if (failExamples.length < 12) {
        failExamples.push({ vertical, goal, exercise: ex.name, vg });
      }
    }
  }
  const mark = verticalFails === 0 ? "✓" : "✗";
  console.log(`  ${mark} ${vertical.padEnd(12)} fell-through cells: ${verticalFails}`);
}

console.log(`\nTier histogram:`);
for (const [tier, n] of Object.entries(tierHist)) {
  if (n === 0) continue;
  console.log(`  ${tier.padEnd(10)} ${n}  (${((n / totalCells) * 100).toFixed(2)}%)`);
}
console.log(`\nTotal cells: ${totalCells}  |  Fell through v+g: ${failures}`);

if (failures > 0) {
  console.log(`\nFirst ${failExamples.length} fall-through examples:`);
  for (const f of failExamples) {
    console.log(`  ${f.vertical}/${f.goal} on "${f.exercise}" (v+g bank=${f.vg})`);
  }
}

await sql.end();
process.exit(failures > 0 ? 1 : 0);
