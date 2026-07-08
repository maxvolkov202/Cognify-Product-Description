#!/usr/bin/env node
/**
 * Wave 1 — seed cognify_v2.exercise_prompts with the VERTICAL-flavored prompt
 * subset (8 verticals × 54 exercises × 10 prompts = 4,320 prompts).
 *
 * Source: scripts/exercise-catalog/v1/vertical/{vertical_id}.json (8 files).
 * Each file's shape:
 *   {
 *     "version": "v1-vertical",
 *     "vertical": "sales",
 *     "exercises": [
 *       { "dimension": "clarity",
 *         "name": "Explain Like I'm 12",
 *         "prompts": [
 *           { "text": "...", "difficulty": "core",
 *             "tags": ["sales", "<persona>", "<goal>"] }
 *         ] }
 *     ]
 *   }
 *
 * These prompts INHERIT existing exercise rows (matched by (dimension, name)).
 * Every prompt's `tags` includes the vertical id as the first entry, plus 1-2
 * persona ids and 1-2 goal ids — so the picker can filter on any combination.
 *
 * Idempotent: stable prompt_id = `vertical-${vertical}-${sha8(exerciseId:text)}`.
 * ON CONFLICT (prompt_id) DO NOTHING — re-running is safe.
 *
 * Usage:
 *   node scripts/seed-vertical-prompts.mjs --dry-run
 *   node scripts/seed-vertical-prompts.mjs --apply
 *   node scripts/seed-vertical-prompts.mjs --apply --only sales,leadership
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, "exercise-catalog", "v1", "vertical");

const CANONICAL_DIMS = new Set([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "pacing",
  "tone",
]);

const CANONICAL_VERTICALS = new Set([
  "sales",
  "consulting",
  "finance",
  "healthcare",
  "law",
  "education",
  "leadership",
  "other",
]);

const DIFFICULTY_MAP = { intro: 1, core: 2, stretch: 3 };

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run") || !args.includes("--apply");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 && args[onlyIdx + 1]
  ? new Set(args[onlyIdx + 1].split(",").map((s) => s.trim()))
  : null;

function sha8(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

function loadManifest() {
  const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));
  const out = [];
  for (const file of files) {
    const vertical = file.replace(/\.json$/, "");
    if (!CANONICAL_VERTICALS.has(vertical)) {
      throw new Error(`unknown vertical file: ${file}`);
    }
    if (ONLY && !ONLY.has(vertical)) continue;
    const raw = JSON.parse(readFileSync(resolve(CATALOG_DIR, file), "utf-8"));
    if (raw.vertical !== vertical) {
      throw new Error(`${file}: vertical field "${raw.vertical}" != filename`);
    }
    if (!Array.isArray(raw.exercises)) {
      throw new Error(`${file}: missing "exercises" array`);
    }
    for (const ex of raw.exercises) {
      if (!ex.name || !ex.dimension || !Array.isArray(ex.prompts)) {
        throw new Error(`${file} → ${ex.name}: malformed`);
      }
      if (!CANONICAL_DIMS.has(ex.dimension)) {
        throw new Error(`${file} → ${ex.name}: unknown dimension ${ex.dimension}`);
      }
      out.push({
        vertical,
        dimension: ex.dimension,
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
  const verticalsLoaded = new Set(manifest.map((ex) => ex.vertical));
  console.log(
    `Loaded ${manifest.length} exercises across ${verticalsLoaded.size} ` +
      `verticals with ${totalExpected} vertical prompts ` +
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
  const inserts = []; // { exerciseId, promptId, text, difficulty, tags, vertical }

  for (const ex of manifest) {
    const exerciseId = byKey.get(`${ex.dimension}::${ex.name}`);
    if (!exerciseId) {
      missing.push(`${ex.vertical}:${ex.dimension} → "${ex.name}"`);
      continue;
    }
    for (const p of ex.prompts) {
      const promptId = `vertical-${ex.vertical}-${sha8(`${exerciseId}:${p.text}`)}`;
      inserts.push({
        exerciseId,
        promptId,
        text: p.text,
        difficulty: DIFFICULTY_MAP[p.difficulty] ?? 2,
        tags: Array.isArray(p.tags) ? p.tags : [ex.vertical],
        vertical: ex.vertical,
      });
    }
  }

  if (missing.length > 0) {
    console.error(`Missing exercises in DB (${missing.length}):`);
    for (const m of missing) console.error(`  - ${m}`);
    await sql.end();
    process.exit(3);
  }

  // Per-vertical preview counts.
  const byVertical = {};
  for (const i of inserts) byVertical[i.vertical] = (byVertical[i.vertical] || 0) + 1;
  console.log("Per-vertical prompt counts:");
  for (const v of Object.keys(byVertical).sort()) {
    console.log(`  ${v.padEnd(13)} ${byVertical[v]}`);
  }
  console.log(`Will insert ${inserts.length} prompts.\n`);

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
    const batch = inserts.slice(i, i + BATCH).map(({ vertical: _v, ...row }) => row);
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

  // Coverage check: any (exercise × vertical) combo with <10 prompts left?
  console.log("\nCoverage check — exercises with <10 prompts per vertical:");
  const targets = ONLY
    ? [...ONLY]
    : ["sales", "consulting", "finance", "healthcare", "law", "education", "leadership", "other"];
  for (const v of targets) {
    const gaps = await sql`
      SELECT
        e.dimension::text AS dimension,
        e.name,
        COUNT(*) FILTER (WHERE ep.id IS NOT NULL)::int AS n
      FROM cognify_v2.exercises e
      LEFT JOIN cognify_v2.exercise_prompts ep
        ON ep.exercise_id = e.id AND ep.tags ? ${v}
      GROUP BY e.dimension, e.name
      HAVING COUNT(*) FILTER (WHERE ep.id IS NOT NULL) < 10
      ORDER BY e.dimension, e.name
    `;
    if (gaps.length === 0) {
      console.log(`  ${v.padEnd(13)} ✓ all exercises >= 10`);
    } else {
      console.log(`  ${v.padEnd(13)} ✗ ${gaps.length} gaps:`);
      for (const g of gaps) console.log(`    - ${g.dimension}/${g.name} (${g.n})`);
    }
  }

  // Sanity-check the per-vertical count.
  const counts = await sql`
    SELECT
      (tags->>0) AS vertical,
      COUNT(*)::int AS n
    FROM cognify_v2.exercise_prompts
    WHERE jsonb_typeof(tags) = 'array'
      AND (tags->>0) IN (
        'sales','consulting','finance','healthcare','law','education','leadership','other'
      )
    GROUP BY tags->>0
    ORDER BY tags->>0
  `;
  console.log("\nVertical-tagged prompts per vertical (first tag = vertical):");
  for (const c of counts) console.log(`  ${c.vertical.padEnd(13)} ${c.n}`);

  await sql.end();
}

main().catch((err) => {
  console.error("[seed-vertical-prompts] fatal:", err);
  process.exit(1);
});
