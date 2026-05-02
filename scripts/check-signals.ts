#!/usr/bin/env tsx
/**
 * Cognify Ch.11 — Manual signal-tuning CLI.
 *
 * Usage:
 *   npx tsx scripts/check-signals.ts <transcript-file> [duration-seconds]
 *   npx tsx scripts/check-signals.ts --rep <reference-rep-id>
 *
 * Reads a transcript (plain text or via reference-reps.json id), runs
 * all four text-signal extractors, and prints the resulting numbers
 * in the same format the SIGNALS block renders. Used to hand-tune
 * thresholds against real reps before they're wired into the prompt.
 *
 * No DB, no network. Pure local execution.
 */

import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import {
  extractAllTextSignals,
  renderTextSignalsBlock,
} from "../src/lib/scoring/signals/index";

type RefRep = {
  id?: string;
  repId?: string;
  name?: string;
  transcript?: string;
  text?: string;
  durationMs?: number;
  durationSeconds?: number;
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage:");
    console.error(
      "  npx tsx scripts/check-signals.ts <transcript-file> [duration-seconds]",
    );
    console.error(
      "  npx tsx scripts/check-signals.ts --rep <reference-rep-id>",
    );
    process.exit(1);
  }

  let transcript = "";
  let durationMs = 60_000;
  let label = "(unknown source)";

  if (args[0] === "--rep") {
    const repId = args[1];
    if (!repId) {
      console.error("Error: --rep requires a reference-rep id");
      process.exit(1);
    }
    const refPath = resolve(
      process.cwd(),
      "scripts",
      "calibration",
      "reference-reps.json",
    );
    const raw = await readFile(refPath, "utf-8");
    const parsed = JSON.parse(raw) as { reps?: RefRep[] } | RefRep[];
    const list: RefRep[] = Array.isArray(parsed)
      ? parsed
      : (parsed.reps ?? []);
    const found = list.find(
      (r) => r.id === repId || r.repId === repId || r.name === repId,
    );
    if (!found) {
      console.error(`Reference rep "${repId}" not found. Available ids:`);
      for (const r of list) {
        console.error(`  - ${r.id ?? r.repId ?? r.name ?? "(no id)"}`);
      }
      process.exit(1);
    }
    transcript = found.transcript ?? found.text ?? "";
    durationMs =
      found.durationMs ??
      (found.durationSeconds != null ? found.durationSeconds * 1000 : 60_000);
    label = `reference rep "${repId}"`;
  } else {
    const path = isAbsolute(args[0]!)
      ? args[0]!
      : resolve(process.cwd(), args[0]!);
    transcript = await readFile(path, "utf-8");
    if (args[1]) {
      const sec = parseFloat(args[1]);
      if (Number.isFinite(sec) && sec > 0) durationMs = sec * 1000;
    }
    label = path;
  }

  if (transcript.trim().length === 0) {
    console.error("Error: empty transcript");
    process.exit(1);
  }

  const signals = extractAllTextSignals({ transcript, durationMs });

  console.log(`\n=== Signals for ${label} ===`);
  console.log(
    `Word count: ${signals.meta.wordCount} | Duration: ${(durationMs / 1000).toFixed(1)}s | Minutes: ${signals.meta.durationMinutes.toFixed(2)}\n`,
  );
  console.log(renderTextSignalsBlock(signals));
  console.log("\n--- Raw bundle ---");
  console.log(JSON.stringify(signals, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
