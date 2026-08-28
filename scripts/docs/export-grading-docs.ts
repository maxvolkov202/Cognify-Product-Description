/**
 * WS9 — regenerate the verbatim blocks in the team-readable grading docs
 * (~/Documents/Projects/Cognify grading docs/01–04) from the live code, so
 * the docs can never drift from the prompt bytes again.
 *
 *   npx tsx scripts/docs/export-grading-docs.ts [docsDir]
 *
 * Replaces the first ```text fenced block in 01 (system prompt), 02
 * (RUBRIC block), 03 (SCORING KNOWLEDGE) and 04 (SUB-SKILL REFERENCE) with
 * the text buildSystemBlocks() emits today, and stamps the date.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { buildSystemBlocks, COMPACT_RUBRIC_WITH_ANCHORS } from "@/lib/ai/score-shared";

const dir = process.argv[2] ?? resolve(homedir(), "Documents/Projects/Cognify grading docs");
const blocks = buildSystemBlocks({ rubricBlock: COMPACT_RUBRIC_WITH_ANCHORS }).map((b) =>
  typeof b === "string" ? b : ((b as { text?: string }).text ?? ""),
);
const today = new Date().toISOString().slice(0, 10);
const targets: [string, number][] = [
  ["01-system-prompt.md", 0],
  ["02-live-rubrics-and-band-anchors.md", 1],
  ["03-scoring-knowledge.md", 2],
  ["04-sub-skill-reference.md", 3],
];
for (const [file, idx] of targets) {
  const path = resolve(dir, file);
  const doc = readFileSync(path, "utf8");
  const text = blocks[idx];
  if (!text) throw new Error(`no block ${idx} for ${file}`);
  // First fenced block of any language holds the verbatim text; replace it.
  const fence = doc.match(/^```[a-z]*\n/m);
  if (!fence || fence.index == null) throw new Error(`${file}: no fenced block`);
  const start = fence.index;
  const bodyStart = start + fence[0].length;
  const end = doc.indexOf("\n```", bodyStart);
  if (end < 0) throw new Error(`${file}: unterminated fence`);
  const stamp = `> Regenerated ${today} by \`scripts/docs/export-grading-docs.ts\` from \`buildSystemBlocks()\` (block ${idx + 1}).\n\n`;
  const head = doc.slice(0, start).replace(/> Regenerated \d{4}-\d{2}-\d{2} by[^\n]*\n\n/g, "");
  // 03 used to hold one fence per skill file; everything after the first
  // fence is stale once the whole block is written in one piece.
  const rest = idx === 2 ? "\n\n_The four skill MDs above are rendered exactly as the SCORING KNOWLEDGE block injects them (clarity, structure, conciseness, tone)._\n" : doc.slice(end + 4);
  const out = head + stamp + "```text\n" + text + "\n```" + rest;
  writeFileSync(path, out);
  console.log(`${file}: ${text.length} chars`);
}
