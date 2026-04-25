#!/usr/bin/env node
// Verify bug-report wiring end-to-end against production:
//   1. cognify_v2.bug_status enum exists with 5 values
//   2. cognify_v2.bug_reports table + indexes exist
//   3. Supabase Storage bucket "bug-screenshots" exists and is private
//   4. List operators (users with is_operator = true)
//
// Usage: node scripts/verify-bug-reports.mjs

import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const dbUrl = process.env.DATABASE_URL;
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dbUrl || !supaUrl || !supaKey) {
  console.error("Missing DATABASE_URL or Supabase env vars in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, ssl: "require" });
const admin = createClient(supaUrl, supaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  let ok = true;

  console.log("=== Database ===");
  const enumRows = await sql`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'cognify_v2' AND t.typname = 'bug_status'
    ORDER BY e.enumsortorder
  `;
  if (enumRows.length === 0) {
    console.log("✗ bug_status enum NOT FOUND");
    ok = false;
  } else {
    console.log(`✓ bug_status enum (${enumRows.length} values): ${enumRows.map((r) => r.enumlabel).join(", ")}`);
  }

  const tableRows = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'cognify_v2' AND table_name = 'bug_reports'
    ORDER BY ordinal_position
  `;
  if (tableRows.length === 0) {
    console.log("✗ bug_reports table NOT FOUND");
    ok = false;
  } else {
    console.log(`✓ bug_reports table (${tableRows.length} columns):`);
    for (const c of tableRows) {
      console.log(`    - ${c.column_name} (${c.data_type})`);
    }
  }

  const indexRows = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'cognify_v2' AND tablename = 'bug_reports'
    ORDER BY indexname
  `;
  console.log(`✓ ${indexRows.length} indexes on bug_reports: ${indexRows.map((r) => r.indexname).join(", ")}`);

  const countRow = await sql`SELECT count(*)::int AS n FROM cognify_v2.bug_reports`;
  console.log(`  rows currently: ${countRow[0].n}`);

  console.log("\n=== Operators (users.is_operator = true) ===");
  const operators = await sql`
    SELECT id, email, name, is_operator, created_at
    FROM cognify_v2.users
    WHERE is_operator = true
    ORDER BY created_at
  `;
  if (operators.length === 0) {
    console.log("✗ NO operators set. /admin/bugs returns 404 for everyone.");
    ok = false;
  } else {
    console.log(`✓ ${operators.length} operator(s):`);
    for (const u of operators) {
      console.log(`    - ${u.email ?? "(no email)"}  name=${u.name ?? "(none)"}  id=${u.id}`);
    }
  }

  console.log("\n=== Total registered users (for context) ===");
  const total = await sql`SELECT count(*)::int AS n FROM cognify_v2.users`;
  console.log(`  total users: ${total[0].n}`);
  const nonOps = await sql`
    SELECT email, name FROM cognify_v2.users
    WHERE is_operator = false OR is_operator IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  `;
  if (nonOps.length > 0) {
    console.log(`  most recent non-operators (max 5):`);
    for (const u of nonOps) {
      console.log(`    - ${u.email ?? "(no email)"}  name=${u.name ?? "(none)"}`);
    }
  }

  console.log("\n=== Supabase Storage ===");
  const buckets = await admin.storage.listBuckets();
  if (buckets.error) {
    console.log("✗ listBuckets failed:", buckets.error.message);
    ok = false;
  } else {
    const target = buckets.data?.find((b) => b.name === "bug-screenshots");
    if (!target) {
      console.log("✗ bug-screenshots bucket NOT FOUND");
      ok = false;
    } else {
      console.log(`✓ bug-screenshots bucket exists`);
      console.log(`    public: ${target.public}`);
      console.log(`    file_size_limit: ${target.file_size_limit ?? "(default)"}`);
      console.log(`    allowed_mime_types: ${(target.allowed_mime_types ?? []).join(", ")}`);
    }
  }

  await sql.end();
  console.log(ok ? "\n✓ All checks passed." : "\n✗ One or more checks failed.");
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
