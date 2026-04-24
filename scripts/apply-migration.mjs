#!/usr/bin/env node
// Apply a single .sql migration file against DATABASE_URL.
// Splits ALTER TYPE ... ADD VALUE statements out of the transaction block
// (Postgres forbids using a newly-added enum value in the same tx that added it).
//
// Usage: node scripts/apply-migration.mjs drizzle/migrations/0001_v2_additive.sql

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-migration.mjs <path.sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = readFileSync(resolve(file), "utf8");

// Pull ALTER TYPE ... ADD VALUE lines out; they must commit before being used.
const lines = sql.split("\n");
const enumLines = [];
const restLines = [];
for (const line of lines) {
  if (/^\s*ALTER TYPE .* ADD VALUE/i.test(line)) enumLines.push(line);
  else restLines.push(line);
}

const client = postgres(url, { max: 1, prepare: false });

try {
  console.log(`Running ${enumLines.length} ALTER TYPE ADD VALUE statements (auto-commit)…`);
  for (const line of enumLines) {
    const stmt = line.trim().replace(/;$/, "");
    if (!stmt) continue;
    await client.unsafe(stmt);
    console.log(`  ✓ ${stmt}`);
  }

  const body = restLines.join("\n").trim();
  if (body) {
    console.log("Running remaining migration body in a single batch…");
    await client.unsafe(body);
    console.log("  ✓ body applied");
  }

  console.log("Migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
