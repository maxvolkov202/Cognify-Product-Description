#!/usr/bin/env node
/**
 * Cognify calibration harness.
 *
 * Iterates the reference-reps bank, POSTs each through /api/score, and
 * compares the AI's per-dimension + composite scores against expected
 * values. Two assertion strategies:
 *
 *   - kind="band"          : every dimension must land within ±5 of expected.
 *                            Composite must land within ±5 of expected.
 *                            Band must match (off-by-one allowed at boundaries).
 *
 *   - kind="independence"  : per-dimension min/max threshold checks, used
 *                            for inter-skill independence assertions
 *                            (e.g. "Structure ≥ 75 AND Thinking ≤ 55"
 *                            on a rigged well-organized-but-shallow rep).
 *
 * Exit codes:
 *   0  all reps pass
 *   1  one or more reps fail
 *   2  config error (no DEV_BASE_URL, missing reference-reps.json, etc.)
 *
 * Usage:
 *   node scripts/calibrate-scoring.mjs                          # against dev (default 127.0.0.1:3333)
 *   DEV_BASE_URL=https://staging.cognify.app node scripts/calibrate-scoring.mjs
 *   node scripts/calibrate-scoring.mjs --filter band-poor       # subset
 *   node scripts/calibrate-scoring.mjs --json                   # machine-readable output
 *
 * CI integration: this script is invoked from a CI gate. Drift > ±5 on
 * any dimension blocks the merge. To intentionally update expected
 * scores (e.g. after a deliberate prompt change), edit reference-reps.json
 * in the same PR — never bypass the harness.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(__dirname, "calibration", "reference-reps.json");
const BASE_URL = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
const FILTER = parseArg("--filter");
const JSON_OUT = process.argv.includes("--json");
const TOLERANCE = 5;

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function loadReferenceReps() {
  let raw;
  try {
    raw = readFileSync(REF_REPS_PATH, "utf8");
  } catch (err) {
    console.error(`Failed to read ${REF_REPS_PATH}:`, err.message);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse ${REF_REPS_PATH}:`, err.message);
    process.exit(2);
  }
  if (!parsed.reps || !Array.isArray(parsed.reps)) {
    console.error("reference-reps.json missing top-level `reps` array");
    process.exit(2);
  }
  return parsed.reps;
}

async function scoreOne(rep) {
  const body = {
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
  };
  if (rep.audioUrl) body.audioUrl = rep.audioUrl;

  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function bandFor(score) {
  if (score < 40) return "poor";
  if (score < 60) return "below_standard";
  if (score < 75) return "competent";
  if (score < 85) return "strong";
  if (score < 95) return "excellent";
  return "exceptional";
}

function bandsAdjacent(a, b) {
  const order = [
    "poor",
    "below_standard",
    "competent",
    "strong",
    "excellent",
    "exceptional",
  ];
  return Math.abs(order.indexOf(a) - order.indexOf(b)) <= 1;
}

function evaluateBand(rep, score) {
  const failures = [];
  const warnings = [];
  const exp = rep.expected;
  if (!exp) {
    failures.push("missing `expected` block");
    return { failures, warnings };
  }

  // Composite delta
  const compositeDelta = score.composite - exp.composite;
  if (Math.abs(compositeDelta) > TOLERANCE) {
    failures.push(
      `composite drift ${compositeDelta > 0 ? "+" : ""}${compositeDelta} (expected ${exp.composite}, got ${score.composite})`,
    );
  }

  // Band check (off-by-one allowed at boundaries)
  const actualBand = bandFor(score.composite);
  if (actualBand !== exp.band) {
    if (bandsAdjacent(actualBand, exp.band)) {
      warnings.push(
        `band ${actualBand} is adjacent to expected ${exp.band} — boundary case, accepted`,
      );
    } else {
      failures.push(
        `band mismatch: expected ${exp.band}, got ${actualBand} (composite ${score.composite})`,
      );
    }
  }

  // Per-dimension deltas
  const dimMap = {};
  for (const d of score.dimensions ?? []) dimMap[d.dimension] = d.score;
  for (const [dim, expected] of Object.entries(exp.dimensions)) {
    const actual = dimMap[dim];
    if (actual == null) {
      failures.push(`dimension ${dim} missing from response`);
      continue;
    }
    const delta = actual - expected;
    if (Math.abs(delta) > TOLERANCE) {
      failures.push(
        `${dim} drift ${delta > 0 ? "+" : ""}${delta} (expected ${expected}, got ${actual})`,
      );
    }
  }

  return { failures, warnings };
}

function evaluateIndependence(rep, score) {
  const failures = [];
  const warnings = [];
  const dimMap = {};
  for (const d of score.dimensions ?? []) dimMap[d.dimension] = d.score;

  for (const a of rep.assertions ?? []) {
    const actual = dimMap[a.dimension];
    if (actual == null) {
      failures.push(`dimension ${a.dimension} missing from response`);
      continue;
    }
    if (a.kind === "minScore" && actual < a.min) {
      failures.push(
        `${a.dimension}=${actual} < min ${a.min}${a.rationale ? ` (${a.rationale})` : ""}`,
      );
    } else if (a.kind === "maxScore" && actual > a.max) {
      failures.push(
        `${a.dimension}=${actual} > max ${a.max}${a.rationale ? ` (${a.rationale})` : ""}`,
      );
    }
  }
  return { failures, warnings };
}

function colored(s, code) {
  if (process.env.NO_COLOR) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}

function red(s) { return colored(s, "31"); }
function green(s) { return colored(s, "32"); }
function yellow(s) { return colored(s, "33"); }
function dim(s) { return colored(s, "90"); }

async function main() {
  const allReps = loadReferenceReps();
  const reps = FILTER ? allReps.filter((r) => r.id.includes(FILTER)) : allReps;

  if (reps.length === 0) {
    console.error(`No reps matched filter ${FILTER ?? "(none)"}`);
    process.exit(2);
  }

  if (!JSON_OUT) {
    console.log(`\nCognify calibration harness`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Reference reps: ${reps.length}${FILTER ? ` (filter: ${FILTER})` : ""}`);
    console.log(`Tolerance: ±${TOLERANCE} per dimension and composite\n`);
  }

  const results = [];
  for (const rep of reps) {
    const t0 = Date.now();
    let outcome;
    try {
      const score = await scoreOne(rep);
      const evalResult =
        rep.kind === "band"
          ? evaluateBand(rep, score)
          : evaluateIndependence(rep, score);
      outcome = {
        id: rep.id,
        kind: rep.kind,
        latencyMs: Date.now() - t0,
        composite: score.composite,
        dimensions: Object.fromEntries(
          (score.dimensions ?? []).map((d) => [d.dimension, d.score]),
        ),
        ...evalResult,
      };
    } catch (err) {
      outcome = {
        id: rep.id,
        kind: rep.kind,
        latencyMs: Date.now() - t0,
        failures: [`request failed: ${err.message}`],
        warnings: [],
      };
    }
    results.push(outcome);

    if (!JSON_OUT) {
      const ok = outcome.failures.length === 0;
      const status = ok ? green("PASS") : red("FAIL");
      console.log(
        `${status} ${outcome.id} ${dim(`(${rep.kind}, ${outcome.latencyMs}ms)`)}`,
      );
      for (const f of outcome.failures) console.log(`     ${red("✗")} ${f}`);
      for (const w of outcome.warnings) console.log(`     ${yellow("!")} ${w}`);
    }
  }

  const failed = results.filter((r) => r.failures.length > 0);
  if (JSON_OUT) {
    console.log(JSON.stringify({ results, failedCount: failed.length }, null, 2));
  } else {
    console.log("");
    if (failed.length === 0) {
      console.log(green(`All ${results.length} reps within tolerance.`));
    } else {
      console.log(red(`${failed.length}/${results.length} reps failed.`));
    }
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(2);
});
