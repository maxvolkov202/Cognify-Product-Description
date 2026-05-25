#!/usr/bin/env node
/**
 * Wave 2 gap audit. For every (vertical × exercise × goal) triple, count
 * active prompts where the prompt is tagged with BOTH the vertical id and
 * the goal id. Triples below THRESHOLD are gaps the sub-agents need to
 * author against.
 *
 * Matches the personalized cascade tier 1 (vertical ∧ any-of-goals) but
 * isolated to a single goal — the sparse-goal worst-case where a user
 * picks only one improvement goal during onboarding.
 *
 * Output:
 *   - per-vertical summary (gaps + average bank size at v+g)
 *   - JSON gap list at scripts/audit-gaps.json for downstream agents
 *   - exit 1 if any gap remains, 0 if every triple ≥ THRESHOLD
 */

import postgres from "postgres";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";

config({ path: ".env.local" });

const THRESHOLD = Number.parseInt(process.env.THRESHOLD ?? "3", 10);

const VERTICALS = [
  "sales", "consulting", "finance", "healthcare",
  "law", "education", "leadership", "other",
];
const GOALS = [
  "explaining", "handling_objections", "confidence",
  "thinking_on_the_spot", "giving_feedback", "negotiation",
  "presenting", "persuasion", "storytelling", "asking_questions",
];

const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

const exercises = await sql`
  SELECT id::text, slug, name, dimension::text AS dimension
  FROM cognify_v2.exercises
  ORDER BY dimension, name
`;

console.log(`Auditing ${VERTICALS.length} verticals × ${exercises.length} exercises × ${GOALS.length} goals = ${VERTICALS.length * exercises.length * GOALS.length} triples`);
console.log(`Threshold: each triple needs ≥${THRESHOLD} prompts tagged [vertical, goal]\n`);

const gaps = [];
const perVertical = Object.fromEntries(
  VERTICALS.map((v) => [v, { gaps: 0, total: 0, sumSize: 0 }]),
);

for (const vertical of VERTICALS) {
  for (const ex of exercises) {
    for (const goal of GOALS) {
      const [{ n }] = await sql`
        SELECT COUNT(*)::int AS n
        FROM cognify_v2.exercise_prompts
        WHERE exercise_id = ${ex.id}
          AND is_active = true
          AND jsonb_exists(tags, ${vertical})
          AND jsonb_exists(tags, ${goal})
      `;
      perVertical[vertical].total += 1;
      perVertical[vertical].sumSize += n;
      if (n < THRESHOLD) {
        perVertical[vertical].gaps += 1;
        gaps.push({
          vertical,
          exerciseId: ex.id,
          exerciseSlug: ex.slug,
          exerciseName: ex.name,
          dimension: ex.dimension,
          goal,
          have: n,
          need: THRESHOLD - n,
        });
      }
    }
  }
}

console.log("=== Per-vertical summary ===");
for (const v of VERTICALS) {
  const s = perVertical[v];
  const pct = ((s.gaps / s.total) * 100).toFixed(1);
  const avg = (s.sumSize / s.total).toFixed(2);
  console.log(`  ${v.padEnd(12)} gaps=${String(s.gaps).padStart(4)} / ${s.total}  (${pct}%)  avg-bank=${avg}`);
}

const totalGaps = gaps.length;
const totalTriples = VERTICALS.length * exercises.length * GOALS.length;
console.log(`\nTotal gaps: ${totalGaps} / ${totalTriples}  (${((totalGaps / totalTriples) * 100).toFixed(1)}%)`);

writeFileSync(
  "scripts/audit-gaps.json",
  JSON.stringify({ threshold: THRESHOLD, totalGaps, totalTriples, perVertical, gaps }, null, 2),
);
console.log(`Wrote scripts/audit-gaps.json`);

await sql.end();
process.exit(totalGaps > 0 ? 1 : 0);
