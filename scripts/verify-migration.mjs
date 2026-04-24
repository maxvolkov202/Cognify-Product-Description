#!/usr/bin/env node
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  const dimEnum = await client`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'cognify_v2' AND t.typname = 'dimension'
    ORDER BY enumsortorder`;
  console.log("dimension enum:", dimEnum.map((r) => r.enumlabel).join(", "));

  const sessionEnum = await client`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'cognify_v2' AND t.typname = 'session_type'
    ORDER BY enumsortorder`;
  console.log("session_type enum:", sessionEnum.map((r) => r.enumlabel).join(", "));

  const pressureEnum = await client`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'cognify_v2' AND t.typname = 'pressure_archetype'
    ORDER BY enumsortorder`;
  console.log("pressure_archetype enum:", pressureEnum.map((r) => r.enumlabel).join(", "));

  const userCols = await client`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'cognify_v2' AND table_name = 'users'
    ORDER BY ordinal_position`;
  console.log("users columns:", userCols.map((r) => r.column_name).join(", "));

  const sessionCols = await client`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'cognify_v2' AND table_name = 'practice_sessions'
    ORDER BY ordinal_position`;
  console.log("practice_sessions columns:", sessionCols.map((r) => r.column_name).join(", "));

  const repCols = await client`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'cognify_v2' AND table_name = 'reps'
    ORDER BY ordinal_position`;
  console.log("reps columns:", repCols.map((r) => r.column_name).join(", "));

  const tables = await client`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'cognify_v2' AND table_name IN ('personal_bests', 'weekly_reports')
    ORDER BY table_name`;
  console.log("new tables present:", tables.map((r) => r.table_name).join(", "));
} finally {
  await client.end();
}
