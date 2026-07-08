#!/usr/bin/env node
/**
 * Simulate the extended picker's tier cascade for representative user
 * profiles. For each profile, walk the cascade per exercise and confirm
 * the chosen tier hits >= MIN_BANK_SIZE prompts.
 *
 * Profiles span:
 *   - Every vertical
 *   - Realistic 2-persona + 2-goal selections (matches onboarding defaults)
 *   - Edge case: persona array empty, only vertical + goals
 *   - Edge case: goal array empty, only vertical + personas
 *   - Edge case: vertical=null (anon/skipped onboarding) → general only
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const MIN_BANK_SIZE = 5;

const LEGACY = {
  sales: ["business","leadership"], consulting: ["business","leadership"],
  finance: ["finance","business"], healthcare: ["healthcare","science"],
  law: ["business","current events"], education: ["education","science"],
  leadership: ["leadership","business"], other: [],
};

const PROFILES = [
  { v: "sales", p: ["economic_buyer","champion"], g: ["handling_objections","persuasion"] },
  { v: "sales", p: ["procurement","stakeholder"], g: ["negotiation"] },
  { v: "consulting", p: ["client_customer","stakeholder"], g: ["presenting","asking_questions"] },
  { v: "consulting", p: ["manager"], g: [] },
  { v: "finance", p: ["vp_executive","board_investor"], g: ["explaining","thinking_on_the_spot"] },
  { v: "finance", p: [], g: ["presenting"] },
  { v: "healthcare", p: ["patient_role","parent_guardian"], g: ["explaining","asking_questions"] },
  { v: "healthcare", p: ["stakeholder","procurement"], g: ["explaining"] }, // worst case from smoke A
  { v: "law", p: ["client_customer","judge_arbiter"], g: ["thinking_on_the_spot","persuasion"] },
  { v: "law", p: ["champion"], g: ["asking_questions"] }, // sparse case
  { v: "education", p: ["student_role","parent_guardian"], g: ["explaining","storytelling"] },
  { v: "education", p: ["audience_room"], g: ["asking_questions"] },
  { v: "leadership", p: ["direct_report","skip_level"], g: ["giving_feedback","persuasion"] },
  { v: "leadership", p: ["stakeholder","audience_room"], g: ["storytelling"] },
  { v: "other", p: ["vp_executive","manager"], g: ["confidence","explaining"] },
  { v: "other", p: ["hiring_manager"], g: ["thinking_on_the_spot"] },
  { v: null, p: [], g: [], name: "anon/skipped onboarding" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  const sql = postgres(url, { max: 4, prepare: false });

  const exercises = await sql`SELECT id::text, dimension::text AS dimension, name FROM cognify_v2.exercises ORDER BY dimension, name`;
  console.log(`Simulating cascade for ${PROFILES.length} profiles × ${exercises.length} exercises = ${PROFILES.length*exercises.length} cells\n`);

  function buildTiers(profile) {
    const tiers = [];
    if (!profile.v) return [{ label: "general", filter: t => sql`${t} ? 'general'` }];
    const legacy = LEGACY[profile.v] || [];
    const vFilter = legacy.length > 0
      ? (t) => sql`(${t} ? ${profile.v} OR ${t} ?| ${legacy}::text[])`
      : (t) => sql`${t} ? ${profile.v}`;
    const pFilter = profile.p.length > 0 ? (t) => sql`${t} ?| ${profile.p}::text[]` : null;
    const gFilter = profile.g.length > 0 ? (t) => sql`${t} ?| ${profile.g}::text[]` : null;
    if (pFilter && gFilter) tiers.push({ label: "v+p+g", filter: t => sql`${vFilter(t)} AND ${pFilter(t)} AND ${gFilter(t)}` });
    if (pFilter) tiers.push({ label: "v+p", filter: t => sql`${vFilter(t)} AND ${pFilter(t)}` });
    if (gFilter) tiers.push({ label: "v+g", filter: t => sql`${vFilter(t)} AND ${gFilter(t)}` });
    tiers.push({ label: "v", filter: vFilter });
    tiers.push({ label: "general", filter: t => sql`${t} ? 'general'` });
    return tiers;
  }

  let totalCells = 0;
  let failedCells = 0;
  const tierHist = {};

  for (const profile of PROFILES) {
    const label = profile.name || `${profile.v||"none"}/${profile.p.join("+")||"-"}/${profile.g.join("+")||"-"}`;
    const tiers = buildTiers(profile);
    let perTier = {};
    let underMin = 0;
    for (const ex of exercises) {
      totalCells++;
      let chosen = null;
      let chosenSize = 0;
      for (const t of tiers) {
        const [{ n }] = await sql`
          SELECT COUNT(*)::int AS n FROM cognify_v2.exercise_prompts ep
          WHERE ep.exercise_id = ${ex.id}
            AND ep.is_active = true
            AND ${t.filter(sql`ep.tags`)}
        `;
        if (n >= MIN_BANK_SIZE) { chosen = t.label; chosenSize = n; break; }
        if (n > chosenSize) { chosen = t.label; chosenSize = n; }
      }
      perTier[chosen] = (perTier[chosen] || 0) + 1;
      tierHist[chosen] = (tierHist[chosen] || 0) + 1;
      if (chosenSize < MIN_BANK_SIZE) {
        underMin++;
        failedCells++;
      }
    }
    const tierSummary = Object.entries(perTier).map(([k,v]) => `${k}=${v}`).join(" ");
    console.log(`  [${underMin===0?"✓":"✗"}] ${label.padEnd(70)}  ${tierSummary}  (under-min: ${underMin})`);
  }

  console.log(`\n=== Aggregate ===`);
  console.log(`Total cells: ${totalCells} | Failed (bank size < ${MIN_BANK_SIZE}): ${failedCells}`);
  console.log(`Tier histogram:`);
  for (const [k,v] of Object.entries(tierHist).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${k.padEnd(10)} ${v}  (${(v/totalCells*100).toFixed(1)}%)`);
  }

  await sql.end();
  process.exit(failedCells > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
