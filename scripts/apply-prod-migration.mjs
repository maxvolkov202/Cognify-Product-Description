#!/usr/bin/env node
// One-off prod migration runner. Loads .env.prod-temp explicitly so
// the regular apply-migration.mjs (.env.local) doesn't accidentally
// target dev. Usage:
//   npx vercel env pull .env.prod-temp --environment=production --yes
//   node scripts/apply-prod-migration.mjs <migration.sql>
//   rm .env.prod-temp

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.prod-temp" });

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-prod-migration.mjs <path.sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set in .env.prod-temp");
  process.exit(1);
}

const sql = readFileSync(resolve(file), "utf8");
const lines = sql.split("\n");
const enumLines = [];
const restLines = [];
for (const line of lines) {
  if (/^\s*ALTER TYPE .* ADD VALUE/i.test(line)) enumLines.push(line);
  else restLines.push(line);
}

const client = postgres(url, { max: 1, prepare: false });

try {
  console.log(`PROD migration: ${file}`);
  console.log(`Host: ${new URL(url).host}`);
  console.log(
    `Running ${enumLines.length} ALTER TYPE ADD VALUE statements (auto-commit)…`,
  );
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
