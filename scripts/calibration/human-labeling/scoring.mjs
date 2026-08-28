/**
 * Grading plan WS2 — score the filled labeling sheets.
 *
 *   node scripts/calibration/human-labeling/scoring.mjs [--model <model-scores.json>] [--label baseline]
 *
 * Reads labeling-sheet-A.csv + labeling-sheet-B.csv (filled by the raters),
 * optional adjudicated.csv (rep_id + the six *_band columns, wins over A/B),
 * and a model-scores file (default model-scores.hidden.json = the scores the
 * reps carry in prod today; pass a rescore.mjs output to evaluate a change).
 * Writes human-labeled-2026-09.json (consensus labels; never model-authored)
 * and metrics.<label>.json; prints the tables.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { OUT_DIR, DIMS, DIM_COLUMNS, BINARIES, bandOf, BAND_MIDPOINT, parseCsv, mean, mae, bias, spearman, cohenKappa, weightedKappa } from "./_shared.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const label = args.label ?? "baseline";
const modelPath = resolve(OUT_DIR, args.model ?? "model-scores.hidden.json");
const model = JSON.parse(readFileSync(modelPath, "utf8"));
const A = parseCsv(readFileSync(resolve(OUT_DIR, "labeling-sheet-A.csv"), "utf8"));
const B = parseCsv(readFileSync(resolve(OUT_DIR, "labeling-sheet-B.csv"), "utf8"));
const adjPath = resolve(OUT_DIR, "adjudicated.csv");
const ADJ = existsSync(adjPath) ? parseCsv(readFileSync(adjPath, "utf8")) : [];
const adjById = new Map(ADJ.map((r) => [r.rep_id, r]));
const bById = new Map(B.map((r) => [r.rep_id, r]));

const toBand = (v) => { const n = parseInt(v, 10); return n >= 1 && n <= 5 ? n : null; };
const toBool = (v) => { const s = String(v).trim().toLowerCase(); return ["y", "yes", "1", "true"].includes(s) ? 1 : ["n", "no", "0", "false"].includes(s) ? 0 : null; };

const labeled = [];
const adjudicate = [];
for (const a of A) {
  const b = bById.get(a.rep_id);
  if (!b) continue;
  const rec = { rep_id: a.rep_id, bands: {}, binaries: {}, raters: { A: {}, B: {} } };
  let complete = true;
  for (const dim of DIMS) {
    const col = DIM_COLUMNS[dim];
    const ba = toBand(a[col]), bb = toBand(b[col]);
    rec.raters.A[dim] = ba; rec.raters.B[dim] = bb;
    if (ba == null || bb == null) { complete = false; continue; }
    if (Math.abs(ba - bb) > 1) adjudicate.push({ rep_id: a.rep_id, dim, A: ba, B: bb });
    const adj = adjById.get(a.rep_id)?.[col];
    rec.bands[dim] = adj != null && toBand(adj) != null ? toBand(adj) : (ba + bb) / 2;
  }
  for (const k of BINARIES) {
    const va = toBool(a[k]), vb = toBool(b[k]);
    rec.raters.A[k] = va; rec.raters.B[k] = vb;
    if (va != null && vb != null) rec.binaries[k] = (va + vb) / 2;
  }
  if (complete) labeled.push(rec);
}
if (!labeled.length) { console.error("No completely labeled reps yet (both sheets need all six bands per rep)."); process.exit(1); }
writeFileSync(resolve(OUT_DIR, "human-labeled-2026-09.json"), JSON.stringify({ scored_at: new Date().toISOString(), n: labeled.length, reps: labeled }, null, 2));

const fmt = (x, d = 2) => (Number.isNaN(x) || x == null ? "—" : x.toFixed(d));
const out = { label, n: labeled.length, model_file: modelPath, agreement: {}, vs_model: {}, feedback: {}, adjudicate };

console.log(`\n== Inter-rater agreement (n=${labeled.length}) ==`);
console.log("dim | kappa | weighted kappa | exact | within 1");
for (const dim of DIMS) {
  const a = labeled.map((r) => r.raters.A[dim]), b = labeled.map((r) => r.raters.B[dim]);
  const exact = mean(a.map((x, i) => (x === b[i] ? 1 : 0))), w1 = mean(a.map((x, i) => (Math.abs(x - b[i]) <= 1 ? 1 : 0)));
  out.agreement[dim] = { kappa: cohenKappa(a, b), weighted_kappa: weightedKappa(a, b), exact, within_one: w1 };
  console.log(`${dim} | ${fmt(out.agreement[dim].kappa)} | ${fmt(out.agreement[dim].weighted_kappa)} | ${fmt(exact)} | ${fmt(w1)}`);
}
console.log(`adjudication needed (> 1 band apart): ${adjudicate.length}`);

console.log(`\n== Model vs human (${label}) ==`);
console.log("dim | band match | MAE (bands) | MAE (points) | Spearman | bias (model − human, bands) | n");
for (const dim of DIMS) {
  const pairs = labeled.map((r) => ({ h: r.bands[dim], m: model[r.rep_id]?.scores?.[dim] })).filter((p) => p.h != null && p.m != null);
  const hb = pairs.map((p) => p.h), mb = pairs.map((p) => bandOf(p.m)), ms = pairs.map((p) => p.m), hp = pairs.map((p) => BAND_MIDPOINT[Math.round(p.h)]);
  const row = {
    band_match: mean(hb.map((x, i) => (Math.round(x) === mb[i] ? 1 : 0))),
    mae_bands: mae(mb, hb), mae_points: mae(ms, hp), spearman: spearman(ms, hb), bias_bands: bias(mb, hb), n: pairs.length,
  };
  out.vs_model[dim] = row;
  console.log(`${dim} | ${fmt(row.band_match)} | ${fmt(row.mae_bands)} | ${fmt(row.mae_points, 1)} | ${fmt(row.spearman)} | ${fmt(row.bias_bands)} | ${row.n}`);
}
console.log("\n== Feedback accuracy (share of reps both raters answered) ==");
for (const k of BINARIES) {
  const vals = labeled.map((r) => r.binaries[k]).filter((v) => v != null);
  const agree = labeled.filter((r) => r.raters.A[k] != null && r.raters.B[k] != null);
  out.feedback[k] = { rate: mean(vals), rater_agreement: mean(agree.map((r) => (r.raters.A[k] === r.raters.B[k] ? 1 : 0))), n: vals.length };
  console.log(`${k}: ${fmt(out.feedback[k].rate)} (rater agreement ${fmt(out.feedback[k].rater_agreement)}, n=${vals.length})`);
}
writeFileSync(resolve(OUT_DIR, `metrics.${label}.json`), JSON.stringify(out, null, 2));
console.log(`\nwrote metrics.${label}.json`);
