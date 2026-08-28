/**
 * Grading plan WS7 — RAG on/off ablation analysis.
 *
 *   node scripts/bench/rag-ablation-analyze.mjs <dir-with-rag-on-N.json and rag-off-N.json> [--out plans/bench/DECISION-....md]
 *
 * Inputs are `calibrate-scoring.mjs --json` outputs (one file per run).
 * Reports, per condition: pass rate, composite + per-dimension MAE vs the
 * bank's expected scores (band reps only; independence reps have no point
 * expectations), run-to-run spread per rep, latency p50/p90, and the
 * number of mock/failed requests. Never touches the DB.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("usage: rag-ablation-analyze.mjs <dir> [--out file]"); process.exit(2); }
const outIdx = process.argv.indexOf("--out");
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const bank = JSON.parse(readFileSync(resolve("scripts/calibration/reference-reps.json"), "utf8"));
const expected = new Map(bank.reps.filter((r) => r.kind === "band" && r.expected).map((r) => [r.id, r.expected]));
const DIMS = ["clarity", "structure", "conciseness", "thinking_quality", "delivery", "tone"];

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sd = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)) : 0; };

function load(prefix) {
  return readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort().map((f) => {
    try { return JSON.parse(readFileSync(resolve(dir, f), "utf8")).results; } catch { return null; }
  }).filter(Boolean);
}
function summarize(runs) {
  const all = runs.flat();
  const ok = all.filter((r) => r.composite != null);
  const passRate = mean(all.map((r) => (r.failures?.length === 0 ? 1 : 0)));
  const compErr = [], dimErr = Object.fromEntries(DIMS.map((d) => [d, []]));
  for (const r of ok) {
    const e = expected.get(r.id); if (!e) continue;
    if (e.composite != null) compErr.push(Math.abs(r.composite - e.composite));
    for (const d of DIMS) if (e.dimensions?.[d] != null && r.dimensions?.[d] != null) dimErr[d].push(Math.abs(r.dimensions[d] - e.dimensions[d]));
  }
  const byRep = new Map();
  for (const r of ok) { if (!byRep.has(r.id)) byRep.set(r.id, []); byRep.get(r.id).push(r.composite); }
  const spread = [...byRep.values()].filter((xs) => xs.length > 1).map((xs) => Math.max(...xs) - Math.min(...xs));
  const lat = ok.map((r) => r.latencyMs);
  return {
    runs: runs.length, calls: all.length, failedRequests: all.length - ok.length,
    passRate, compositeMae: mean(compErr), dimMae: Object.fromEntries(DIMS.map((d) => [d, mean(dimErr[d])])),
    spreadMean: mean(spread), spreadMax: spread.length ? Math.max(...spread) : NaN, spreadSd: sd(spread),
    latencyP50: pct(lat, 0.5), latencyP90: pct(lat, 0.9),
  };
}
const on = summarize(load("rag-on-")), off = summarize(load("rag-off-"));
const f = (x, d = 1) => (Number.isNaN(x) || x == null ? "—" : x.toFixed(d));
const lines = [
  `# Grading plan WS7 — RAG on/off ablation (${new Date().toISOString().slice(0, 10)})`, "",
  "Calibration bank (48 reps: 29 band + 19 independence), `calibrate-scoring.mjs --json`, N runs per condition on the same",
  "local server pair (RAG on :3333 / RAG off :3334, `FF_RAG_RETRIEVE=false`). MAE is against the bank's expected scores",
  "(band reps only; see audit §1.8 on what the bank measures). Human-set comparison pending the labeled sheets.", "",
  "| condition | runs | calls | failed | pass rate | comp MAE | clarity | structure | concise | thinking | delivery | tone | spread mean/max | lat p50 | lat p90 |",
  "|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--|--:|--:|",
  ...[["RAG on", on], ["RAG off", off]].map(([n, s]) => `| ${n} | ${s.runs} | ${s.calls} | ${s.failedRequests} | ${f(s.passRate * 100, 0)}% | ${f(s.compositeMae)} | ${DIMS.map((d) => f(s.dimMae[d])).join(" | ")} | ${f(s.spreadMean)} / ${f(s.spreadMax, 0)} | ${f(s.latencyP50, 0)} ms | ${f(s.latencyP90, 0)} ms |`),
  "",
];
const delta = on.compositeMae - off.compositeMae;
lines.push(`Composite MAE delta (on − off): ${f(delta, 2)}; latency p50 delta: ${f(on.latencyP50 - off.latencyP50, 0)} ms.`);
lines.push("");
lines.push(delta < -1.0 ? "**Read:** RAG on is more accurate on the bank by more than 1 composite point; keep it with a similarity threshold and per-rep chunk logging (WS1 columns)."
  : delta > 1.0 ? "**Read:** RAG off is more accurate on the bank; set `FF_RAG_RETRIEVE=false` for scoring."
  : "**Read:** no accuracy difference beyond the bank's noise; per the audit (§1.10) and plan §3.7, RAG off for scoring (`FF_RAG_RETRIEVE=false`); the corpus stays for prompt generation.");
const md = lines.join("\n") + "\n";
console.log(md);
if (outFile) { writeFileSync(resolve(outFile), md); console.log(`wrote ${outFile}`); }
