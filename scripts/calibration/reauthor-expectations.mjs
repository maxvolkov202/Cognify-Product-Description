#!/usr/bin/env node
/**
 * Re-author reference-rep expected values from replay runs.
 *
 * Used at rubric-version boundaries (e.g. v4.0.0) when a deliberate
 * prompt/model change shifts absolute score levels and the bank's
 * expectations must be re-anchored to the new pipeline. NOT for
 * routine drift — routine drift is a failure the harness should catch.
 *
 * Takes ≥2 --json outputs of calibrate-scoring.mjs (independent runs,
 * same code), averages per-rep/per-dim actuals, and rewrites each band
 * rep's `expected` block (composite, band, dimensions). Independence
 * and audio-tone reps are untouched — their assertions are relative,
 * not absolute.
 *
 * Prints a review table (old → new per rep) and flags reps whose
 * run-to-run spread exceeds the ±5 harness tolerance (composite >6 or
 * any dim >10) — those expectations are unstable and need a human eye.
 *
 * Usage:
 *   node scripts/calibration/reauthor-expectations.mjs run1.json run2.json [...more]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bandFor } from "./_bands.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK = resolve(__dirname, "reference-reps.json");

const runFiles = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (runFiles.length < 2) {
  console.error("need ≥2 replay --json files (independent runs)");
  process.exit(2);
}
const runs = runFiles.map((f) => {
  const parsed = JSON.parse(readFileSync(f, "utf8"));
  return Object.fromEntries((parsed.results ?? parsed).map((r) => [r.id, r]));
});

const bank = JSON.parse(readFileSync(BANK, "utf8"));

const unstable = [];
const table = [];
let reauthored = 0;

for (const rep of bank.reps) {
  if (rep.kind !== "band") continue;
  const samples = runs.map((r) => r[rep.id]).filter((s) => s?.dimensions && typeof s.composite === "number");
  if (samples.length < 2) {
    unstable.push(`${rep.id}: only ${samples.length} usable sample(s) — NOT re-authored`);
    continue;
  }
  const comps = samples.map((s) => s.composite);
  const compSpread = Math.max(...comps) - Math.min(...comps);
  const dims = Object.keys(rep.expected.dimensions);
  let dimSpreadMax = 0;
  const newDims = {};
  let dimMissing = false;
  for (const d of dims) {
    const vals = samples.map((s) => s.dimensions[d]).filter((v) => typeof v === "number");
    if (vals.length < 2) {
      dimMissing = true;
      break;
    }
    dimSpreadMax = Math.max(dimSpreadMax, Math.max(...vals) - Math.min(...vals));
    newDims[d] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  if (dimMissing) {
    // Never write a PARTIAL dimensions map — that silently deletes the
    // missing dimension's expectation from the bank and the harness
    // stops gating it forever. Keep the old expected block instead.
    unstable.push(`${rep.id}: a dimension is missing in a run — NOT re-authored (old expected kept)`);
    continue;
  }
  const newComposite = Math.round(comps.reduce((a, b) => a + b, 0) / comps.length);
  if (compSpread > 6 || dimSpreadMax > 10) {
    unstable.push(`${rep.id}: run spread composite=${compSpread} maxDim=${dimSpreadMax} — re-authored to the mean, REVIEW`);
  }
  table.push({
    id: rep.id,
    composite: `${rep.expected.composite} → ${newComposite}`,
    band: `${rep.expected.band} → ${bandFor(newComposite)}`,
  });
  rep.expected = {
    composite: newComposite,
    band: bandFor(newComposite),
    dimensions: newDims,
  };
  reauthored++;
}

writeFileSync(BANK, JSON.stringify(bank, null, 2) + "\n");
console.table(table);
if (unstable.length) {
  console.log("\nUNSTABLE / REVIEW:");
  unstable.forEach((u) => console.log("  " + u));
}
console.log(`\nre-authored ${reauthored} band reps from ${runFiles.length} runs → ${BANK}`);
