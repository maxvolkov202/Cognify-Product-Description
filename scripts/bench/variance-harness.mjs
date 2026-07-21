#!/usr/bin/env node
/**
 * Grading Engine V2 — run-to-run variance harness (the missing measurement).
 *
 * Scores the same reps N times through /api/score and reports per-dimension
 * spread (mean / stddev / min / max / maxSwing) + composite spread. This is
 * the deciding instrument for the "can we lean more on the LLM (less
 * determinism) without losing reproducibility?" question: run it once with
 * the deploy on `control` and once on a variant arm, compare per-dim maxSwing.
 *
 * The score is server-side arm-selected (FF_SCORING_VARIANT*), so point this
 * at a deploy configured for the arm you want to measure and pass --arm as a
 * label for the report. Reuses the reference bank + the mock-fallback
 * loud-fail guard from calibrate-scoring.mjs (one canned fallback tuple fakes
 * perfect stability — worse here than in an accuracy run).
 *
 * Importable: run-bench.mjs imports { runVariance, scoreOnce }. As a CLI:
 *   node scripts/bench/variance-harness.mjs                 # default subset, N=7
 *   node scripts/bench/variance-harness.mjs --n=5 --filter=band
 *   node scripts/bench/variance-harness.mjs --arm=median-of-n --ids=band-competent-okay-pitch
 *   DEV_BASE_URL=https://staging... node scripts/bench/variance-harness.mjs
 *
 * Exit codes: 0 ok · 1 a run hit mock-fallback / HTTP error (invalid) · 2 config.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(
  __dirname,
  "..",
  "calibration",
  "reference-reps.json",
);
const OUT_DIR = resolve(__dirname, "..", "..", "plans", "bench");

export const DIMENSIONS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

// Default subset when neither --ids nor --filter is given: a spread across
// bands + a couple of the highest-variance edge reps (the ones the D2
// baseline doc flagged swinging 30-50pts at temp 1.0).
export const DEFAULT_VARIANCE_SUBSET = [
  "band-poor-mic-test",
  "band-competent-okay-pitch",
  "edge-shallow-but-organized",
  "edge-short-but-deep",
];

/** POST one rep through /api/score. Throws on HTTP error or mock-fallback
 *  (a canned fallback tuple silently fakes perfect stability). */
export async function scoreOnce(rep, { baseUrl, guestId } = {}) {
  const body = {
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
  };
  if (rep.audioUrl) body.audioUrl = rep.audioUrl;

  const res = await fetch(`${baseUrl}/api/score`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(guestId ? { cookie: `cognify_guest_id=${guestId}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const score = await res.json();
  if (score.modelVersion === "mock-fallback-v1") {
    throw new Error(
      "mock-fallback response — scoring provider unreachable; run is invalid",
    );
  }
  return score;
}

function stats(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    mean: Math.round(mean * 10) / 10,
    stddev: Math.round(Math.sqrt(variance) * 100) / 100,
    min,
    max,
    maxSwing: max - min,
  };
}

/**
 * Score each rep N times and compute per-dimension + composite spread.
 * Sequential per rep (the /api/score 30/min-per-identity limit means a
 * shared guest id must not fan out). Returns a report object.
 */
export async function runVariance({
  reps,
  n = 7,
  baseUrl = "http://127.0.0.1:3333",
  guestId,
  armLabel = "unknown",
  log = () => {},
}) {
  const perRep = [];
  let worstSwing = 0;
  let worstWhere = "";

  for (const rep of reps) {
    const runsByDim = Object.fromEntries(DIMENSIONS.map((d) => [d, []]));
    const composites = [];
    for (let i = 0; i < n; i++) {
      const score = await scoreOnce(rep, { baseUrl, guestId });
      for (const d of score.dimensions ?? []) {
        if (runsByDim[d.dimension]) runsByDim[d.dimension].push(d.score);
      }
      composites.push(score.composite);
    }

    const dims = {};
    for (const d of DIMENSIONS) {
      if (runsByDim[d].length > 0) {
        dims[d] = stats(runsByDim[d]);
        if (dims[d].maxSwing > worstSwing) {
          worstSwing = dims[d].maxSwing;
          worstWhere = `${rep.id}/${d}`;
        }
      }
    }
    const composite = stats(composites);
    perRep.push({ id: rep.id, kind: rep.kind, composite, dims });

    log(
      `  ${rep.id}: composite stddev ${composite.stddev} swing ${composite.maxSwing} [${composite.min}-${composite.max}]`,
    );
  }

  return {
    arm: armLabel,
    n,
    baseUrl,
    repCount: reps.length,
    worstDimSwing: { value: worstSwing, where: worstWhere },
    perRep,
  };
}

// ————————————————————————————————————————————————————————————————
// CLI
// ————————————————————————————————————————————————————————————————
function parseArg(name, fallback = null) {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function loadReps({ filter, ids, withAudio }) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(REF_REPS_PATH, "utf8"));
  } catch (err) {
    console.error(`Failed to read/parse ${REF_REPS_PATH}: ${err.message}`);
    process.exit(2);
  }
  let reps = parsed.reps ?? [];
  if (!withAudio) reps = reps.filter((r) => r.kind !== "audio-tone");
  if (ids) {
    const want = new Set(ids.split(",").map((s) => s.trim()));
    reps = reps.filter((r) => want.has(r.id));
  } else if (filter) {
    reps = reps.filter((r) => r.id.includes(filter) || r.kind === filter);
  } else {
    reps = reps.filter((r) => DEFAULT_VARIANCE_SUBSET.includes(r.id));
  }
  if (reps.length === 0) {
    console.error("No reps matched the filter.");
    process.exit(2);
  }
  return reps;
}

async function main() {
  const n = Math.max(2, parseInt(parseArg("--n", "7"), 10) || 7);
  const armLabel = parseArg("--arm", "unknown");
  const baseUrl = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
  const reps = loadReps({
    filter: parseArg("--filter"),
    ids: parseArg("--ids"),
    withAudio: process.argv.includes("--with-audio"),
  });

  console.log(
    `Variance harness · arm=${armLabel} · N=${n} · ${reps.length} reps · ${baseUrl}\n`,
  );
  const report = await runVariance({
    reps,
    n,
    baseUrl,
    guestId: process.env.CALIBRATION_GUEST_ID,
    armLabel,
    log: (m) => console.log(m),
  });

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(OUT_DIR, `variance-${armLabel}-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(
    `\nWorst per-dim swing: ${report.worstDimSwing.value} pts (${report.worstDimSwing.where}). Report → ${outPath}`,
  );
}

// Run as CLI only when invoked directly (not when imported by run-bench).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`\nVariance harness failed: ${err.message}`);
    process.exit(1);
  });
}
