#!/usr/bin/env node
/**
 * Phase HB-1 — seed cognify_v2.exercise_prompts with the GENERAL prompt
 * subset (1,080 prompts: 54 exercises × 20 each).
 *
 * Source: scripts/exercise-catalog/v1/general/{dim}.json (6 files).
 * Each file's shape:
 *   {
 *     "version": "v1-general",
 *     "dimension": "clarity",
 *     "exercises": [
 *       { "name": "Explain Like I'm 12",
 *         "prompts": [{ "text": "...", "difficulty": "core", "tags": ["general"] }] }
 *     ]
 *   }
 *
 * The general prompts INHERIT the existing exercise rows (matched by
 * (dimension, name)) — they're additional prompts, not new exercises.
 * Every prompt gets tags=["general"] (already in the source file) so the
 * picker can filter on that tag.
 *
 * Idempotent: stable prompt_id = sha8(exerciseId + ":" + promptText).
 * ON CONFLICT (prompt_id) DO NOTHING — re-running is safe.
 *
 * Usage:
 *   node scripts/seed-general-prompts.mjs --dry-run
 *   node scripts/seed-general-prompts.mjs --apply
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, "exercise-catalog", "v1", "general");

const CANONICAL_DIMS = new Set([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "pacing",
  "tone",
]);

const DIFFICULTY_MAP = { intro: 1, core: 2, stretch: 3 };

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run") || !args.includes("--apply");

function sha8(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

function loadManifest() {
  const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));
  const out = [];
  for (const file of files) {
    const dim = file.replace(/\.json$/, "");
    if (!CANONICAL_DIMS.has(dim)) {
      throw new Error(`unknown dim file: ${file}`);
    }
    const raw = JSON.parse(readFileSync(resolve(CATALOG_DIR, file), "utf-8"));
    if (!Array.isArray(raw.exercises)) {
      throw new Error(`${file}: missing "exercises" array`);
    }
    for (const ex of raw.exercises) {
      if (!ex.name || !Array.isArray(ex.prompts)) {
        throw new Error(`${file} → ${ex.name}: malformed`);
      }
      out.push({
        dimension: dim,
        name: ex.name,
        prompts: ex.prompts,
      });
    }
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(2);
  }
  const sql = postgres(url, { max: 4, prepare: false });

  const manifest = loadManifest();
  const totalExpected = manifest.reduce((n, ex) => n + ex.prompts.length, 0);
  console.log(
    `Loaded ${manifest.length} exercises with ${totalExpected} general prompts ` +
      `(mode: ${DRY_RUN ? "dry-run" : "apply"}).\n`,
  );

  // Hydrate existing exercises so we can map (dimension, name) → id.
  const exerciseRows = await sql`
    SELECT id::text, name, dimension::text AS dimension
    FROM cognify_v2.exercises
  `;
  const byKey = new Map(
    exerciseRows.map((r) => [`${r.dimension}::${r.name}`, r.id]),
  );

  const missing = [];
  const inserts = []; // { exerciseId, promptId, text, difficulty, tags }

  for (const ex of manifest) {
    const exerciseId = byKey.get(`${ex.dimension}::${ex.name}`);
    if (!exerciseId) {
      missing.push(`${ex.dimension} → "${ex.name}"`);
      continue;
    }
    for (const p of ex.prompts) {
      const promptId = `general-${sha8(`${exerciseId}:${p.text}`)}`;
      inserts.push({
        exerciseId,
        promptId,
        text: p.text,
        difficulty: DIFFICULTY_MAP[p.difficulty] ?? 2,
        tags: Array.isArray(p.tags) ? p.tags : ["general"],
      });
    }
  }

  if (missing.length > 0) {
    console.error(`Missing exercises in DB (${missing.length}):`);
    for (const m of missing) console.error(`  - ${m}`);
    await sql.end();
    process.exit(3);
  }

  console.log(`Will insert ${inserts.length} prompts.`);

  if (DRY_RUN) {
    console.log("[dry-run] no writes performed.");
    console.log("Sample insert:", inserts[0]);
    await sql.end();
    return;
  }

  // Bulk insert with conflict skip on prompt_id (unique).
  let inserted = 0;
  let skipped = 0;
  const BATCH = 100;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH);
    const result = await sql`
      INSERT INTO cognify_v2.exercise_prompts
        (exercise_id, prompt_text, prompt_id, difficulty, tags, is_active)
      SELECT
        (row->>'exerciseId')::uuid,
        row->>'text',
        row->>'promptId',
        (row->>'difficulty')::int,
        (row->'tags')::jsonb,
        true
      FROM jsonb_array_elements(${sql.json(batch)}::jsonb) AS row
      ON CONFLICT (prompt_id) DO NOTHING
      RETURNING id
    `;
    inserted += result.length;
    skipped += batch.length - result.length;
    process.stdout.write(
      `  batch ${i / BATCH + 1}/${Math.ceil(inserts.length / BATCH)}: ` +
        `+${result.length} inserted, ${batch.length - result.length} skipped\n`,
    );
  }

  console.log(`\nDone. Inserted ${inserted}, skipped ${skipped} (already present).`);

  // Sanity-check the per-dim count of general prompts.
  const counts = await sql`
    SELECT e.dimension::text AS dimension, COUNT(*)::int AS n
    FROM cognify_v2.exercise_prompts ep
    JOIN cognify_v2.exercises e ON e.id = ep.exercise_id
    WHERE ep.tags ? 'general'
    GROUP BY e.dimension
    ORDER BY e.dimension
  `;
  console.log("\nGeneral-tagged prompts per dim:");
  for (const c of counts) console.log(`  ${c.dimension.padEnd(20)} ${c.n}`);

  await sql.end();
}

main().catch((err) => {
  console.error("[seed-general-prompts] fatal:", err);
  process.exit(1);
});
