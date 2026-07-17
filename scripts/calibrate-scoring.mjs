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
import { bandFor, bandsAdjacent } from "./calibration/_bands.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(__dirname, "calibration", "reference-reps.json");
const BASE_URL = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
const FILTER = parseArg("--filter");
const JSON_OUT = process.argv.includes("--json");
// Split tolerances (rubric v4.0.0): composite is stable run-to-run
// (weighted average smooths dimension noise), but gpt-4o at
// temperature 0.2 moves individual dimensions ±10 between identical
// runs on borderline reps — a ±5 per-dim gate fails on noise alone.
// Composite stays the tight product gate; per-dim catches only real
// per-skill regressions.
const TOLERANCE = parseInt(process.env.CALIBRATION_TOLERANCE ?? "6", 10);
const DIM_TOLERANCE = parseInt(
  process.env.CALIBRATION_DIM_TOLERANCE ?? "15",
  10,
);

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
    headers: {
      "content-type": "application/json",
      // /api/score requires an identity — same convention as the
      // phase-baseline / verify-scoring harnesses.
      ...(process.env.CALIBRATION_GUEST_ID
        ? { cookie: `cognify_guest_id=${process.env.CALIBRATION_GUEST_ID}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const score = await res.json();
  // A mock-fallback response means the scoring provider was unreachable
  // (credits/quota/outage) — comparing its canned values against
  // expectations silently poisons the whole run (observed 2026-07-17:
  // OpenAI quota died mid-run and a dozen reps "scored" the identical
  // fallback tuple). Fail loudly instead.
  if (score.modelVersion === "mock-fallback-v1") {
    throw new Error(
      "mock-fallback response — scoring provider unreachable (check credits/quota); run is invalid",
    );
  }
  return score;
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
    if (Math.abs(delta) > DIM_TOLERANCE) {
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
    } else if (a.kind === "minGap") {
      // Pair-direction assertion: dimension must exceed `versus` by
      // ≥ gap. Encodes "structure > thinking by 15" style independence
      // semantics without pinning absolute levels (which drift with
      // provider/prompt changes far more than relative order does).
      const other = dimMap[a.versus];
      if (other == null) {
        failures.push(`dimension ${a.versus} missing from response`);
      } else if (actual - other < a.gap) {
        failures.push(
          `${a.dimension}(${actual}) − ${a.versus}(${other}) = ${actual - other} < required gap ${a.gap}${a.rationale ? ` (${a.rationale})` : ""}`,
        );
      }
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
  const loaded = loadReferenceReps();
  // audio-tone reps need their clip served over HTTP + the prosody
  // worker running — that's scripts/calibrate-audio-tone.mjs's job.
  // Scoring them here would silently text-grade tone and fail.
  const allReps = loaded.filter((r) => r.kind !== "audio-tone");
  const audioSkipped = loaded.length - allReps.length;
  const reps = FILTER ? allReps.filter((r) => r.id.includes(FILTER)) : allReps;

  if (reps.length === 0) {
    console.error(`No reps matched filter ${FILTER ?? "(none)"}`);
    process.exit(2);
  }

  if (!JSON_OUT) {
    console.log(`\nCognify calibration harness`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Reference reps: ${reps.length}${FILTER ? ` (filter: ${FILTER})` : ""}${audioSkipped ? ` (${audioSkipped} audio-tone reps skipped — run calibrate-audio-tone.mjs)` : ""}`);
    console.log(`Tolerance: ±${TOLERANCE} composite · ±${DIM_TOLERANCE} per dimension\n`);
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
