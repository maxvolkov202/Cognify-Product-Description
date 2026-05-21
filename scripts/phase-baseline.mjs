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
const PHASE = process.env.PHASE ?? "0";
// Phase 5+ — set TWO_STAGE=true to baseline the two-stage endpoint
// (/api/score/twostage) instead of the legacy single-call /api/score.
// Output JSON tags itself so phase-N.json comparisons stay
// apples-to-apples within the same endpoint mode.
const TWO_STAGE = process.env.TWO_STAGE === "true";
const SCORE_ENDPOINT = TWO_STAGE ? "/api/score/twostage" : "/api/score";

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

async function scoreOne(rep) {
  const body = {
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
  };
  if (rep.audioUrl) body.audioUrl = rep.audioUrl;

  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}${SCORE_ENDPOINT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  console.log(`\n=== Phase ${PHASE} baseline — ${BASE_URL}${SCORE_ENDPOINT} (twoStage=${TWO_STAGE}) ===\n`);

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
  console.log(`Replaying ${subset.length} reference reps through /api/score...\n`);

  const perRep = [];
  for (const rep of subset) {
    process.stdout.write(`  ${rep.id} ... `);
    try {
      const { score, clientLatencyMs } = await scoreOne(rep);
      perRep.push({
        id: rep.id,
        kind: rep.kind,
        composite: score.composite,
        modelVersion: score.modelVersion,
        clientLatencyMs,
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

  // Persist the baseline so future phases can diff against it.
  if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });
  const baselinePath = resolve(BASELINES_DIR, `phase-${PHASE}.json`);
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        phase: PHASE,
        baseUrl: BASE_URL,
        startedAt: startIso,
        subsetIds: SUBSET_IDS,
        perRep,
        summary,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nBaseline persisted to ${baselinePath}`);
  console.log(`Compare future phases with: diff plans/baselines/phase-0.json plans/baselines/phase-N.json\n`);
}

main().catch((err) => {
  console.error("[baseline] fatal:", err);
  process.exit(1);
});
