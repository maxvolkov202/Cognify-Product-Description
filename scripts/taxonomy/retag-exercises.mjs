#!/usr/bin/env node
// System Change v2 Phase 1.3 (D20) — LLM-assisted exercise re-tagging.
//
// Proposes `hidden_skills` tags from the Hidden Skill Taxonomy v2 (148
// skills) for every exercise in the catalog manifests (6 core-dimension
// files + 5 application files under scripts/exercise-catalog/v1). The
// manifests are the catalog's source of truth — after applying, run
// `node scripts/seed-exercise-catalog.mjs --apply` to sync the DB.
//
// Two-step, human-reviewable by design:
//   node scripts/taxonomy/retag-exercises.mjs            # dry-run:
//       calls the LLM, writes scripts/taxonomy/retag-proposals.json,
//       prints an old → new diff table. Manifests untouched.
//   node scripts/taxonomy/retag-exercises.mjs --apply    # applies the
//       REVIEWED proposals file to the manifests (no LLM call).
//
// Guardrails: proposals must be 2-4 valid v2 ids drawn from the
// exercise's primary dimension (preferred) or its secondary_core_skills
// dimensions; anything else is rejected and the exercise keeps its old
// tags mapped through the legacy rename map as a fallback.
//
// Provider (dry-run only): --provider openai|anthropic, default openai
// (D22 makes OpenAI primary; the Anthropic account is periodically out
// of credits). Requires the matching *_API_KEY in .env.local.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, "../exercise-catalog/v1");
const PROPOSALS_PATH = resolve(__dirname, "retag-proposals.json");
const PROVIDER = process.argv.includes("--provider")
  ? process.argv[process.argv.indexOf("--provider") + 1]
  : "openai";
const MODEL =
  PROVIDER === "anthropic"
    ? (process.env.ANTHROPIC_FRAMEWORK_MODEL ?? "claude-sonnet-4-6")
    : (process.env.OPENAI_FRAMEWORK_MODEL ??
      process.env.OPENAI_FALLBACK_MODEL ??
      "gpt-4o");

// Shared taxonomy loader (Phase 2 consolidation) — legacyMap carries
// renames only; identity mappings fall through the `?? id` at use sites.
import { loadTaxonomy, toSkillDim as canonDim } from "./lib.mjs";
const {
  skillsByDim: SKILLS_BY_DIM,
  skillById: SKILL_BY_ID,
  legacyMap,
} = loadTaxonomy();

const MANIFEST_FILES = [
  "clarity.json",
  "structure.json",
  "conciseness.json",
  "thinking_quality.json",
  "pacing.json",
  "tone.json",
  "applications/interviewing.json",
  "applications/persuasion.json",
  "applications/presenting.json",
  "applications/storytelling.json",
  "applications/teaching.json",
];

function allowedDimsFor(ex) {
  const dims = [canonDim(ex.dimension)];
  for (const d of ex.secondary_core_skills ?? []) {
    const cd = canonDim(d);
    if (!dims.includes(cd)) dims.push(cd);
  }
  return dims;
}

function validateProposal(ex, skills) {
  if (!Array.isArray(skills) || skills.length < 2 || skills.length > 4) {
    return `expected 2-4 skills, got ${JSON.stringify(skills)}`;
  }
  const allowed = new Set(
    allowedDimsFor(ex).flatMap((d) =>
      (SKILLS_BY_DIM.get(d) ?? []).map((s) => s.id),
    ),
  );
  for (const id of skills) {
    if (!SKILL_BY_ID.has(id)) return `unknown skill id: ${id}`;
    if (!allowed.has(id)) {
      return `skill ${id} outside allowed dimensions [${allowedDimsFor(ex).join(", ")}]`;
    }
  }
  if (new Set(skills).size !== skills.length) return "duplicate skill ids";
  const primaryDim = canonDim(ex.dimension);
  if (!skills.some((id) => SKILL_BY_ID.get(id).dimension === primaryDim)) {
    return `no skill from the primary dimension ${primaryDim}`;
  }
  return null;
}

/** Old-taxonomy tags folded through the rename map — the no-LLM fallback. */
function legacyFallback(ex) {
  const mapped = (ex.hidden_skills ?? [])
    .map((id) => legacyMap[id] ?? id)
    .filter((id) => SKILL_BY_ID.has(id));
  return mapped.length >= 2 ? mapped.slice(0, 4) : null;
}

function renderSkillMenu(dims) {
  return dims
    .map((d) => {
      const lines = (SKILLS_BY_DIM.get(d) ?? [])
        .map((s) => `  - ${s.id}: ${s.definition}`)
        .join("\n");
      return `${d}:\n${lines}`;
    })
    .join("\n\n");
}

