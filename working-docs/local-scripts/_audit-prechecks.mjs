#!/usr/bin/env node
// One-shot pre-check audit for the unapplied migrations 0025 + 0026 + 0027.
// READ ONLY. Reports orphan rows that would block FK ADDs, audio-retention
// first-run blast radius, and email case-variant duplicates.

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 2, prepare: false });

function header(t) { console.log(`\n══ ${t} ══`); }

try {
  header("Connection target");
  const [{ db }] = await sql`SELECT current_database() AS db`;
  console.log(`current_database: ${db}`);
  const [{ schemas }] = await sql`SELECT array_agg(schema_name) AS schemas FROM information_schema.schemata WHERE schema_name IN ('cognify_v2','public','auth')`;
  console.log(`schemas present: ${schemas.join(", ")}`);

  // ── 0025 — audio retention blast radius ───────────────────────────────
  header("0025: audio retention blast radius");
  const [totalReps] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.reps`;
  console.log(`total reps: ${totalReps.n}`);
  const [audioReps] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.reps WHERE audio_url IS NOT NULL`;
  console.log(`reps with audio_url: ${audioReps.n}`);
  const [olderThan90] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.reps WHERE audio_url IS NOT NULL AND created_at < NOW() - INTERVAL '90 days'`;
  console.log(`reps with audio_url AND older than 90 days: ${olderThan90.n}   ← first cron run would delete this many blobs`);
  const [olderThan30] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.reps WHERE audio_url IS NOT NULL AND created_at < NOW() - INTERVAL '30 days'`;
  console.log(`(for context) reps with audio AND older than 30 days: ${olderThan30.n}`);
  const oldestRows = await sql`SELECT created_at, COUNT(*)::int AS n FROM cognify_v2.reps WHERE audio_url IS NOT NULL GROUP BY 1 ORDER BY 1 ASC LIMIT 3`;
  if (oldestRows.length) {
    console.log("oldest reps with audio (sample of 3):");
    for (const r of oldestRows) console.log(`   ${r.created_at.toISOString()}  count=${r.n}`);
  }

  // ── 0026 — FK orphan pre-checks ───────────────────────────────────────
  header("0026: orphan-row pre-checks for new FKs");
  const checks = [
    {
      label: "league_membership.user_id → users.id (CASCADE)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.league_membership lm
               LEFT JOIN cognify_v2.users u ON u.id = lm.user_id
               WHERE u.id IS NULL`,
    },
    {
      label: "daily_quests.user_id → users.id (CASCADE)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.daily_quests dq
               LEFT JOIN cognify_v2.users u ON u.id = dq.user_id
               WHERE u.id IS NULL`,
    },
    {
      label: "scoring_telemetry.user_id → users.id (SET NULL)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.scoring_telemetry st
               LEFT JOIN cognify_v2.users u ON u.id = st.user_id
               WHERE st.user_id IS NOT NULL AND u.id IS NULL`,
    },
    {
      label: "scoring_telemetry.rep_id → reps.id (SET NULL)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.scoring_telemetry st
               LEFT JOIN cognify_v2.reps r ON r.id = st.rep_id
               WHERE st.rep_id IS NOT NULL AND r.id IS NULL`,
    },
    {
      label: "personal_bests.rep_id → reps.id (CASCADE)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.personal_bests pb
               LEFT JOIN cognify_v2.reps r ON r.id = pb.rep_id
               WHERE r.id IS NULL`,
    },
    {
      label: "reference_reps.source_rep_id → reps.id (SET NULL)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.reference_reps rr
               LEFT JOIN cognify_v2.reps r ON r.id = rr.source_rep_id
               WHERE rr.source_rep_id IS NOT NULL AND r.id IS NULL`,
    },
    {
      label: "users.baseline_rep_id → reps.id (SET NULL)",
      sql: sql`SELECT COUNT(*)::int AS n FROM cognify_v2.users u
               LEFT JOIN cognify_v2.reps r ON r.id = u.baseline_rep_id
               WHERE u.baseline_rep_id IS NOT NULL AND r.id IS NULL`,
    },
  ];
  let anyOrphans = false;
  for (const c of checks) {
    const [row] = await c.sql;
    const flag = row.n > 0 ? "⚠ ORPHANS — FK would fail" : "✓";
    if (row.n > 0) anyOrphans = true;
    console.log(`   ${flag.padEnd(28)} ${c.label.padEnd(60)}  orphans=${row.n}`);
  }
  if (anyOrphans) {
    console.log("\nFK ADDs require all orphan counts = 0. Each orphan row must");
    console.log("be either deleted, repointed to a valid id, or its parent row");
    console.log("recreated. Plan ordering: do this BEFORE applying 0026.");
  }

  // 0026 also converts 4 JSONB columns to native arrays. Check the
  // current type so we know what state we're starting from.
  header("0026: current JSONB column types");
  const arrayCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'cognify_v2'
      AND (
        (table_name = 'muscle_group_days' AND column_name = 'planned_exercise_ids') OR
        (table_name = 'bug_reports'      AND column_name = 'image_paths') OR
        (table_name = 'external_validations' AND column_name = 'rep_ids') OR
        (table_name = 'external_rankings'    AND column_name = 'ranking')
      )
    ORDER BY table_name, column_name
  `;
  for (const r of arrayCols) {
    console.log(`   ${r.table_name ?? ""} ${r.column_name}: data_type=${r.data_type}, udt=${r.udt_name}`);
  }
  // Verify no rows have malformed JSON arrays that would break the cast.
  const planExBad = await sql`
    SELECT COUNT(*)::int AS n
    FROM cognify_v2.muscle_group_days
    WHERE jsonb_typeof(planned_exercise_ids) <> 'array'
  `;
  console.log(`   muscle_group_days rows whose planned_exercise_ids is NOT a JSONB array: ${planExBad[0].n}  (must be 0)`);
  const repIdsBad = await sql`
    SELECT COUNT(*)::int AS n
    FROM cognify_v2.external_validations
    WHERE jsonb_typeof(rep_ids) <> 'array'
  `;
  console.log(`   external_validations rows whose rep_ids is NOT a JSONB array: ${repIdsBad[0].n}  (must be 0)`);

  // ── 0027 — email case-variant duplicates ──────────────────────────────
  header("0027: email case-variant duplicates");
  const dupes = await sql`
    SELECT lower(email) AS lower_email, COUNT(*)::int AS n, array_agg(email) AS variants
    FROM cognify_v2.users
    WHERE email IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) > 1
  `;
  if (dupes.length === 0) {
    console.log("✓ no case-variant duplicate emails in users — 0027 safe to apply");
  } else {
    console.log(`⚠ ${dupes.length} case-variant email groups — 0027 will fail UNIQUE recreate:`);
    for (const d of dupes) console.log(`     ${d.lower_email}  count=${d.n}  variants=${d.variants.join(", ")}`);
  }

  // ── Misc — feature flag state ────────────────────────────────────────
  header("Operator + sample row counts");
  const [opCount] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.users WHERE is_operator = true`;
  console.log(`operator users (is_operator=true): ${opCount.n}`);
  const [userCount] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.users`;
  console.log(`total users: ${userCount.n}`);
  const [guestCount] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.users WHERE is_guest = true`;
  console.log(`guest users: ${guestCount.n}`);
  const [authedCount] = await sql`SELECT COUNT(*)::int AS n FROM cognify_v2.users WHERE auth_user_id IS NOT NULL`;
  console.log(`auth-linked users: ${authedCount.n}`);

  console.log("\nDone.");
} catch (e) {
  console.error("pre-check failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
