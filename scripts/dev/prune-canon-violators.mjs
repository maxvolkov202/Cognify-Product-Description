#!/usr/bin/env node
// Phase D — deactivate prompts that violate the design canon's banned
// patterns. Single reversible UPDATE — flips is_active=false; no rows
// are deleted. Re-running re-flips zero rows (idempotent).
//
// Canon rules violated by these patterns:
//   R1 (Repeatable on demand): "Walk the [board/CFO/IC]..." — scenario-bound
//   R3 (Vertical-flavored, not -locked): walls of jargon (MEDDPICC, Daubert)
//   Tone: second-person scenario "Imagine you just..."
//
// Run: node scripts/dev/prune-canon-violators.mjs
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false });

// Show the count before pruning so we can confirm the regex matches
// the same row-set the CTO review identified.
const [{ before }] = await sql`
  SELECT COUNT(*)::int AS before
  FROM cognify_v2.exercise_prompts
  WHERE is_active = true
    AND (
         prompt_text ~* 'walk the (board|cfo|ic|jury|audit committee|lp)'
      OR prompt_text ~* 'sentinel event'
      OR prompt_text ~* '\\mMEDDPICC\\M'
      OR prompt_text ~* '\\mDaubert\\M'
      OR prompt_text ~* 'voir dire'
      OR prompt_text ~* '\\m(LBO|MOIC)\\M'
      OR prompt_text ~* 'EBITDA bridge'
      OR prompt_text ~* 'IC memo'
    )
`;
console.log(`Active prompts matching canon-violator regex: ${before}`);

if (before === 0) {
  console.log("Nothing to do — already pruned.");
  await sql.end();
  process.exit(0);
}

// Verify post-prune that every (exercise × vertical × goal) cell will
// still have ≥5 active prompts. Otherwise the picker cascade breaks
// for some users.
const slimmestCells = await sql`
  WITH after_prune AS (
    SELECT ep.exercise_id,
           t->>'v' AS vertical,
           t->>'g' AS goal
    FROM cognify_v2.exercise_prompts ep
    CROSS JOIN LATERAL jsonb_array_elements(ep.tags) AS t
    WHERE ep.is_active = true
      AND NOT (
           ep.prompt_text ~* 'walk the (board|cfo|ic|jury|audit committee|lp)'
        OR ep.prompt_text ~* 'sentinel event'
        OR ep.prompt_text ~* '\\mMEDDPICC\\M'
        OR ep.prompt_text ~* '\\mDaubert\\M'
        OR ep.prompt_text ~* 'voir dire'
        OR ep.prompt_text ~* '\\m(LBO|MOIC)\\M'
        OR ep.prompt_text ~* 'EBITDA bridge'
        OR ep.prompt_text ~* 'IC memo'
      )
      AND t->>'v' IS NOT NULL
      AND t->>'g' IS NOT NULL
  )
  SELECT exercise_id::text, vertical, goal, COUNT(*)::int AS cnt
  FROM after_prune
  GROUP BY exercise_id, vertical, goal
  HAVING COUNT(*) < 5
  LIMIT 5
`;

if (slimmestCells.length > 0) {
  console.error("⚠ ABORTING — pruning would leave bank cells below MIN_BANK_SIZE=5:");
  for (const c of slimmestCells) {
    console.error(`  exercise=${c.exercise_id.slice(0, 8)} vertical=${c.vertical} goal=${c.goal} → ${c.cnt} remaining`);
  }
  await sql.end();
  process.exit(1);
}

const result = await sql`
  UPDATE cognify_v2.exercise_prompts
  SET is_active = false
  WHERE is_active = true
    AND (
         prompt_text ~* 'walk the (board|cfo|ic|jury|audit committee|lp)'
      OR prompt_text ~* 'sentinel event'
      OR prompt_text ~* '\\mMEDDPICC\\M'
      OR prompt_text ~* '\\mDaubert\\M'
      OR prompt_text ~* 'voir dire'
      OR prompt_text ~* '\\m(LBO|MOIC)\\M'
      OR prompt_text ~* 'EBITDA bridge'
      OR prompt_text ~* 'IC memo'
    )
`;

console.log(`Deactivated ${result.count} prompts. To reverse the exact set, re-run with the same regex against is_active=false rows and flip them back.`);

await sql.end();
