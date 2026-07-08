#!/usr/bin/env node
/**
 * Deactivate stale exercise_prompts rows (is_active=false — never DELETE,
 * so in-flight sessions referencing a row keep working and history stays).
 *
 * Two independent modes (combine freely):
 *
 *   --generated          Deactivate every prompt tagged "generated" —
 *                        runtime generations cached before the prompt-gen
 *                        universality rules landed (2026-07-07) presume
 *                        user-specific life facts ("your band disbanded").
 *                        Fresh generations under the hardened rules refill
 *                        the banks on demand.
 *
 *   --orphaned --dir X   For every exercise present in catalog dir X,
 *                        deactivate DB prompts whose prompt_id is no longer
 *                        in the catalog. Run AFTER the matching seeder:
 *                        rewriting a prompt's text changes its content-hash
 *                        prompt_id, so the seed inserts the new row but
 *                        never retires the old one.
 *
 *                        X is comma-separable and supports:
 *                          applications  slug-hash ids (seed-exercise-catalog)
 *                          root          slug-hash ids, v1/*.json dim files
 *                          general       general-<sha8(exerciseId:text)>
 *                          vertical      vertical-<v>-<sha8(exerciseId:text)>
 *
 *   --dry-run            Report counts, write nothing.
 *
 * Usage:
 *   node scripts/prune-stale-prompts.mjs --generated --dry-run
 *   node scripts/prune-stale-prompts.mjs --generated --orphaned --dir applications
 *   node scripts/prune-stale-prompts.mjs --orphaned --dir root,general,vertical
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DO_GENERATED = args.includes("--generated");
const DO_ORPHANED = args.includes("--orphaned");
const dirIdx = args.indexOf("--dir");
const CATALOG_DIRS = dirIdx >= 0 && args[dirIdx + 1]
  ? args[dirIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const KNOWN_DIRS = new Set(["applications", "root", "general", "vertical"]);

if (!DO_GENERATED && !DO_ORPHANED) {
  console.error("Nothing to do: pass --generated and/or --orphaned --dir <dirs>.");
  process.exit(1);
}
if (DO_ORPHANED && CATALOG_DIRS.length === 0) {
  console.error("--orphaned requires --dir <dirs> (e.g. applications or root,general,vertical).");
  process.exit(1);
}
for (const d of CATALOG_DIRS) {
  if (!KNOWN_DIRS.has(d)) {
    console.error(`Unknown --dir "${d}". Known: ${[...KNOWN_DIRS].join(", ")}.`);
    process.exit(1);
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });
const sha8 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);

async function deactivateOrphans(label, dbRows, catalogIds) {
  const orphaned = dbRows.filter((r) => !catalogIds.has(r.prompt_id));
  console.log(
    `[prune] ${label}: active seeded prompts ${dbRows.length}; orphaned: ${orphaned.length}`,
  );
  if (!DRY_RUN && orphaned.length > 0) {
    const ids = orphaned.map((r) => r.id);
    const updated = await sql`
      UPDATE cognify_v2.exercise_prompts SET is_active = false
      WHERE id = ANY(${ids})
    `;
    console.log(`[prune] ${label}: deactivated ${updated.count} orphaned prompts`);
  }
}

try {
  if (DO_GENERATED) {
    const rows = await sql`
      SELECT id FROM cognify_v2.exercise_prompts
      WHERE is_active = true AND tags @> '["generated"]'::jsonb
    `;
    console.log(`[prune] generated-tagged active prompts: ${rows.length}`);
    if (!DRY_RUN && rows.length > 0) {
      const updated = await sql`
        UPDATE cognify_v2.exercise_prompts SET is_active = false
        WHERE is_active = true AND tags @> '["generated"]'::jsonb
      `;
      console.log(`[prune] deactivated ${updated.count} generated prompts`);
    }
  }

  if (DO_ORPHANED) {
    // (dimension::name) → exercise uuid, needed for the uuid-hash prompt_id
    // derivations used by seed-general-prompts / seed-vertical-prompts.
    const exerciseRows = await sql`
      SELECT id::text, name, dimension::text AS dimension
      FROM cognify_v2.exercises
    `;
    const exByKey = new Map(
      exerciseRows.map((r) => [`${r.dimension}::${r.name}`, r.id]),
    );

    for (const subdir of CATALOG_DIRS) {
      if (subdir === "applications" || subdir === "root") {
        // Slug-hash ids: mirror seed-exercise-catalog.mjs slugify() + derivation.
        // "root" = the v1 dim files themselves (v1/*.json, subdirs excluded).
        const dir = subdir === "root"
          ? resolve(process.cwd(), "scripts/exercise-catalog/v1")
          : resolve(process.cwd(), "scripts/exercise-catalog/v1", subdir);
        const catalogIds = new Set();
        const slugs = new Set();
        for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
          const doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
          const exercises = Array.isArray(doc) ? doc : doc.exercises;
          for (const ex of exercises) {
            const slug = ex.name
              .toLowerCase()
              .replace(/['']/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            slugs.add(slug);
            for (const p of ex.prompts ?? []) {
              catalogIds.add(`${slug}-${sha8(p.text.trim().toLowerCase())}`);
            }
          }
        }
        console.log(`[prune] catalog ${subdir}: ${slugs.size} exercises, ${catalogIds.size} prompt ids`);

        // Exclude generated + general-/vertical- rows: they attach to the same
        // exercises but are owned by other seeders with different id schemes.
        const dbRows = await sql`
          SELECT p.id, p.prompt_id
          FROM cognify_v2.exercise_prompts p
          JOIN cognify_v2.exercises e ON e.id = p.exercise_id
          WHERE p.is_active = true
            AND e.slug = ANY(${[...slugs]})
            AND NOT (p.tags @> '["generated"]'::jsonb)
            AND p.prompt_id NOT LIKE 'general-%'
            AND p.prompt_id NOT LIKE 'vertical-%'
        `;
        await deactivateOrphans(subdir, dbRows, catalogIds);
      } else {
        // Uuid-hash ids: general-<sha8(id:text)> / vertical-<v>-<sha8(id:text)>.
        const dir = resolve(process.cwd(), "scripts/exercise-catalog/v1", subdir);
        const catalogIds = new Set();
        const missing = [];
        for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
          const doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
          const fileDim = doc.dimension ?? null; // general files: dim at doc level
          for (const ex of doc.exercises) {
            const dim = ex.dimension ?? fileDim;
            const exerciseId = exByKey.get(`${dim}::${ex.name}`);
            if (!exerciseId) {
              missing.push(`${dim} → "${ex.name}"`);
              continue;
            }
            for (const p of ex.prompts ?? []) {
              catalogIds.add(
                subdir === "general"
                  ? `general-${sha8(`${exerciseId}:${p.text}`)}`
                  : `vertical-${doc.vertical}-${sha8(`${exerciseId}:${p.text}`)}`,
              );
            }
          }
        }
        if (missing.length > 0) {
          console.warn(`[prune] ${subdir}: ${missing.length} exercises not in DB (skipped):`);
          for (const m of missing) console.warn(`  - ${m}`);
        }
        console.log(`[prune] catalog ${subdir}: ${catalogIds.size} prompt ids`);

        const prefix = subdir === "general" ? "general-%" : "vertical-%";
        const dbRows = await sql`
          SELECT p.id, p.prompt_id
          FROM cognify_v2.exercise_prompts p
          WHERE p.is_active = true
            AND p.prompt_id LIKE ${prefix}
        `;
        await deactivateOrphans(subdir, dbRows, catalogIds);
      }
    }
  }
  if (DRY_RUN) console.log("[prune] dry-run: nothing written.");
} finally {
  await sql.end();
}
