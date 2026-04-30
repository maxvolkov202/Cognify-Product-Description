#!/usr/bin/env node
/**
 * Triage CLI for the prompt-bank expansion. Reads a JSONL file of
 * candidate prompts produced by generate-prompts.mjs and lets you
 * keep / cut / edit each one with a single keystroke. Output: a TS
 * snippet at scripts/generated/<source>.kept.ts that you paste into
 * the appropriate bank file.
 *
 * Usage:
 *   node scripts/triage-prompts.mjs <path-to.jsonl>
 *
 * Keys:
 *   y / enter  — keep the prompt as-is
 *   n / space  — cut
 *   e          — edit (opens an inline edit prompt)
 *   q          — save progress and quit
 *   ?          — show keys
 *
 * Resume support: triage state is stored in <source>.progress.json. If
 * the file exists when you re-run, you pick up from where you stopped.
 *
 * Output ID generation: kept prompts get ids like
 * `${bucket}_${nextNumber zero-padded to 3}`. The script reads the live
 * bank file to find the highest existing index and starts there +1, so
 * ids never collide with already-shipped prompts.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/triage-prompts.mjs <path-to.jsonl>");
  process.exit(1);
}
const inputPath = resolve(file);
if (!existsSync(inputPath)) {
  console.error(`[triage] file not found: ${inputPath}`);
  process.exit(1);
}

// ——— Load candidates ——————————————————————————————————————

const lines = readFileSync(inputPath, "utf8").split("\n").filter(Boolean);
const candidates = lines.map((l) => JSON.parse(l));
if (candidates.length === 0) {
  console.error("[triage] candidate file is empty");
  process.exit(1);
}

const { bank, bucket, theme } = candidates[0];

// ——— Resume state ——————————————————————————————————————————

const progressPath = inputPath.replace(/\.jsonl$/, ".progress.json");
let state = { cursor: 0, kept: [], cut: [], edits: {} };
if (existsSync(progressPath)) {
  try {
    state = JSON.parse(readFileSync(progressPath, "utf8"));
    console.log(
      `[triage] resuming from #${state.cursor + 1} (${state.kept.length} kept, ${state.cut.length} cut so far)`,
    );
  } catch {
    // ignore — start fresh
  }
}

function saveProgress() {
  writeFileSync(progressPath, JSON.stringify(state, null, 2), "utf8");
}

// ——— ID base ————————————————————————————————————————————————
// Find the highest existing prompt index in the live bank so the
// emitted snippet uses ids that don't collide.

function getNextIdBase() {
  const bankFile =
    bank === "workout"
      ? "src/lib/ai/prompts/workout.ts"
      : bank === "pressure"
        ? "src/lib/ai/prompts/pressure.ts"
        : "src/lib/ai/prompts/verticals.ts";
  const src = readFileSync(resolve(REPO_ROOT, bankFile), "utf8");
  const re = new RegExp(`${bucket}_(\\d{3,})`, "g");
  let max = 0;
  let m;
  while ((m = re.exec(src))) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max + 1;
}

const idBase = getNextIdBase();

// ——— Pretty print —————————————————————————————————————————

function header() {
  return `\n\n=== Triage: ${bank} / ${bucket} / ${theme} ===\n   ${candidates.length} candidates · keep so far: ${state.kept.length} · cut: ${state.cut.length}\n`;
}

function helpLine() {
  return `   keys: [y]eep / [n]o / [e]dit / [q]uit & save  (enter=keep, space=cut)`;
}

// ——— Inline edit prompt ——————————————————————————————————————

function promptEdit(rl, original) {
  return new Promise((res) => {
    rl.question(`   ✎ edit: `, (answer) => {
      const trimmed = answer.trim();
      res(trimmed.length > 0 ? trimmed : original);
    });
  });
}

// ——— Main loop ————————————————————————————————————————————

async function main() {
  console.log(header());
  console.log(helpLine());

  // Use raw stdin for one-key input. Edit mode and quit fall back to
  // line mode via readline.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (let i = state.cursor; i < candidates.length; i++) {
    const c = candidates[i];
    const text = state.edits[c.candidateId] ?? c.text;

    process.stdout.write(`\n#${i + 1}/${candidates.length}\n   ${text}\n`);

    const decision = await new Promise((res) => {
      rl.question("   ? ", (answer) => res(answer.trim().toLowerCase()));
    });

    if (decision === "q") {
      state.cursor = i;
      saveProgress();
      console.log(`\n[triage] saved progress at #${i + 1}. Re-run to resume.`);
      rl.close();
      process.exit(0);
    } else if (decision === "n" || decision === " ") {
      state.cut.push(c.candidateId);
    } else if (decision === "e") {
      const edited = await promptEdit(rl, text);
      state.edits[c.candidateId] = edited;
      state.kept.push(c.candidateId);
    } else if (decision === "?") {
      console.log(helpLine());
      i--; // re-show same candidate
    } else {
      // y / enter / anything else → keep
      state.kept.push(c.candidateId);
    }

    state.cursor = i + 1;
    if ((i + 1) % 10 === 0) saveProgress();
  }

  saveProgress();
  rl.close();

  // ——— Emit the TS snippet ——————————————————————————————————

  const keptCandidates = state.kept.map((id) => {
    const orig = candidates.find((c) => c.candidateId === id);
    if (!orig) return null;
    return {
      text: state.edits[id] ?? orig.text,
    };
  }).filter(Boolean);

  const snippetPath = inputPath.replace(/\.jsonl$/, ".kept.ts");
  const lines = keptCandidates.map((c, i) => {
    const idx = String(idBase + i).padStart(3, "0");
    const id = `${bucket}_${idx}`;
    const escaped = c.text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    if (bank === "workout") {
      return `    { id: "${id}", text: "${escaped}", theme: "${theme}" },`;
    }
    if (bank === "pressure") {
      return `    {\n      id: "${id}",\n      setting: "${theme}",\n      text: "${escaped}",\n    },`;
    }
    // vertical
    return `    { id: "${id}", vertical: "${bucket}", text: "${escaped}" },`;
  });

  writeFileSync(snippetPath, lines.join("\n") + "\n", "utf8");
  console.log(
    `\n[triage] wrote ${keptCandidates.length} kept prompts to ${snippetPath}`,
  );
  console.log(
    `[triage] paste this snippet into the matching bucket in src/lib/ai/prompts/${bank}.ts`,
  );
}

main().catch((err) => {
  console.error("[triage] failed:", err);
  process.exit(1);
});
