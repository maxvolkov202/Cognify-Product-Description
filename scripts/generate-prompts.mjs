#!/usr/bin/env node
/**
 * Bulk prompt generator for the Cognify prompt-bank expansion.
 *
 * Generates N candidate prompts for a single (bucket × theme) batch via
 * Claude Opus. Output is JSONL — one candidate per line — written under
 * scripts/generated/<bucket>_<theme>.jsonl. Triage script reads that
 * file and emits a final TS snippet of approved prompts.
 *
 * Usage:
 *   node scripts/generate-prompts.mjs <bank> <bucket> <theme> [count]
 *
 *   <bank>    workout | pressure | vertical
 *   <bucket>  for workout: rep-type id (simplify, structure, …)
 *             for pressure: archetype id (pushback, time_compression, …)
 *             for vertical: vertical id (sales, healthcare, …)
 *   <theme>   for workout: work | life | abstract
 *             for pressure: work | public | personal  (treated as setting)
 *             for vertical: ignored (use - or "all")
 *   [count]   default 100
 *
 * Examples:
 *   node scripts/generate-prompts.mjs workout simplify abstract 100
 *   node scripts/generate-prompts.mjs pressure pushback work 50
 *   node scripts/generate-prompts.mjs vertical sales - 60
 *
 * Voice exemplars are pulled from the live banks via dynamic import so
 * the generator stays grounded in the same tone the project already
 * ships. Authoring rules + anti-patterns mirror the comment headers in
 * each bank file — when those headers change, update this script too.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const [bank, bucket, themeArg, countStr] = args;
const count = Math.max(1, parseInt(countStr ?? "100", 10) || 100);

if (!bank || !bucket) {
  console.error(
    "usage: node scripts/generate-prompts.mjs <bank> <bucket> <theme> [count]",
  );
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY missing — set in .env.local");
  process.exit(1);
}

const MODEL = "claude-opus-4-7";

// ——— Authoring rules (canonical) ——————————————————————————
// Mirrored from the headers in src/lib/ai/prompts/{workout,pressure,verticals}.ts.
// Update both places when these change.

const RULES_WORKOUT = `
WORKOUT PROMPT RULES (canonical):
- Concrete: name the setting, audience, stakes. No abstract "talk about X".
- Realistic: lines a real person would actually say.
- General-life flavored: workout prompts are NOT vertical-gated. Topics
  everyone can engage with regardless of career.
- Pick one theme per prompt — don't try to cover all three at once.
- Match the rep type's framework. The bucket trains a specific drill;
  the prompt has to give the user a reason to use that drill.
`.trim();

const RULES_PRESSURE = `
PRESSURE PROMPT RULES (canonical):
- Concrete: name the setting, audience, stakes. No abstract "talk about X".
- Realistic: lines a real person would actually say.
- Archetype-clean: the pressure mechanism is visible IN the prompt, not assumed.
- Time-honest: time_compression prompts state the time budget explicitly
  (e.g. "20 seconds", "15 seconds").
- Audience-explicit: audience_switch prompts name BOTH audiences by role.
- Pushback prompts: the objection line should be a direct quote a real
  person would say — not an abstract "they push back."
`.trim();

const RULES_VERTICAL = `
VERTICAL PROMPT RULES (canonical):
- Vertical-anchored: every prompt names a stakeholder or scenario from
  the user's actual professional life.
- Realistic: a real practitioner in this vertical would face this scenario.
- Single-sentence, ≤140 chars. Imperative or scenario form ("Explain X to
  Y", "Handle Z", "Defend W"). No exposition.
`.trim();

const ANTI_PATTERNS = `
ANTI-PATTERNS (DO NOT WRITE):
- "as a [persona]" — no role-playing framing.
- "the methodology of …" / "engage with the methodology" — corporate filler.
- "talk about X" / "discuss X" — too abstract; demand a specific framing.
- "explore your thoughts on …" — no introspection prompts.
- Multi-sentence exposition that the user has to skim before seeing the
  actual prompt. The prompt itself must be the focus.
- Hedge phrases ("perhaps", "you might want to") — be direct.
`.trim();

// ——— Bank loaders ——————————————————————————————————————————

async function loadWorkoutExemplars(bucketId, theme) {
  // Use the compiled banks via tsx-style dynamic import. The bank module
  // is plain TS but Node can read the .ts source after a build OR via
  // ts-node-style loaders. Simplest path here: parse the source file
  // text and pluck a few prompts manually. Avoids spinning up tsx.
  const { readFileSync } = await import("node:fs");
  const file = resolve(
    REPO_ROOT,
    "src/lib/ai/prompts/workout.ts",
  );
  const src = readFileSync(file, "utf8");
  // Pull all `{ id: "...", text: "...", theme: "..." }` lines under the bucket
  // header. Crude but stable — the bank file is hand-formatted.
  const lines = src.split("\n");
  const inBucket = (() => {
    const start = lines.findIndex((l) => l.trim().startsWith(`${bucketId}:`));
    if (start < 0) return [];
    let end = start + 1;
    while (end < lines.length && !lines[end].trim().startsWith("],")) end++;
    return lines.slice(start, end);
  })();
  const exemplars = [];
  for (const l of inBucket) {
    const m = l.match(/text:\s*"((?:[^"\\]|\\.)*)"\s*,\s*theme:\s*"(\w+)"/);
    if (m && (theme === "all" || m[2] === theme)) {
      exemplars.push(m[1].replace(/\\"/g, '"'));
    }
  }
  // Take 6 spread evenly (first / last / middle) so we cover the voice range.
  if (exemplars.length <= 6) return exemplars;
  const picks = [exemplars[0], exemplars[exemplars.length - 1]];
  const stride = Math.floor(exemplars.length / 4);
  for (let i = 1; i <= 4; i++) picks.push(exemplars[i * stride]);
  return picks.filter(Boolean);
}

async function loadPressureExemplars(archetypeId, setting) {
  const { readFileSync } = await import("node:fs");
  const file = resolve(REPO_ROOT, "src/lib/ai/prompts/pressure.ts");
  const src = readFileSync(file, "utf8");
  const startIdx = src.indexOf(`${archetypeId}:`);
  if (startIdx < 0) return [];
  const endIdx = src.indexOf("],", startIdx);
  const block = src.slice(startIdx, endIdx);
  const exemplars = [];
  // Pressure entries are multi-line objects; pull text+setting via regex.
  const re = /setting:\s*"(\w+)"[\s\S]*?text:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(block))) {
    if (setting === "all" || m[1] === setting) {
      exemplars.push(m[2].replace(/\\"/g, '"'));
    }
  }
  return exemplars.slice(0, 6);
}

async function loadVerticalExemplars(verticalId) {
  const { readFileSync } = await import("node:fs");
  const file = resolve(REPO_ROOT, "src/lib/ai/prompts/verticals.ts");
  const src = readFileSync(file, "utf8");
  const startIdx = src.indexOf(`${verticalId}:`);
  if (startIdx < 0) return [];
  const endIdx = src.indexOf("],", startIdx);
  const block = src.slice(startIdx, endIdx);
  const exemplars = [];
  const re = /text:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(block))) exemplars.push(m[1].replace(/\\"/g, '"'));
  return exemplars.slice(0, 6);
}

// ——— Generator —————————————————————————————————————————————

function buildPrompt({ bank, bucket, theme, exemplars, count }) {
  const rules =
    bank === "workout"
      ? RULES_WORKOUT
      : bank === "pressure"
        ? RULES_PRESSURE
        : RULES_VERTICAL;

  const themeLine =
    bank === "workout"
      ? `THEME: ${theme} — every prompt MUST fit this theme.\n  - work: workplace setting, professional audience, work stakes.\n  - life: personal life, health, habits, relationships, self-improvement.\n  - abstract: idea-driven, no specific setting. Debate / "why does X matter" / "explain X conceptually".`
      : bank === "pressure"
        ? `SETTING: ${theme} — every prompt MUST fit this setting.\n  - work: in-office, with colleagues / managers / customers / boards.\n  - public: external visibility — interviews, press, conferences, networking.\n  - personal: outside work — partners, family, friends, life decisions.`
        : `VERTICAL: ${bucket}. Every prompt names a stakeholder or scenario the practitioner actually faces.`;

  const exemplarList = exemplars
    .map((e, i) => `${i + 1}. ${e}`)
    .join("\n");

  return `You are a prompt-author for Cognify, a public-speaking training app. Your job: write ${count} new prompts that match the existing voice exactly.

BUCKET: ${bucket} (bank: ${bank})
${themeLine}

${rules}

${ANTI_PATTERNS}

VOICE EXEMPLARS (the existing prompts you must match in tone, length, and specificity):
${exemplarList}

Write ${count} new prompts now. Output as a numbered list (1. … 2. … etc.). One prompt per line. No commentary, no headers, no preamble — just the numbered list. Do not duplicate the exemplars. Do not write prompts that are slight rewordings of each other.`;
}

function parseNumberedList(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const out = [];
  for (const l of lines) {
    const m = l.match(/^\d+[.)]\s*(.+)$/);
    if (m && m[1]) out.push(m[1].trim().replace(/^["“]|["”]$/g, ""));
  }
  return out;
}

async function generate() {
  const exemplars =
    bank === "workout"
      ? await loadWorkoutExemplars(bucket, themeArg ?? "all")
      : bank === "pressure"
        ? await loadPressureExemplars(bucket, themeArg ?? "all")
        : await loadVerticalExemplars(bucket);

  if (exemplars.length === 0) {
    console.error(
      `[generate-prompts] No exemplars found for ${bank}/${bucket}/${themeArg}. Bucket id may be wrong.`,
    );
    process.exit(1);
  }

  console.log(
    `[generate-prompts] ${bank}/${bucket}/${themeArg ?? "-"} — ${count} candidates against ${exemplars.length} exemplars`,
  );

  const userPrompt = buildPrompt({
    bank,
    bucket,
    theme: themeArg,
    exemplars,
    count,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const candidates = parseNumberedList(text);

  if (candidates.length === 0) {
    console.error("[generate-prompts] Model returned no parseable candidates.");
    console.error("Raw response:\n" + text.slice(0, 500));
    process.exit(1);
  }

  const outDir = resolve(REPO_ROOT, "scripts/generated");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const themeSlug = themeArg ?? "all";
  const outFile = resolve(outDir, `${bank}_${bucket}_${themeSlug}.jsonl`);
  const lines = candidates.map((text, i) =>
    JSON.stringify({
      candidateId: `${bucket}_${themeSlug}_cand_${String(i + 1).padStart(3, "0")}`,
      text,
      bank,
      bucket,
      theme: themeSlug,
      generatedAt: new Date().toISOString(),
    }),
  );
  writeFileSync(outFile, lines.join("\n") + "\n", "utf8");

  console.log(
    `[generate-prompts] wrote ${candidates.length} candidates to ${outFile}`,
  );
  console.log(
    `[generate-prompts] next: node scripts/triage-prompts.mjs ${outFile}`,
  );
}

generate().catch((err) => {
  console.error("[generate-prompts] failed:", err);
  process.exit(1);
});