function buildFilePrompt(fileLabel, exercises) {
  const blocks = exercises.map((ex, i) => {
    const dims = allowedDimsFor(ex);
    return [
      `EXERCISE ${i + 1}: ${ex.name}`,
      `PRIMARY CORE SKILL: ${canonDim(ex.dimension)}`,
      ex.application ? `APPLICATION: ${ex.application}` : null,
      `RULE: ${ex.rule}`,
      ex.why ? `WHY: ${ex.why}` : null,
      ex.objective ? `OBJECTIVE: ${ex.objective}` : null,
      ex.scoring_lens ? `SCORING LENS: ${ex.scoring_lens}` : null,
      ex.coach_insight ? `COACH INSIGHT: ${ex.coach_insight}` : null,
      `ALLOWED DIMENSIONS: ${dims.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const allDims = [...new Set(exercises.flatMap((ex) => allowedDimsFor(ex)))];

  return `You are tagging communication-training exercises with the hidden skills they train, from a fixed taxonomy.

For EACH exercise below, pick the 2-4 taxonomy skills the exercise most directly trains:
- Ids must come from the exercise's ALLOWED DIMENSIONS only.
- At least one skill must come from the PRIMARY CORE SKILL dimension.
- Pick by the skill DEFINITION, not by surface word overlap with the exercise name.
- Prefer the tightest match: the behaviors the exercise's rule/objective would visibly change in a rep.

TAXONOMY (id: definition), grouped by dimension:

${renderSkillMenu(allDims)}

EXERCISES (${fileLabel}):

${blocks.join("\n\n")}

Reply with ONLY a JSON array, one entry per exercise in order:
[{"name": "<exercise name>", "skills": ["skill_id", ...]}, ...]`;
}

function parseJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`no JSON array in response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function complete(client, prompt) {
  if (PROVIDER === "anthropic") {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    return resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  const resp = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  return resp.choices[0]?.message?.content ?? "";
}

async function proposeForFile(client, file, manifest) {
  const exercises = manifest.exercises;
  const prompt = buildFilePrompt(file, exercises);
  const text = await complete(client, prompt);
  const parsed = parseJsonArray(text);

  return exercises.map((ex, i) => {
    const entry = parsed[i];
    // Index alignment is not enough: a merged/omitted entry shifts every
    // later proposal onto its neighbor, and shifted skills still pass
    // per-dimension validation. Require the echoed name to match.
    const nameMatches = entry?.name === ex.name;
    const proposed = nameMatches ? (entry?.skills ?? null) : null;
    const error = !nameMatches
      ? `response misaligned: expected "${ex.name}", got "${entry?.name ?? "(missing)"}"`
      : proposed
        ? validateProposal(ex, proposed)
        : "no proposal returned";
    const fallback = error ? legacyFallback(ex) : null;
    return {
      file,
      name: ex.name,
      dimension: canonDim(ex.dimension),
      old: ex.hidden_skills ?? [],
      proposed: error ? (fallback ?? ex.hidden_skills ?? []) : proposed,
      source: error ? (fallback ? "legacy_fallback" : "unchanged") : "llm",
      llmError: error,
    };
  });
}

async function dryRun() {
  const keyName =
    PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  if (!process.env[keyName]) {
    console.error(`${keyName} missing — set in .env.local`);
    process.exit(1);
  }
  console.log(`[retag] provider=${PROVIDER} model=${MODEL}`);
  const client =
    PROVIDER === "anthropic"
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const all = [];
  for (const file of MANIFEST_FILES) {
    const manifest = JSON.parse(
      readFileSync(resolve(CATALOG_DIR, file), "utf8"),
    );
    console.log(`[retag] proposing ${manifest.exercises.length} exercises in ${file}…`);
    const proposals = await proposeForFile(client, file, manifest);
    all.push(...proposals);
  }

  writeFileSync(PROPOSALS_PATH, JSON.stringify({ model: MODEL, proposals: all }, null, 2));

  let changed = 0;
  for (const p of all) {
    const same =
      p.old.length === p.proposed.length &&
      p.old.every((id, i) => id === p.proposed[i]);
    if (!same) changed++;
    const flag = p.source === "llm" ? " " : ` [${p.source}${p.llmError ? `: ${p.llmError}` : ""}]`;
    console.log(
      `${same ? "  " : "* "}${p.name} (${p.dimension})${flag}\n` +
        `    old: ${p.old.join(", ") || "(none)"}\n` +
        `    new: ${p.proposed.join(", ")}`,
    );
  }
  console.log(
    `\n[retag] ${all.length} exercises, ${changed} changed. Proposals → ${PROPOSALS_PATH}`,
  );
  console.log("[retag] review, then: node scripts/taxonomy/retag-exercises.mjs --apply");
}

function apply() {
  if (!existsSync(PROPOSALS_PATH)) {
    console.error(`[retag] ${PROPOSALS_PATH} not found — run the dry-run first.`);
    process.exit(1);
  }
  const { proposals } = JSON.parse(readFileSync(PROPOSALS_PATH, "utf8"));
  const byFile = new Map();
  for (const p of proposals) {
    const arr = byFile.get(p.file) ?? [];
    arr.push(p);
    byFile.set(p.file, arr);
  }
  for (const [file, filePropList] of byFile) {
    const path = resolve(CATALOG_DIR, file);
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    const byName = new Map(filePropList.map((p) => [p.name, p]));
    let touched = 0;
    for (const ex of manifest.exercises) {
      const p = byName.get(ex.name);
      if (!p) {
        console.warn(`[retag] no proposal for "${ex.name}" in ${file} — skipped`);
        continue;
      }
      const err = validateProposal(ex, p.proposed);
      if (err) {
        console.warn(`[retag] invalid proposal for "${ex.name}" (${err}) — skipped`);
        continue;
      }
      ex.hidden_skills = p.proposed;
      touched++;
    }
    writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`[retag] ${file}: updated ${touched}/${manifest.exercises.length}`);
  }
  console.log(
    "[retag] manifests updated. Next: node scripts/seed-exercise-catalog.mjs --apply",
  );
}

if (process.argv.includes("--apply")) {
  apply();
} else {
  await dryRun();
}
