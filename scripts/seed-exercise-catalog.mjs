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
import { loadTaxonomy, toSkillDim } from "./taxonomy/lib.mjs";

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

// System Change v2 Phase 1 (D20) — Exercise Framework validation reads
// the Hidden Skill Taxonomy v2 (148 skills) via the shared loader
// (scripts/taxonomy/lib.mjs), the same source src/types/sub-skills.ts is
// generated from. The `pacing` muscle group maps to the `delivery`
// dimension's skills. hidden_skills may draw from the exercise's PRIMARY
// dimension plus its secondary_core_skills dimensions (mirrors
// scripts/taxonomy/retag-exercises.mjs), and must include ≥1
// primary-dimension skill.
const { skillIdsByDim } = loadTaxonomy();
const SUB_SKILLS_BY_SKILL_DIM = Object.fromEntries(skillIdsByDim);
const VALID_CONSTRAINT_TYPES = new Set(["time", "structure", "tone", "complexity", "none"]);

// PRD v3 Phase 4 — Skill Lab applications. Mirrors
// src/types/application-skills.ts (TS module is source of truth).
const APPLICATION_SKILLS = {
  storytelling: ["establishing_stakes", "narrative_tension", "concrete_detail", "showing_change", "clear_takeaway", "balancing_context_action", "making_listener_care", "connecting_to_broader_point"],
  presenting: ["framing_main_message", "through_line", "memorable_chunks", "signposting_transitions", "explaining_evidence", "adapting_to_audience", "closing_implication", "concretizing_abstraction"],
  teaching: ["simplifying_complexity", "explaining_with_analogy", "known_to_unknown", "anticipating_confusion", "defining_terms", "examples_and_nonexamples", "teaching_for_application", "adjusting_depth"],
  interviewing: ["evidence_based_answers", "concise_personal_examples", "self_awareness", "explaining_motivation", "handling_weakness_questions", "connecting_to_fit", "judgment_under_pressure", "credible_specifics"],
  persuasion: ["framing_recommendation", "handling_objections", "audience_priorities", "building_credibility", "selective_evidence", "calibrated_urgency", "warmth_and_conviction", "clear_ask"],
  // Phase 2B.3 (D23) — relocated System A pressure bank. One exercise per
  // pressure archetype (src/lib/ai/pressure-archetypes.ts); application
  // 'pressure' keeps these out of Daily Workout (application IS NULL) and
  // Skill Lab (application = one of the five apps) queries. The lab
  // planner looks them up by archetype id via application_skills.
  pressure: ["pushback", "time_compression", "audience_switch", "clarifying_interrupt", "stakes_raise"],
};
/** Application prompt banks may start slimmer than the core catalogs. */
const APP_PROMPT_MIN = 12;

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
  // PRD v3 Phase 4 — Skill Lab application catalogs live in
  // applications/{applicationId}.json. Each exercise carries
  // `application` + `application_skills` + `dimension` (its PRIMARY
  // core skill). --dim also filters by application id.
  const appsDir = resolve(CATALOG_DIR, "applications");
  let appFiles = [];
  try {
    appFiles = readdirSync(appsDir).filter((f) => f.endsWith(".json"));
  } catch {
    appFiles = []; // no applications dir yet — fine
  }
  for (const file of appFiles) {
    const appId = file.replace(/\.json$/, "");
    if (DIM_FILTER && appId !== DIM_FILTER) continue;
    const raw = JSON.parse(readFileSync(resolve(appsDir, file), "utf-8"));
    if (!Array.isArray(raw.exercises)) {
      throw new Error(`applications/${file}: missing "exercises" array`);
    }
    for (const ex of raw.exercises) {
      exercises.push({ ...ex, __source: `applications/${file}` });
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

    // PRD v3 Phase 2.2 — Exercise Framework fields. All optional (legacy
    // manifests validate unchanged), but when present they must be sound.
    if (ex.objective != null && typeof ex.objective !== "string") {
      errors.push(`${where}: objective must be a string`);
    }
    if (ex.hidden_skills != null) {
      const allowedDims = [
        toSkillDim(ex.dimension),
        ...(ex.secondary_core_skills ?? []).map(toSkillDim),
      ];
      const valid = new Set(
        allowedDims.flatMap((d) => SUB_SKILLS_BY_SKILL_DIM[d] ?? []),
      );
      const primary = new Set(
        SUB_SKILLS_BY_SKILL_DIM[toSkillDim(ex.dimension)] ?? [],
      );
      if (!Array.isArray(ex.hidden_skills) || ex.hidden_skills.length === 0) {
        errors.push(`${where}: hidden_skills must be a non-empty array`);
      } else {
        for (const s of ex.hidden_skills) {
          if (!valid.has(s)) {
            errors.push(
              `${where}: hidden_skill "${s}" not in taxonomy v2 for dims [${allowedDims.join(", ")}]`,
            );
          }
        }
        if (!ex.hidden_skills.some((s) => primary.has(s))) {
          errors.push(
            `${where}: hidden_skills has no skill from the primary dimension ${toSkillDim(ex.dimension)}`,
          );
        }
      }
    }
    if (ex.scoring_lens != null && typeof ex.scoring_lens !== "string") {
      errors.push(`${where}: scoring_lens must be a string`);
    }
    if (ex.retry_objective != null && typeof ex.retry_objective !== "string") {
      errors.push(`${where}: retry_objective must be a string`);
    }
    if (ex.prompt_rules != null && typeof ex.prompt_rules !== "string") {
      errors.push(`${where}: prompt_rules must be a string`);
    }
    // Phase 11.D2/D3 — Lab Engine V1 pack fields (all optional).
    if (ex.coach_insight != null && typeof ex.coach_insight !== "string") {
      errors.push(`${where}: coach_insight must be a string`);
    }
    if (ex.secondary_core_skills != null) {
      if (!Array.isArray(ex.secondary_core_skills)) {
        errors.push(`${where}: secondary_core_skills must be an array`);
      } else {
        for (const d of ex.secondary_core_skills) {
          if (!CANONICAL_DIMS.has(d) && d !== "delivery") {
            errors.push(
              `${where}: secondary_core_skill "${d}" is not a Core Skill dimension`,
            );
          }
          if (d === ex.dimension) {
            errors.push(
              `${where}: secondary_core_skill "${d}" duplicates the primary dimension`,
            );
          }
        }
      }
    }
    if (ex.common_failure_modes != null) {
      if (
        !Array.isArray(ex.common_failure_modes) ||
        ex.common_failure_modes.some((m) => typeof m !== "string")
      ) {
        errors.push(`${where}: common_failure_modes must be a string array`);
      }
    }
    if (ex.scoring_emphasis != null && typeof ex.scoring_emphasis !== "string") {
      errors.push(`${where}: scoring_emphasis must be a string`);
    }
    if (ex.response_window != null) {
      const w = ex.response_window;
      if (
        typeof w !== "object" ||
        typeof w.min_sec !== "number" ||
        typeof w.max_sec !== "number" ||
        w.min_sec < 10 ||
        w.max_sec > 300 ||
        w.min_sec >= w.max_sec
      ) {
        errors.push(
          `${where}: response_window must be {min_sec, max_sec} with 10 <= min < max <= 300`,
        );
      }
    }
    if (ex.constraint_types != null) {
      if (!Array.isArray(ex.constraint_types)) {
        errors.push(`${where}: constraint_types must be an array`);
      } else {
        for (const c of ex.constraint_types) {
          if (!VALID_CONSTRAINT_TYPES.has(c)) {
            errors.push(`${where}: constraint_type "${c}" invalid`);
          }
        }
      }
    }

    // PRD v3 Phase 4 — application-exercise validation.
    if (ex.application != null) {
      const validSkills = APPLICATION_SKILLS[ex.application];
      if (!validSkills) {
        errors.push(`${where}: unknown application "${ex.application}"`);
      } else {
        if (
          !Array.isArray(ex.application_skills) ||
          ex.application_skills.length === 0
        ) {
          errors.push(`${where}: application_skills must be a non-empty array`);
        } else {
          for (const s of ex.application_skills) {
            if (!validSkills.includes(s)) {
              errors.push(
                `${where}: application_skill "${s}" not in ${ex.application}'s canonical set`,
              );
            }
          }
        }
      }
    } else if (ex.application_skills != null) {
      errors.push(`${where}: application_skills set without application`);
    }

    // ordering uniqueness within dim (core) / application (Skill Lab)
    const ordKey = ex.application ?? ex.dimension;
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
    const promptMin = ex.application != null ? APP_PROMPT_MIN : PROMPT_MIN;
    if (ex.prompts.length < promptMin) {
      errors.push(
        `${where}: ${ex.prompts.length} prompts (min ${promptMin})`,
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

// Framework-field bundle for insert/update/compare. Snake_case JSON
// manifest fields → camel bundle → DB columns.
function frameworkFields(ex) {
  return {
    objective: ex.objective ?? null,
    hiddenSkills: Array.isArray(ex.hidden_skills) ? ex.hidden_skills : null,
    scoringLens: ex.scoring_lens ?? null,
    retryObjective: ex.retry_objective ?? null,
    promptRules: ex.prompt_rules ?? null,
    responseWindow: ex.response_window
      ? { minSec: ex.response_window.min_sec, maxSec: ex.response_window.max_sec }
      : null,
    constraintTypes: Array.isArray(ex.constraint_types)
      ? ex.constraint_types
      : null,
    application: ex.application ?? null,
    applicationSkills: Array.isArray(ex.application_skills)
      ? ex.application_skills
      : null,
    coachInsight: ex.coach_insight ?? null,
    secondaryCoreSkills: Array.isArray(ex.secondary_core_skills)
      ? ex.secondary_core_skills
      : null,
    commonFailureModes: Array.isArray(ex.common_failure_modes)
      ? ex.common_failure_modes
      : null,
    scoringEmphasis: ex.scoring_emphasis ?? null,
  };
}

// Key-stable deep equality: Postgres jsonb returns object keys in its
// own storage order (length, then bytewise), so a naive JSON.stringify
// comparison flags every row as changed and breaks idempotency.
function stableStringify(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (typeof v === "object") {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

function jsonEq(a, b) {
  return stableStringify(a ?? null) === stableStringify(b ?? null);
}

function exerciseDiffers(existing, incoming, slug) {
  const fw = frameworkFields(incoming);
  return (
    existing.slug !== slug ||
    existing.description !== incoming.rule ||
    (existing.instructions ?? null) !== (incoming.why ?? null) ||
    existing.sort_order !== incoming.ordering ||
    existing.is_active !== true ||
    (existing.objective ?? null) !== fw.objective ||
    !jsonEq(existing.hidden_skills, fw.hiddenSkills) ||
    (existing.scoring_lens ?? null) !== fw.scoringLens ||
    (existing.retry_objective ?? null) !== fw.retryObjective ||
    (existing.prompt_rules ?? null) !== fw.promptRules ||
    !jsonEq(existing.response_window, fw.responseWindow) ||
    !jsonEq(existing.constraint_types, fw.constraintTypes) ||
    (existing.application ?? null) !== fw.application ||
    !jsonEq(existing.application_skills, fw.applicationSkills) ||
    (existing.coach_insight ?? null) !== fw.coachInsight ||
    !jsonEq(existing.secondary_core_skills, fw.secondaryCoreSkills) ||
    !jsonEq(existing.common_failure_modes, fw.commonFailureModes) ||
    (existing.scoring_emphasis ?? null) !== fw.scoringEmphasis
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
  // Phase 16 interlock: this script legitimately runs against PROD, so
  // make the target unmistakable in the transcript before any write.
  const host = new URL(dbUrl.replace(/^postgresql:/, "http:")).host;
  console.log(`[seed-exercise-catalog] TARGET DATABASE HOST: ${host}`);
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
             description, instructions, sort_order, is_active,
             objective, hidden_skills, scoring_lens, retry_objective,
             prompt_rules, response_window, constraint_types,
             application, application_skills,
             coach_insight, secondary_core_skills, common_failure_modes,
             scoring_emphasis
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

      const fw = frameworkFields(ex);
      let exerciseId;
      if (!existing) {
        const inserted = await sql`
          INSERT INTO cognify_v2.exercises
            (slug, name, dimension, description, instructions, sort_order, is_active,
             objective, hidden_skills, scoring_lens, retry_objective,
             prompt_rules, response_window, constraint_types,
             application, application_skills,
             coach_insight, secondary_core_skills, common_failure_modes,
             scoring_emphasis)
          VALUES (
            ${slug},
            ${ex.name},
            ${ex.dimension}::cognify_v2.dimension,
            ${ex.rule},
            ${ex.why},
            ${ex.ordering},
            true,
            ${fw.objective},
            ${fw.hiddenSkills ? sql.json(fw.hiddenSkills) : null},
            ${fw.scoringLens},
            ${fw.retryObjective},
            ${fw.promptRules},
            ${fw.responseWindow ? sql.json(fw.responseWindow) : null},
            ${fw.constraintTypes ? sql.json(fw.constraintTypes) : null},
            ${fw.application},
            ${fw.applicationSkills ? sql.json(fw.applicationSkills) : null},
            ${fw.coachInsight},
            ${fw.secondaryCoreSkills ? sql.json(fw.secondaryCoreSkills) : null},
            ${fw.commonFailureModes ? sql.json(fw.commonFailureModes) : null},
            ${fw.scoringEmphasis}
          )
          RETURNING id
        `;
        exerciseId = inserted[0].id;
        stats.exNew += 1;
      } else if (exerciseDiffers(existing, ex, slug)) {
        await sql`
          UPDATE cognify_v2.exercises SET
            slug             = ${slug},
            description      = ${ex.rule},
            instructions     = ${ex.why},
            sort_order       = ${ex.ordering},
            is_active        = true,
            objective        = ${fw.objective},
            hidden_skills    = ${fw.hiddenSkills ? sql.json(fw.hiddenSkills) : null},
            scoring_lens     = ${fw.scoringLens},
            retry_objective  = ${fw.retryObjective},
            prompt_rules     = ${fw.promptRules},
            response_window  = ${fw.responseWindow ? sql.json(fw.responseWindow) : null},
            constraint_types = ${fw.constraintTypes ? sql.json(fw.constraintTypes) : null},
            application      = ${fw.application},
            application_skills = ${fw.applicationSkills ? sql.json(fw.applicationSkills) : null},
            coach_insight    = ${fw.coachInsight},
            secondary_core_skills = ${fw.secondaryCoreSkills ? sql.json(fw.secondaryCoreSkills) : null},
            common_failure_modes  = ${fw.commonFailureModes ? sql.json(fw.commonFailureModes) : null},
            scoring_emphasis = ${fw.scoringEmphasis}
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
