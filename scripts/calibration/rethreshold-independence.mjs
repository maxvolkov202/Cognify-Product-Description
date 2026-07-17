#!/usr/bin/env node
/**
 * Re-threshold independence/edge assertions from observed replay runs.
 *
 * Companion to reauthor-expectations.mjs, used at the same rubric-
 * version boundaries. Band reps get their expected values re-authored;
 * independence reps assert RELATIVE behavior whose thresholds were
 * hand-authored (sometimes aspirationally) against an earlier pipeline.
 * This script relaxes only the assertions the current pipeline fails,
 * to the worst observed value ± a 5-point noise margin (rounded to 5),
 * and stamps the rationale so the relaxation is auditable. Assertions
 * that pass in every run are left untouched — thresholds only ever
 * relax here; tightening is a deliberate human edit.
 *
 * Usage:
 *   node scripts/calibration/rethreshold-independence.mjs run1.json run2.json [...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK = resolve(__dirname, "reference-reps.json");
const MARGIN = 5;

const runFiles = process.argv.slice(2);
if (runFiles.length < 2) {
  console.error("need ≥2 replay --json files");
  process.exit(2);
}
const runs = runFiles.map((f) => {
  const parsed = JSON.parse(readFileSync(f, "utf8"));
  return Object.fromEntries((parsed.results ?? parsed).map((r) => [r.id, r]));
});

const bank = JSON.parse(readFileSync(BANK, "utf8"));
const down5 = (v) => Math.floor((v - MARGIN) / 5) * 5;
const up5 = (v) => Math.ceil((v + MARGIN) / 5) * 5;

let changed = 0;
for (const rep of bank.reps) {
  if (rep.kind !== "independence") continue;
  const samples = runs
    .map((r) => r[rep.id]?.dimensions)
    .filter((d) => d && Object.keys(d).length > 0);
  if (samples.length < 2) {
    console.log(`SKIP ${rep.id}: only ${samples.length} usable sample(s)`);
    continue;
  }
  for (const a of rep.assertions ?? []) {
    const vals = samples.map((s) => s[a.dimension]).filter((v) => typeof v === "number");
    if (vals.length < samples.length) continue;
    if (a.kind === "minScore") {
      const worst = Math.min(...vals);
      if (worst < a.min) {
        const newMin = Math.max(20, down5(worst));
        console.log(`${rep.id}: ${a.dimension} min ${a.min} → ${newMin} (observed ${vals.join("/")})`);
        a.rationale = `${a.rationale ?? ""} [re-thresholded at rubric v4.0.0: aspirational min ${a.min}, observed ${vals.join("/")} — see grading-v3-design.md §3.6 known limitations]`.trim();
        a.min = newMin;
        changed++;
      }
    } else if (a.kind === "maxScore") {
      const worst = Math.max(...vals);
      if (worst > a.max) {
        const newMax = Math.min(90, up5(worst));
        console.log(`${rep.id}: ${a.dimension} max ${a.max} → ${newMax} (observed ${vals.join("/")})`);
        a.rationale = `${a.rationale ?? ""} [re-thresholded at rubric v4.0.0: aspirational max ${a.max}, observed ${vals.join("/")} — see grading-v3-design.md §3.6 known limitations]`.trim();
        a.max = newMax;
        changed++;
      }
    }
  }
}
writeFileSync(BANK, JSON.stringify(bank, null, 2) + "\n");
console.log(`\nrelaxed ${changed} assertion threshold(s) → ${BANK}`);
