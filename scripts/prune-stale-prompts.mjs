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
 *   --orphaned --dir X   For every exercise present in catalog dir X
 *                        (e.g. applications), deactivate DB prompts whose
 *                        prompt_id is no longer in the catalog. Run AFTER
 *                        seed-exercise-catalog: rewriting a prompt's text
 *                        changes its content-hash prompt_id, so the seed
 *                        inserts the new row but never retires the old one.
 *
 *   --dry-run            Report counts, write nothing.
 *
 * Usage:
 *   node scripts/prune-stale-prompts.mjs --generated --dry-run
 *   node scripts/prune-stale-prompts.mjs --generated --orphaned --dir applications
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
const CATALOG_SUBDIR = dirIdx >= 0 ? args[dirIdx + 1] : null;

if (!DO_GENERATED && !DO_ORPHANED) {
  console.error("Nothing to do: pass --generated and/or --orphaned --dir <subdir>.");
  process.exit(1);
}
if (DO_ORPHANED && !CATALOG_SUBDIR) {
  console.error("--orphaned requires --dir <catalog subdir> (e.g. applications).");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });
const sha8 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);

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
    const dir = resolve(process.cwd(), "scripts/exercise-catalog/v1", CATALOG_SUBDIR);
    const catalogIds = new Set();
    const slugs = new Set();
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const exercises = Array.isArray(doc) ? doc : doc.exercises;
      for (const ex of exercises) {
        // Mirror seed-exercise-catalog.mjs slugify() + prompt_id derivation.
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
    console.log(`[prune] catalog ${CATALOG_SUBDIR}: ${slugs.size} exercises, ${catalogIds.size} prompt ids`);

    const dbRows = await sql`
      SELECT p.id, p.prompt_id
      FROM cognify_v2.exercise_prompts p
      JOIN cognify_v2.exercises e ON e.id = p.exercise_id
      WHERE p.is_active = true
        AND e.slug = ANY(${[...slugs]})
        AND NOT (p.tags @> '["generated"]'::jsonb)
    `;
    const orphaned = dbRows.filter((r) => !catalogIds.has(r.prompt_id));
    console.log(`[prune] active seeded prompts for these exercises: ${dbRows.length}; orphaned: ${orphaned.length}`);
    if (!DRY_RUN && orphaned.length > 0) {
      const ids = orphaned.map((r) => r.id);
      const updated = await sql`
        UPDATE cognify_v2.exercise_prompts SET is_active = false
        WHERE id = ANY(${ids})
      `;
      console.log(`[prune] deactivated ${updated.count} orphaned prompts`);
    }
  }
  if (DRY_RUN) console.log("[prune] dry-run: nothing written.");
} finally {
  await sql.end();
}
