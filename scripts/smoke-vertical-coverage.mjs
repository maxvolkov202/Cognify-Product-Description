#!/usr/bin/env node
/**
 * Smoke test — verify the seeded vertical bank has coverage for realistic
 * (vertical × persona × goal) settings combinations.
 *
 * For each vertical, for each pair (persona × top-goal), count exercises
 * with ≥1 prompt matching ALL of (vertical, persona, goal).
 *
 * Pass criteria:
 *   - Every (V, P, G) where P is in PERSONAS_BY_VERTICAL[V] and G is in
 *     TOP_GOALS_BY_VERTICAL[V] should yield 54-exercise coverage.
 *   - "AnyOf-persona AnyOf-goal" (the picker's planned widening) should
 *     yield full coverage for every realistic profile.
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

// Mirror src/lib/onboarding/constants.ts (kept in sync manually).
const PERSONAS_BY_VERTICAL = {
  sales: ["economic_buyer","vp_executive","champion","client_customer","procurement","stakeholder","manager","peer"],
  consulting: ["economic_buyer","vp_executive","client_customer","stakeholder","manager","peer","champion","procurement"],
  finance: ["vp_executive","board_investor","stakeholder","client_customer","economic_buyer","procurement","manager","peer"],
  healthcare: ["patient_role","parent_guardian","care_team","peer","manager","vp_executive","stakeholder","procurement"],
  law: ["client_customer","opposing_counsel","judge_arbiter","audience_room","manager","peer","stakeholder","champion"],
  education: ["student_role","parent_guardian","audience_room","peer","manager","vp_executive","stakeholder","champion"],
  leadership: ["direct_report","skip_level","peer","vp_executive","board_investor","external_partner","stakeholder","audience_room"],
  other: ["vp_executive","manager","direct_report","client_customer","peer","stakeholder","audience_room","hiring_manager"],
};

const TOP_GOALS = {
  sales: ["handling_objections","negotiation","persuasion"],
  consulting: ["explaining","presenting","asking_questions"],
  finance: ["explaining","presenting","thinking_on_the_spot"],
  healthcare: ["explaining","asking_questions","giving_feedback"],
  law: ["thinking_on_the_spot","persuasion","asking_questions"],
  education: ["explaining","storytelling","asking_questions"],
  leadership: ["giving_feedback","persuasion","storytelling"],
  other: ["confidence","thinking_on_the_spot","explaining"],
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(2); }
  const sql = postgres(url, { max: 4, prepare: false });

  const [{ count: exerciseCount }] = await sql`SELECT COUNT(*)::int AS count FROM cognify_v2.exercises`;
  console.log(`Total exercises in DB: ${exerciseCount}\n`);

  // === A. Single-tag triple test (V AND specific P AND specific G) ===
  console.log("=== A. Strict-AND per (vertical × single persona × single goal) ===");
  console.log("Cell = exercise count with >=1 prompt matching ALL three tags.\n");

  for (const v of Object.keys(PERSONAS_BY_VERTICAL)) {
    const personas = PERSONAS_BY_VERTICAL[v];
    const goals = TOP_GOALS[v];
    console.log(`-- ${v} --`);
    const header = "persona".padEnd(20) + goals.map(g => g.padEnd(22)).join("");
    console.log(header);
    let gapCells = 0;
    let totalCells = personas.length * goals.length;
    for (const p of personas) {
      const row = [p.padEnd(20)];
      for (const g of goals) {
        const [{ n }] = await sql`
          SELECT COUNT(DISTINCT e.id)::int AS n
          FROM cognify_v2.exercises e
          JOIN cognify_v2.exercise_prompts ep ON ep.exercise_id = e.id
          WHERE ep.tags ? ${v}
            AND ep.tags ? ${p}
            AND ep.tags ? ${g}
            AND ep.is_active = true
        `;
        const marker = n === 54 ? "✓" : n >= 40 ? "~" : n >= 10 ? "." : "✗";
        if (n < 40) gapCells++;
        row.push((`${marker}${n}/${exerciseCount}`).padEnd(22));
      }
      console.log(row.join(""));
    }
    console.log(`  → ${gapCells}/${totalCells} cells below 40-exercise coverage\n`);
  }

  // === B. Widened (V AND any-of-personas AND any-of-goals) for realistic profiles ===
  console.log("\n=== B. Widened: V + any-of(user's personas) + any-of(user's top goals) ===");
  console.log("Simulates a user with 2 personas + 2 goals selected.\n");

  for (const v of Object.keys(PERSONAS_BY_VERTICAL)) {
    const allP = PERSONAS_BY_VERTICAL[v];
    const goals = TOP_GOALS[v];
    // Realistic profiles: pairs of (2 personas, 2 goals) sampled across the persona list.
    const profiles = [
      [allP.slice(0,2), goals.slice(0,2)],
      [allP.slice(2,4), goals.slice(1,3)],
      [allP.slice(4,6), [goals[0], goals[2]]],
      [allP.slice(6,8), goals.slice(0,2)],
      [[allP[0], allP[4]], [goals[0]]],
      [[allP[1], allP[5]], [goals[1], goals[2]]],
    ];
    console.log(`-- ${v} --`);
    for (const [pset, gset] of profiles) {
      const [{ n }] = await sql`
        SELECT COUNT(DISTINCT e.id)::int AS n
        FROM cognify_v2.exercises e
        JOIN cognify_v2.exercise_prompts ep ON ep.exercise_id = e.id
        WHERE ep.tags ? ${v}
          AND ep.tags ?| ${pset}
          AND ep.tags ?| ${gset}
          AND ep.is_active = true
      `;
      const marker = n === 54 ? "✓" : n >= 50 ? "~" : "✗";
      console.log(`  ${marker} n=${n}/54  personas=${JSON.stringify(pset)} goals=${JSON.stringify(gset)}`);
    }
    console.log("");
  }

  // === C. Vertical-only fallback (what the picker hits when AND too narrow) ===
  console.log("\n=== C. Vertical-only coverage (the safety net) ===");
  for (const v of Object.keys(PERSONAS_BY_VERTICAL)) {
    const [{ n }] = await sql`
      SELECT COUNT(DISTINCT e.id)::int AS n
      FROM cognify_v2.exercises e
      JOIN cognify_v2.exercise_prompts ep ON ep.exercise_id = e.id
      WHERE ep.tags ? ${v}
        AND ep.is_active = true
    `;
    const marker = n === 54 ? "✓" : "✗";
    console.log(`  ${marker} ${v.padEnd(13)} ${n}/54 exercises with >=1 vertical-tagged prompt`);
  }

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
