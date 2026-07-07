// Post-apply verification for prod migrations. Reads .env.prod-temp
// (same file apply-prod-migration.mjs uses; `vercel env pull` it first).
//
// Extended 2026-07-07 (Phase 16) to cover the full 0028–0039 promotion
// set — the old version only probed 0013/0014-era objects.
//
//   node scripts/verify-prod-migrations.mjs
//
// Exit 0 = every probe passed; 1 = something's missing (stop the runbook).

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.prod-temp" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing — `vercel env pull .env.prod-temp` first.");
  process.exit(1);
}
const c = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const TABLES = [
  // pre-0028 sanity (pivot base)
  "exercises",
  "exercise_prompts",
  "muscle_group_days",
  "calibration_runs",
  "score_corrections",
  // 0028–0039
  "coaching_events", // 0028
  "communication_profile", // 0030
  "prep_events", // 0032
  "critical_moments", // 0032
  "readiness_reviews", // 0032
  "weekly_challenges", // 0034
  "cron_runs", // 0038
];

const COLUMNS = [
  ["calibration_runs", "alert_sent_at"], // 0014 era
  ["reps", "attempt_kind"], // 0028
  ["reps", "parent_rep_id"], // 0028
  ["reps", "coach_focus"], // 0028
  ["exercises", "objective"], // 0029
  ["exercises", "response_window"], // 0029
  ["users", "communication_stage"], // 0030
  ["exercises", "application"], // 0031
  ["communication_profile", "applications"], // 0031
  ["exercises", "coach_insight"], // 0035
  ["exercises", "scoring_emphasis"], // 0035
  ["practice_sessions", "session_state"], // 0036
  ["users", "last_celebrated_rank_index"], // 0037
  ["critical_moments", "coach_cue"], // 0039
  ["critical_moments", "scoring_hint"], // 0039
];

let failed = 0;
const host = new URL(
  process.env.DATABASE_URL.replace(/^postgresql:/, "http:"),
).host;
console.log(`[verify] target host: ${host}`);

try {
  for (const t of TABLES) {
    const r = await c`SELECT to_regclass(${"cognify_v2." + t}) AS t`;
    const ok = r[0].t !== null;
    console.log(`${ok ? "✓" : "✗"} table cognify_v2.${t}`);
    if (!ok) failed++;
  }
  for (const [t, col] of COLUMNS) {
    const r = await c`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'cognify_v2' AND table_name = ${t} AND column_name = ${col}`;
    const ok = r.length > 0;
    console.log(`${ok ? "✓" : "✗"} column ${t}.${col}`);
    if (!ok) failed++;
  }
  // 0033 — build_a_rep mode enum value (enum name varies by era; warn only).
  const enumRows = await c`
    SELECT ty.typname FROM pg_type ty
    JOIN pg_enum e ON e.enumtypid = ty.oid
    WHERE e.enumlabel = 'build_a_rep'`;
  if (enumRows.length > 0) {
    console.log(`✓ enum '${enumRows[0].typname}' has 'build_a_rep' (0033)`);
  } else {
    console.log("✗ no enum carries 'build_a_rep' — 0033 missing");
    failed++;
  }
  const [{ n }] = await c`SELECT count(*)::int AS n FROM cognify_v2.exercises WHERE is_active = true`;
  console.log(
    `${n >= 94 ? "✓" : "⚠"} active exercises: ${n} (54 pre-seed, ≥94 after the catalog seed)`,
  );
} finally {
  await c.end();
}

if (failed > 0) {
  console.error(`\n[verify] ${failed} probe(s) FAILED — do not proceed.`);
  process.exit(1);
}
console.log("\n[verify] all probes passed.");
