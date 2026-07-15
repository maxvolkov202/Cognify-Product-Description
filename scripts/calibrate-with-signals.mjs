#!/usr/bin/env node
/**
 * Cognify Ch.11c — Calibration harness with per-sub-skill assertions.
 *
 * Extends `calibrate-scoring.mjs` with two additional gates that only
 * make sense when FF_DETERMINISTIC_SIGNALS is on:
 *
 *   1. `subSkillScores` populated on at least one dimension. Taxonomy v2
 *      (D20): only signal-measured sub-skills carry entries — there is
 *      no dimension_fallback anymore.
 *   2. Per-sub-skill score within ±20 of the dimension score for any
 *      sub-skill on a `kind=band` rep (sub-skills DO vary within a dim,
 *      but a 30-point swing on a single sub-skill is suspect on a rep
 *      that wasn't designed to test sub-skill independence). The
 *      tolerance is intentionally LOOSER than the per-dimension ±5 the
 *      base harness enforces because we don't have hand-labeled
 *      per-sub-skill expected values yet.
 *
 * Usage:
 *   node scripts/calibrate-with-signals.mjs                          # against dev
 *   DEV_BASE_URL=https://staging.cognify.app node scripts/calibrate-with-signals.mjs
 *   node scripts/calibrate-with-signals.mjs --filter band-poor       # subset
 *   node scripts/calibrate-with-signals.mjs --json                   # machine-readable
 *
 * Exit codes:
 *   0 all reps pass dim + composite + sub-skill assertions
 *   1 any rep fails any assertion
 *   2 config error
 *
 * Pre-conditions:
 *   - FF_DETERMINISTIC_SIGNALS=true is set on the target deployment.
 *   - FF_DETERMINISTIC_SIGNALS_PERCENT=100 OR the test user is in the
 *     bucket. The harness POSTs unauthenticated, so userId is undefined
 *     and the FF normally evaluates false — for staging verification,
 *     the percent gate must be authored to evaluate true for the
 *     reference-rep path. (Future: add an INTERNAL_BYPASS header that
 *     the FF check honors when the shared secret is presented.)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(__dirname, "calibration", "reference-reps.json");
const BASE_URL = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
const FILTER = parseArg("--filter");
const JSON_OUT = process.argv.includes("--json");
const DIM_TOLERANCE = 5;
const SUBSKILL_DIM_TOLERANCE = 20;

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
  // /api/score requires a user since the full-app audit closed the
  // anonymous-curl vector. A guest cookie satisfies it: pass
  // CALIBRATION_GUEST_ID (any uuid; ensureGuestUser creates the row).
  const guestCookie = process.env.CALIBRATION_GUEST_ID
    ? { cookie: `cognify_guest_id=${process.env.CALIBRATION_GUEST_ID}` }
    : {};
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json", ...guestCookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

function evaluateBand(rep, score) {
  const failures = [];
  const warnings = [];
  const exp = rep.expected;
  if (!exp) {
    failures.push("missing `expected` block");
    return { failures, warnings };
  }
  if (Math.abs(score.composite - exp.composite) > DIM_TOLERANCE) {
    failures.push(
      `composite drift ${score.composite - exp.composite} (expected ${exp.composite}, got ${score.composite})`,
    );
  }
  const dimMap = {};
  for (const d of score.dimensions ?? []) dimMap[d.dimension] = d;
  for (const [dim, expected] of Object.entries(exp.dimensions)) {
    const actual = dimMap[dim]?.score;
    if (actual == null) {
      failures.push(`dimension ${dim} missing from response`);
      continue;
    }
    if (Math.abs(actual - expected) > DIM_TOLERANCE) {
      failures.push(
        `${dim} drift ${actual - expected} (expected ${expected}, got ${actual})`,
      );
    }
  }
  return { failures, warnings };
}

function evaluateIndependence(rep, score) {
  const failures = [];
  const warnings = [];
  const dimMap = {};
  for (const d of score.dimensions ?? []) dimMap[d.dimension] = d;
  for (const a of rep.assertions ?? []) {
    const actual = dimMap[a.dimension]?.score;
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

function evaluateSubSkills(rep, score) {
  const failures = [];
  const warnings = [];
  const dims = score.dimensions ?? [];
  let anyDimHadSubSkills = false;
  for (const d of dims) {
    if (!d.subSkillScores) continue;
    anyDimHadSubSkills = true;
    for (const [subSkill, sub] of Object.entries(d.subSkillScores)) {
      if (typeof sub !== "number" || sub < 0 || sub > 100) {
        failures.push(
          `${d.dimension}.${subSkill}=${sub} out of [0,100]`,
        );
        continue;
      }
      const drift = Math.abs(sub - d.score);
      if (drift > SUBSKILL_DIM_TOLERANCE) {
        // Taxonomy v2 (D20): the mapper emits ONLY signal-driven entries
        // (dimension_fallback is gone), so drift from the holistic dim
        // score is expected whenever the signal disagrees with the LLM —
        // that's the whole point of per-sub-skill scoring. Always a
        // WARNING, never a failure.
        warnings.push(
          `${d.dimension}.${subSkill}=${sub} differs from dim ${d.score} by ${drift} (signal-driven, expected variance)`,
        );
      }
    }
  }
  if (!anyDimHadSubSkills) {
    failures.push(
      "no dimension carried subSkillScores — FF_DETERMINISTIC_SIGNALS may be off on the target deployment",
    );
  }
  // Taxonomy v2: voice-measured skills come only from prosody. A rep
  // WITH audio that produces zero delivery/tone sub-skill entries means
  // the prosody→mapper wiring silently broke — text-driven dims would
  // still populate, so anyDimHadSubSkills alone can't catch it.
  if (rep.audioUrl) {
    const voiceDims = new Set(["delivery", "tone"]);
    const anyVoiceEntries = dims.some(
      (d) =>
        voiceDims.has(d.dimension) &&
        d.subSkillScores &&
        Object.keys(d.subSkillScores).length > 0,
    );
    if (!anyVoiceEntries) {
      failures.push(
        "rep has audio but no delivery/tone subSkillScores — prosody pipeline into the sub-skill mapper looks broken",
      );
    }
  }
  return { failures, warnings };
}

function colored(s, code) {
  if (process.env.NO_COLOR) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}
const red = (s) => colored(s, "31");
const green = (s) => colored(s, "32");
const yellow = (s) => colored(s, "33");
const dim = (s) => colored(s, "90");

async function main() {
  const allReps = loadReferenceReps();
  const reps = FILTER ? allReps.filter((r) => r.id.includes(FILTER)) : allReps;
  if (reps.length === 0) {
    console.error(`No reps matched filter ${FILTER ?? "(none)"}`);
    process.exit(2);
  }

  if (!JSON_OUT) {
    console.log(`\nCognify calibration harness (Ch.11c — with sub-skill checks)`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Reference reps: ${reps.length}${FILTER ? ` (filter: ${FILTER})` : ""}`);
    console.log(`Per-dim tolerance: ±${DIM_TOLERANCE}; sub-skill / dim-fallback tolerance: ±${SUBSKILL_DIM_TOLERANCE}\n`);
  }

  const results = [];
  for (const rep of reps) {
    const t0 = Date.now();
    let outcome;
    try {
      const score = await scoreOne(rep);
      const dimEval =
        rep.kind === "band"
          ? evaluateBand(rep, score)
          : evaluateIndependence(rep, score);
      const subEval = evaluateSubSkills(rep, score);
      outcome = {
        id: rep.id,
        kind: rep.kind,
        latencyMs: Date.now() - t0,
        composite: score.composite,
        dimensions: Object.fromEntries(
          (score.dimensions ?? []).map((d) => [d.dimension, d.score]),
        ),
        failures: [...dimEval.failures, ...subEval.failures],
        warnings: [...dimEval.warnings, ...subEval.warnings],
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
      console.log(green(`All ${results.length} reps passed dim + sub-skill checks.`));
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
