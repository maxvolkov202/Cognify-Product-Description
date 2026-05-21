#!/usr/bin/env node
/**
 * Phase 2 — seed cognify_v2.exercises + cognify_v2.exercise_prompts from
 * the manifest under scripts/exercise-catalog/v1/.
 *
 * Layout (one file per muscle group; assembled at runtime):
 *   scripts/exercise-catalog/v1/clarity.json
 *   scripts/exercise-catalog/v1/structure.json
 *   scripts/exercise-catalog/v1/conciseness.json
 *   scripts/exercise-catalog/v1/thinking_quality.json
 *   scripts/exercise-catalog/v1/pacing.json
 *   scripts/exercise-catalog/v1/tone.json
 *
 * Each file matches the shape documented in
 * scripts/exercise-catalog/README.md. The seed script reads all six,
 * validates them, then upserts:
 *
 *   exercises          ON CONFLICT (dimension, name) DO UPDATE SET ...
 *   exercise_prompts   ON CONFLICT (prompt_id) DO UPDATE SET ...
 *
 * Idempotent: re-running is a no-op for unchanged content; changes are
 * detected by a stable per-prompt sha8 hash embedded in prompt_id.
 *
 * Usage:
 *   node scripts/seed-exercise-catalog.mjs --dry-run
 *   node scripts/seed-exercise-catalog.mjs --apply
 *   node scripts/seed-exercise-catalog.mjs --dim clarity --apply
 *
 * Notes:
 * - Manifest field → DB column mapping:
 *     manifest.name             → exercises.name
 *     manifest.rule             → exercises.description   (user-facing rule)
 *     manifest.why              → exercises.instructions  (station-card body)
 *     manifest.ordering         → exercises.sort_order
 *     slug(manifest.name)       → exercises.slug
 *     manifest.default_difficulty applies to prompts that omit difficulty
 * - Difficulty mapping: intro=1, core=2, stretch=3.
 * - Canonical 6 muscle groups for this product:
 *     clarity, structure, conciseness, thinking_quality, pacing, tone.
 *   (`pacing` is enum-legacy but explicitly chosen as a muscle group
 *    by the product team — see plan decisions log.)
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, "exercise-catalog", "v1");

const CANONICAL_DIMS = new Set([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "pacing",
  "tone",
]);

const DIFFICULTY_MAP = { intro: 1, core: 2, stretch: 3 };
const VALID_DIFFICULTIES = new Set(Object.keys(DIFFICULTY_MAP));

const PROMPT_MIN = 15;
const PROMPT_MAX_CHARS = 200;
const RULE_MAX_WORDS = 12;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run") || !args.includes("--apply");
const DIM_FILTER = (() => {
  const idx = args.indexOf("--dim");
  return idx >= 0 ? args[idx + 1] : null;
})();

if (DRY_RUN && !args.includes("--dry-run")) {
  console.log("[seed-exercise-catalog] no --apply flag; defaulting to --dry-run");
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sha8(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

function loadManifest() {
  const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));
  const exercises = [];
  for (const file of files) {
    const dim = file.replace(/\.json$/, "");
    if (DIM_FILTER && dim !== DIM_FILTER) continue;
    const raw = JSON.parse(readFileSync(resolve(CATALOG_DIR, file), "utf-8"));
    if (!Array.isArray(raw.exercises)) {
      throw new Error(`${file}: missing "exercises" array`);
    }
    for (const ex of raw.exercises) {
      exercises.push({ ...ex, __source: file });
    }
  }
  return exercises;
}

function wordCount(s) {
  return s.trim().split(/\s+/).length;
}

function validate(exercises) {
  const errors = [];
  const seenByDim = new Map();
  const orderingByDim = new Map();
  const promptsByDim = new Map();

  for (const ex of exercises) {
    const where = `${ex.__source} → "${ex.name}"`;

    if (!CANONICAL_DIMS.has(ex.dimension)) {
      errors.push(`${where}: dimension "${ex.dimension}" not in canonical 6`);
    }
    if (!ex.name || typeof ex.name !== "string") {
      errors.push(`${where}: name missing`);
    }
    if (!ex.rule || typeof ex.rule !== "string") {
      errors.push(`${where}: rule missing`);
    } else if (wordCount(ex.rule) > RULE_MAX_WORDS) {
      errors.push(
        `${where}: rule has ${wordCount(ex.rule)} words (max ${RULE_MAX_WORDS})`,
      );
    }
    if (!ex.why || typeof ex.why !== "string") {
      errors.push(`${where}: why missing`);
    }
    if (!VALID_DIFFICULTIES.has(ex.default_difficulty)) {
      errors.push(
        `${where}: default_difficulty "${ex.default_difficulty}" not in {intro, core, stretch}`,
      );
    }
    if (typeof ex.ordering !== "number") {
      errors.push(`${where}: ordering must be a number`);
    }

    // ordering uniqueness within dim
    const ordKey = ex.dimension;
    if (!orderingByDim.has(ordKey)) orderingByDim.set(ordKey, new Set());
    const ordSet = orderingByDim.get(ordKey);
    if (ordSet.has(ex.ordering)) {
      errors.push(
        `${where}: ordering ${ex.ordering} duplicates another exercise in ${ex.dimension}`,
      );
    }
    ordSet.add(ex.ordering);

    // name uniqueness within dim (matches DB constraint)
    const nameKey = `${ex.dimension}::${ex.name}`;
    if (seenByDim.has(nameKey)) {
      errors.push(`${where}: duplicate (dimension, name) pair`);
    }
    seenByDim.set(nameKey, true);

    // prompts
    if (!Array.isArray(ex.prompts)) {
      errors.push(`${where}: prompts array missing`);
      continue;
    }
    if (ex.prompts.length < PROMPT_MIN) {
      errors.push(
        `${where}: ${ex.prompts.length} prompts (min ${PROMPT_MIN})`,
      );
    }
    if (!promptsByDim.has(ex.dimension)) {
      promptsByDim.set(ex.dimension, new Set());
    }
    const dimPromptSet = promptsByDim.get(ex.dimension);
    for (const [i, p] of ex.prompts.entries()) {
      const pw = `${where} prompt #${i + 1}`;
      if (!p.text || typeof p.text !== "string") {
        errors.push(`${pw}: text missing`);
        continue;
      }
      if (p.text.length > PROMPT_MAX_CHARS) {
        errors.push(`${pw}: ${p.text.length} chars (max ${PROMPT_MAX_CHARS})`);
      }
      if (p.difficulty && !VALID_DIFFICULTIES.has(p.difficulty)) {
        errors.push(
          `${pw}: difficulty "${p.difficulty}" not in {intro, core, stretch}`,
        );
      }
      const normalized = p.text.trim().toLowerCase();
      if (dimPromptSet.has(normalized)) {
        errors.push(`${pw}: duplicate text within ${ex.dimension}`);
      }
      dimPromptSet.add(normalized);
    }
  }

  return errors;
}

function summarize(exercises) {
  const byDim = new Map();
  for (const ex of exercises) {
    if (!byDim.has(ex.dimension)) {
      byDim.set(ex.dimension, { exercises: 0, prompts: 0 });
    }
    const row = byDim.get(ex.dimension);
    row.exercises += 1;
    row.prompts += ex.prompts.length;
  }
  return byDim;
}

function exerciseDiffers(existing, incoming, slug) {
  return (
    existing.slug !== slug ||
    existing.description !== incoming.rule ||
    (existing.instructions ?? null) !== (incoming.why ?? null) ||
    existing.sort_order !== incoming.ordering ||
    existing.is_active !== true
  );
}

function promptDiffers(existing, incomingText, incomingDiff, incomingTags) {
  if (existing.prompt_text !== incomingText) return true;
  if (existing.difficulty !== incomingDiff) return true;
  if (existing.is_active !== true) return true;
  const a = JSON.stringify(existing.tags ?? []);
  const b = JSON.stringify(incomingTags ?? []);
  return a !== b;
}

async function applyToDb(exercises) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[seed-exercise-catalog] DATABASE_URL not set");
    process.exit(1);
  }
  const sql = postgres(dbUrl, { max: 1, prepare: false });

  const stats = {
    exNew: 0,
    exUpdated: 0,
    exUnchanged: 0,
    promptNew: 0,
    promptUpdated: 0,
    promptUnchanged: 0,
  };

  try {
    // Prefetch existing exercises (dimension, name) → row
    const exRows = await sql`
      SELECT id, slug, name, dimension::text AS dimension,
             description, instructions, sort_order, is_active
      FROM cognify_v2.exercises
    `;
    const existingExercises = new Map();
    for (const row of exRows) {
      existingExercises.set(`${row.dimension}::${row.name}`, row);
    }

    // Prefetch existing prompts (prompt_id) → row
    const promptRows = await sql`
      SELECT id, prompt_id, exercise_id, prompt_text,
             difficulty, tags, is_active
      FROM cognify_v2.exercise_prompts
    `;
    const existingPrompts = new Map();
    for (const row of promptRows) {
      existingPrompts.set(row.prompt_id, row);
    }

    for (const ex of exercises) {
      const slug = slugify(ex.name);
      const key = `${ex.dimension}::${ex.name}`;
      const existing = existingExercises.get(key);

      let exerciseId;
      if (!existing) {
        const inserted = await sql`
          INSERT INTO cognify_v2.exercises
            (slug, name, dimension, description, instructions, sort_order, is_active)
          VALUES (
            ${slug},
            ${ex.name},
            ${ex.dimension}::cognify_v2.dimension,
            ${ex.rule},
            ${ex.why},
            ${ex.ordering},
            true
          )
          RETURNING id
        `;
        exerciseId = inserted[0].id;
        stats.exNew += 1;
      } else if (exerciseDiffers(existing, ex, slug)) {
        await sql`
          UPDATE cognify_v2.exercises SET
            slug         = ${slug},
            description  = ${ex.rule},
            instructions = ${ex.why},
            sort_order   = ${ex.ordering},
            is_active    = true
          WHERE id = ${existing.id}
        `;
        exerciseId = existing.id;
        stats.exUpdated += 1;
      } else {
        exerciseId = existing.id;
        stats.exUnchanged += 1;
      }

      const defaultDiff = DIFFICULTY_MAP[ex.default_difficulty];
      for (const p of ex.prompts) {
        const diffInt = p.difficulty
          ? DIFFICULTY_MAP[p.difficulty]
          : defaultDiff;
        const promptId = `${slug}-${sha8(p.text.trim().toLowerCase())}`;
        const tags = Array.isArray(p.tags) ? p.tags : [];
        const existingPrompt = existingPrompts.get(promptId);

        if (!existingPrompt) {
          await sql`
            INSERT INTO cognify_v2.exercise_prompts
              (exercise_id, prompt_text, prompt_id, difficulty, tags, is_active)
            VALUES (
              ${exerciseId},
              ${p.text},
              ${promptId},
              ${diffInt},
              ${sql.json(tags)},
              true
            )
          `;
          stats.promptNew += 1;
        } else if (
          promptDiffers(existingPrompt, p.text, diffInt, tags) ||
          existingPrompt.exercise_id !== exerciseId
        ) {
          await sql`
            UPDATE cognify_v2.exercise_prompts SET
              exercise_id = ${exerciseId},
              prompt_text = ${p.text},
              difficulty  = ${diffInt},
              tags        = ${sql.json(tags)},
              is_active   = true
            WHERE id = ${existingPrompt.id}
          `;
          stats.promptUpdated += 1;
        } else {
          stats.promptUnchanged += 1;
        }
      }
    }
  } finally {
    await sql.end();
  }

  return stats;
}

async function main() {
  const exercises = loadManifest();
  console.log(
    `[seed-exercise-catalog] loaded ${exercises.length} exercises from ${CATALOG_DIR}${
      DIM_FILTER ? ` (filtered to --dim ${DIM_FILTER})` : ""
    }`,
  );

  const errors = validate(exercises);
  if (errors.length) {
    console.error(`[seed-exercise-catalog] ${errors.length} validation errors:`);
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  const summary = summarize(exercises);
  console.log("[seed-exercise-catalog] per-dim summary:");
  for (const [dim, row] of summary) {
    console.log(
      `  ${dim.padEnd(18)} exercises=${row.exercises}  prompts=${row.prompts}`,
    );
  }

  if (DRY_RUN) {
    console.log("[seed-exercise-catalog] --dry-run; nothing written.");
    return;
  }

  console.log("[seed-exercise-catalog] applying to database...");
  const stats = await applyToDb(exercises);
  console.log(
    `[seed-exercise-catalog] exercises: ${stats.exNew} new, ${stats.exUpdated} updated, ${stats.exUnchanged} unchanged`,
  );
  console.log(
    `[seed-exercise-catalog] prompts:   ${stats.promptNew} new, ${stats.promptUpdated} updated, ${stats.promptUnchanged} unchanged`,
  );
  const wrote = stats.exNew + stats.exUpdated + stats.promptNew + stats.promptUpdated;
  if (wrote === 0) {
    console.log("[seed-exercise-catalog] no-op — database already in sync.");
  }
}

main().catch((err) => {
  console.error("[seed-exercise-catalog] fatal:", err);
  process.exit(1);
});
