#!/usr/bin/env node
/**
 * Phase-baseline replay harness for the RAG + scoring overhaul.
 *
 * Picks a fixed subset of reference reps (same 10 every phase →
 * apples-to-apples comparison) and POSTs each through /api/score on the
 * running dev server. Each call writes a scoring_telemetry row.
 * Afterward, we query the rows the run just wrote and print a clean
 * report.
 *
 * The subset is deterministic: 10 reps spanning different bands and
 * the inter-skill independence cases that stress the scoring pipeline
 * in different ways:
 *   - band-poor-mic-test       (junk rep → must score low, not anchor to 70)
 *   - band-poor-rambling
 *   - band-below-vague-opener
 *   - band-competent-clear-but-shallow
 *   - band-strong-storytelling
 *   - band-excellent-exec-briefing
 *   - independence-organized-but-shallow
 *   - independence-fast-no-fillers
 *   - independence-variety-with-upspeak
 *   - independence-short-but-deep
 *
 * Usage:
 *   node scripts/phase-baseline.mjs               # phase auto-detected from progress file
 *   PHASE=1 node scripts/phase-baseline.mjs       # explicit phase tag
 *   DEV_BASE_URL=http://localhost:3333 node scripts/phase-baseline.mjs
 *
 * Muscle-group pivot launch run:
 *   node scripts/phase-baseline.mjs --mode=muscle-group-final
 *   node scripts/phase-baseline.mjs --mode=muscle-group-final \
 *      --compare-against=plans/baselines/phase-pre-pivot.json    # ±5 gate
 *   node scripts/phase-baseline.mjs --mode=muscle-group-final \
 *      --exercise-id=kill-the-filler                              # spotcheck
 *
 * Output:
 *   - JSON report of each rep: composite, dim breakdown, latency, fallback
 *   - Aggregate: p50/p95/p99 of total + model latency, cache hit rate,
 *     mock-fallback rate, OpenAI-fallback rate, avg prompt size
 *   - Telemetry table snapshot for the rows this run wrote
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(__dirname, "calibration", "reference-reps.json");
const BASELINES_DIR = resolve(__dirname, "..", "plans", "baselines");
const BASE_URL = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";

// CLI flags (env-vars still supported for backwards compat with the
// pre-pivot phase-N runs). Flags win over env when both set.
const FLAGS = parseCliFlags(process.argv.slice(2));
const PHASE = FLAGS.phase ?? process.env.PHASE ?? "0";

// --- Muscle-group pivot mode ------------------------------------------
//
// `--mode=muscle-group-final` runs the same 10-rep subset against the
// two-stage scoring endpoint with the post-pivot code path active. Two
// sub-behaviors:
//
//   * Without --exercise-id: legacy-shape calibration replay. The
//     pivot's RAG-dim-filter + exercise-hydration changes MUST produce
//     byte-equivalent composites for legacy reps (no exerciseId).
//     `--compare-against=<baseline-path>` runs the tolerance check
//     (±5 composite / ±8 dim, ≥9 of 10) and exits non-zero on breach.
//
//   * With --exercise-id=<slug>: per-exercise spot-check. Pins the
//     muscle-group exercise on every rep so the run exercises the
//     <exercise/> XML block + RAG preferredDim filter + (when the slug
//     has one) the fast-fail floor. Observational — no tolerance gate.
//
// `phase-baseline-final` is the canonical baseline filename for the
// pre-launch replay run. The launch checklist references this path.
//
// `--mode=post-strict-rubric` (Phase HC-5) runs against the same 10-rep
// subset after the Phase HC-3 scoring tightening. Compares against the
// pre-HC-3 baseline to QUANTIFY the rubric shift — we EXPECT scores to
// drop on the "barely tried" and "vague" reps (10-25 and 30-45 bands)
// while strong/excellent reps should stay within ±5. Output filename:
// plans/baselines/post-strict-rubric.json. Run after Max funds API
// credits (~$2-3 wall-clock):
//   node scripts/phase-baseline.mjs --mode=post-strict-rubric \
//        --compare-against=plans/baselines/phase-pre-pivot.json
const MODE = FLAGS.mode ?? "legacy";
const EXERCISE_SLUG = FLAGS["exercise-id"] ?? null;
const COMPARE_AGAINST = FLAGS["compare-against"] ?? null;
const COMPOSITE_TOLERANCE = parseInt(FLAGS["composite-tolerance"] ?? "5", 10);
const DIM_TOLERANCE = parseInt(FLAGS["dim-tolerance"] ?? "8", 10);
const MIN_HOLD_RATE = parseFloat(FLAGS["min-hold-rate"] ?? "0.9");

// Phase 3 (grading v3) retired the two-stage endpoints — every baseline
// runs against the unified single-call /api/score. (Historical baselines
// tagged muscle-group-final / post-strict-rubric were captured on the
// deleted /api/score/twostage; latency comparisons across that boundary
// aren't apples-to-apples.)
const SCORE_ENDPOINT = "/api/score";

function parseCliFlags(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      out[arg.slice(2)] = "true";
    } else {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return out;
}

// Fixed deterministic subset — DO NOT change between phases.
// If you add reps to reference-reps.json, do NOT add them here without
// also re-running every prior phase's baseline to keep comparisons valid.
// Picked to span:
//   - the full band ladder (poor → exceptional) so we cover the score range
//   - 2 edge-case reps (mic-test junk + shallow-but-organized) that stress
//     the anti-hallucination + edge-case grading rules
//   - independence reps that pressure-test inter-skill orthogonality
//   - 1 long-form rep (60s) to exercise the prompt-size + truncation path
const SUBSET_IDS = [
  "band-poor-mic-test",              // junk rep — must not anchor to 70
  "band-below-rambling-pitch",       // weak rep — lower band
  "band-competent-okay-pitch",       // middle of the road
  "band-strong-clean-pitch",         // strong rep
  "band-excellent-tight-pitch",      // top band
  "edge-shallow-but-organized",      // independence: high structure, low thinking
  "edge-fast-no-fillers",            // independence: fast pace ≠ good delivery
  "edge-variety-with-upspeak",       // independence: variety doesn't cancel upspeak
  "indep-clear-but-padded",          // long-form (60s) — prompt-size + truncation stress
  "qa-strong-pricing-question",      // Q&A archetype variety
];

function loadReferenceReps() {
  const raw = readFileSync(REF_REPS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.reps;
}

async function scoreOne(rep, opts = {}) {
  const body = {
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
  };
  if (rep.audioUrl) body.audioUrl = rep.audioUrl;
  if (opts.exerciseId) body.exerciseId = opts.exerciseId;

  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}${SCORE_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // /api/score requires an auth or guest identity (the open-curl
      // vector was closed post-Phase-1) — same convention as the
      // calibrate-* harnesses.
      ...(process.env.CALIBRATION_GUEST_ID
        ? { cookie: `cognify_guest_id=${process.env.CALIBRATION_GUEST_ID}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
  const clientLatencyMs = Date.now() - t0;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  const score = await res.json();
  return { score, clientLatencyMs };
}

async function lookupExerciseIdBySlug(slug) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("--exercise-id requires DATABASE_URL to resolve the slug");
  }
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const rows = await sql`
      SELECT id::text, slug, name, dimension::text AS dimension
      FROM cognify_v2.exercises
      WHERE slug = ${slug}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } finally {
    await sql.end();
  }
}

function compareAgainstBaseline(perRep, baselinePath) {
  if (!existsSync(baselinePath)) {
    throw new Error(`compare-against baseline not found: ${baselinePath}`);
  }
  const prev = JSON.parse(readFileSync(baselinePath, "utf8"));
  const prevById = new Map(prev.perRep.map((r) => [r.id, r]));

  const compositeBreaches = [];
  let held = 0;
  let total = 0;
  for (const curr of perRep) {
    const before = prevById.get(curr.id);
    if (!before || curr.error || before.error) continue;
    total += 1;
    const delta = Math.abs((curr.composite ?? 0) - (before.composite ?? 0));
    if (delta <= COMPOSITE_TOLERANCE) {
      held += 1;
    } else {
      compositeBreaches.push({
        id: curr.id,
        before: before.composite,
        after: curr.composite,
        delta,
      });
    }
  }
  const holdRate = total === 0 ? 0 : held / total;
  return { total, held, holdRate, compositeBreaches };
}

async function queryTelemetry(sinceIso) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[baseline] DATABASE_URL not set — skipping telemetry query");
    return [];
  }
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const rows = await sql`
      SELECT
        id,
        source,
        model_used,
        prompt_size_bytes,
        input_tokens,
        output_tokens,
        cache_read_tokens,
        cache_creation_tokens,
        model_duration_ms,
        validation_duration_ms,
        total_server_duration_ms,
        failure_reason,
        composite_score,
        created_at
      FROM cognify_v2.scoring_telemetry
      WHERE created_at >= ${sinceIso}
      ORDER BY created_at ASC
    `;
    return rows;
  } finally {
    await sql.end();
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].filter((n) => n != null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarizeTelemetry(rows) {
  const total = rows.map((r) => r.total_server_duration_ms);
  const model = rows.map((r) => r.model_duration_ms);
  const promptSize = rows.map((r) => r.prompt_size_bytes).filter(Boolean);
  const cacheHits = rows.filter((r) => (r.cache_read_tokens ?? 0) > 0).length;
  const failureCounts = {};
  for (const r of rows) {
    failureCounts[r.failure_reason] = (failureCounts[r.failure_reason] ?? 0) + 1;
  }
  return {
    count: rows.length,
    totalLatencyMs: {
      p50: percentile(total, 50),
      p95: percentile(total, 95),
      p99: percentile(total, 99),
    },
    modelLatencyMs: {
      p50: percentile(model, 50),
      p95: percentile(model, 95),
      p99: percentile(model, 99),
    },
    avgPromptSizeBytes:
      promptSize.length > 0
        ? Math.round(promptSize.reduce((a, b) => a + b, 0) / promptSize.length)
        : null,
    cacheHitRate: rows.length === 0 ? 0 : cacheHits / rows.length,
    failureReasonCounts: failureCounts,
    mockFallbackRate:
      rows.length === 0
        ? 0
        : (failureCounts["mock_fallback_both_failed"] ?? 0) / rows.length,
    openaiFallbackRate:
      rows.length === 0
        ? 0
        : (failureCounts["openai_fallback_used"] ?? 0) / rows.length,
  };
}

async function main() {
  console.log(`\n=== Phase ${PHASE} baseline — ${BASE_URL}${SCORE_ENDPOINT} (mode=${MODE}) ===\n`);

  // Resolve exercise pin (muscle-group-final + exercise-id).
  let exercise = null;
  if (EXERCISE_SLUG) {
    if (MODE !== "muscle-group-final") {
      console.error("--exercise-id requires --mode=muscle-group-final");
      process.exit(2);
    }
    exercise = await lookupExerciseIdBySlug(EXERCISE_SLUG);
    if (!exercise) {
      console.error(`Exercise slug "${EXERCISE_SLUG}" not found in cognify_v2.exercises`);
      process.exit(2);
    }
    console.log(`Exercise pinned: ${exercise.name} (${exercise.slug}, dim=${exercise.dimension}, id=${exercise.id})\n`);
  }

  const allReps = loadReferenceReps();
  const subset = SUBSET_IDS.map((id) => {
    const r = allReps.find((x) => x.id === id);
    if (!r) {
      console.error(`Reference rep "${id}" not found in reference-reps.json`);
      process.exit(2);
    }
    return r;
  });

  const startIso = new Date().toISOString();
  console.log(`Run started at ${startIso}`);
  console.log(`Replaying ${subset.length} reference reps through ${SCORE_ENDPOINT}...\n`);

  const perRep = [];
  for (const rep of subset) {
    process.stdout.write(`  ${rep.id} ... `);
    try {
      const { score, clientLatencyMs } = await scoreOne(rep, {
        exerciseId: exercise?.id,
      });
      perRep.push({
        id: rep.id,
        kind: rep.kind,
        composite: score.composite,
        modelVersion: score.modelVersion,
        clientLatencyMs,
        ...(exercise ? { exerciseId: exercise.id, exerciseSlug: exercise.slug } : {}),
      });
      console.log(
        `composite=${score.composite} model=${score.modelVersion} client=${clientLatencyMs}ms`,
      );
    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      perRep.push({ id: rep.id, error: err.message });
    }
    // Small spacer — well under the 30/min rate limit but lets cache settle.
    await new Promise((r) => setTimeout(r, 250));
  }

  // Give the fire-and-forget telemetry writes a moment to land.
  console.log("\nWaiting 2s for telemetry writes to flush...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\nQuerying scoring_telemetry rows from this run...");
  const rows = await queryTelemetry(startIso);
  const summary = summarizeTelemetry(rows);

  console.log(`\n=== Phase ${PHASE} baseline report ===\n`);
  console.log(`Reps replayed: ${perRep.length}`);
  console.log(`Telemetry rows captured: ${rows.length}`);
  console.log(`\nLatency (ms):`);
  console.log(`  total p50/p95/p99  : ${summary.totalLatencyMs.p50} / ${summary.totalLatencyMs.p95} / ${summary.totalLatencyMs.p99}`);
  console.log(`  model p50/p95/p99  : ${summary.modelLatencyMs.p50} / ${summary.modelLatencyMs.p95} / ${summary.modelLatencyMs.p99}`);
  console.log(`\nPrompt size avg     : ${summary.avgPromptSizeBytes} bytes`);
  console.log(`Cache hit rate      : ${(summary.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`Mock-fallback rate  : ${(summary.mockFallbackRate * 100).toFixed(1)}%`);
  console.log(`OpenAI-fallback rate: ${(summary.openaiFallbackRate * 100).toFixed(1)}%`);
  console.log(`\nFailure reason distribution:`);
  for (const [reason, count] of Object.entries(summary.failureReasonCounts)) {
    console.log(`  ${reason.padEnd(28)} ${count}`);
  }

  // Persist the baseline. Filename diverges for the pivot's launch run
  // so a per-exercise spotcheck doesn't overwrite the legacy-shape
  // baseline.
  if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });
  let baselineName;
  if (MODE === "muscle-group-final") {
    baselineName = exercise
      ? `muscle-group-pivot-spotcheck-${exercise.slug}.json`
      : `muscle-group-pivot-final.json`;
  } else if (MODE === "post-strict-rubric") {
    baselineName = "post-strict-rubric.json";
  } else {
    baselineName = `phase-${PHASE}.json`;
  }
  const baselinePath = resolve(BASELINES_DIR, baselineName);
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        phase: PHASE,
        mode: MODE,
        baseUrl: BASE_URL,
        startedAt: startIso,
        subsetIds: SUBSET_IDS,
        ...(exercise
          ? { exerciseId: exercise.id, exerciseSlug: exercise.slug, exerciseDimension: exercise.dimension }
          : {}),
        perRep,
        summary,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nBaseline persisted to ${baselinePath}`);

  // Tolerance gate (only with --compare-against).
  if (COMPARE_AGAINST) {
    const comparePath = resolve(COMPARE_AGAINST);
    console.log(`\nComparing against baseline: ${comparePath}`);
    const gate = compareAgainstBaseline(perRep, comparePath);
    console.log(`\n=== Tolerance gate (composite ±${COMPOSITE_TOLERANCE}, ≥${(MIN_HOLD_RATE * 100).toFixed(0)}% hold) ===`);
    console.log(`Compared: ${gate.total} reps`);
    console.log(`Held within tolerance: ${gate.held} (${(gate.holdRate * 100).toFixed(1)}%)`);
    if (gate.compositeBreaches.length > 0) {
      console.log(`\nBreaches:`);
      for (const b of gate.compositeBreaches) {
        console.log(`  ${b.id.padEnd(36)} before=${b.before} after=${b.after} delta=${b.delta}`);
      }
    }
    if (gate.holdRate < MIN_HOLD_RATE) {
      console.error(`\n✗ FAIL — hold rate ${(gate.holdRate * 100).toFixed(1)}% < ${(MIN_HOLD_RATE * 100).toFixed(0)}% threshold`);
      process.exit(3);
    }
    console.log(`\n✓ PASS — hold rate within tolerance.\n`);
  } else if (MODE === "muscle-group-final" && !exercise) {
    console.log(`\nTip: rerun with --compare-against=plans/baselines/phase-pre-pivot.json to gate drift.\n`);
  }
}

main().catch((err) => {
  console.error("[baseline] fatal:", err);
  process.exit(1);
});
