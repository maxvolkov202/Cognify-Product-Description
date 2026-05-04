#!/usr/bin/env node
/**
 * One-off Ch.D1 baseline runner — same comparison logic as
 * `scripts/calibrate-scoring.mjs` but with bounded concurrency so the
 * 36-rep bank completes inside CI/console timeouts. Used once to capture
 * the post-D1 baseline; afterwards the regular harness is enough since
 * the bank size has stabilized.
 *
 * Usage:
 *   node scripts/calibrate-scoring-baseline.mjs           # JSON to stdout
 *   CONCURRENCY=6 node scripts/calibrate-scoring-baseline.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(__dirname, "calibration", "reference-reps.json");
const BASE_URL = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY ?? "4", 10);
const TOLERANCE = 5;

const reps = JSON.parse(readFileSync(REF_REPS_PATH, "utf8")).reps;

function bandFor(score) {
  if (score < 40) return "poor";
  if (score < 60) return "below_standard";
  if (score < 75) return "competent";
  if (score < 85) return "strong";
  if (score < 95) return "excellent";
  return "exceptional";
}

async function scoreOne(rep) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: rep.transcript,
        promptText: rep.promptText,
        durationMs: rep.durationMs,
        ...(rep.audioUrl ? { audioUrl: rep.audioUrl } : {}),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const score = await res.json();
    return { rep, score, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { rep, error: String(err.message ?? err), latencyMs: Date.now() - t0 };
  }
}

async function pool(items, fn, n) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      process.stderr.write(`[${i + 1}/${items.length}] ${items[i].id}\n`);
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

function evaluate(rep, score) {
  const failures = [];
  const dimMap = {};
  for (const d of score.dimensions ?? []) dimMap[d.dimension] = d.score;

  if (rep.kind === "band") {
    const exp = rep.expected;
    const compositeDelta = score.composite - exp.composite;
    if (Math.abs(compositeDelta) > TOLERANCE)
      failures.push(`composite ${compositeDelta > 0 ? "+" : ""}${compositeDelta} (got ${score.composite}, expected ${exp.composite})`);

    const actualBand = bandFor(score.composite);
    if (actualBand !== exp.band) {
      const order = ["poor", "below_standard", "competent", "strong", "excellent", "exceptional"];
      if (Math.abs(order.indexOf(actualBand) - order.indexOf(exp.band)) > 1) {
        failures.push(`band ${actualBand} not adjacent to ${exp.band}`);
      }
    }

    const dimDeltas = {};
    for (const [dim, expected] of Object.entries(exp.dimensions)) {
      const actual = dimMap[dim];
      const delta = actual - expected;
      dimDeltas[dim] = { actual, expected, delta };
      const untestable = exp.untestableDimensions?.includes(dim);
      if (Math.abs(delta) > TOLERANCE && !untestable) {
        failures.push(`${dim} ${delta > 0 ? "+" : ""}${delta} (got ${actual}, expected ${expected})`);
      }
    }
    return { failures, dimDeltas, compositeDelta };
  }

  // independence
  for (const a of rep.assertions ?? []) {
    const actual = dimMap[a.dimension];
    if (a.kind === "minScore" && actual < a.min) failures.push(`${a.dimension}=${actual} < min ${a.min}`);
    if (a.kind === "maxScore" && actual > a.max) failures.push(`${a.dimension}=${actual} > max ${a.max}`);
  }
  return { failures };
}

const start = Date.now();
process.stderr.write(`Running ${reps.length} reps with concurrency=${CONCURRENCY} against ${BASE_URL}\n`);

const raw = await pool(reps, scoreOne, CONCURRENCY);

const results = raw.map((r) => {
  const evalResult = r.error ? { failures: [`request failed: ${r.error}`] } : evaluate(r.rep, r.score);
  return {
    id: r.rep.id,
    kind: r.rep.kind,
    latencyMs: r.latencyMs,
    composite: r.score?.composite ?? null,
    dimensions: r.score?.dimensions
      ? Object.fromEntries(r.score.dimensions.map((d) => [d.dimension, d.score]))
      : null,
    expected:
      r.rep.kind === "band"
        ? { composite: r.rep.expected.composite, dimensions: r.rep.expected.dimensions }
        : null,
    untestableDimensions: r.rep.expected?.untestableDimensions ?? [],
    deltas: evalResult.dimDeltas ?? null,
    compositeDelta: evalResult.compositeDelta ?? null,
    failures: evalResult.failures,
    fallback: r.score?.modelVersion?.startsWith?.("openai-fallback") ?? false,
  };
});

const failed = results.filter((r) => r.failures.length > 0);
const fallbackCount = results.filter((r) => r.fallback).length;

console.log(JSON.stringify({
  totalReps: results.length,
  failedCount: failed.length,
  passRate: ((results.length - failed.length) / results.length * 100).toFixed(1) + "%",
  fallbackCount,
  durationSec: ((Date.now() - start) / 1000).toFixed(1),
  results,
}, null, 2));

process.exit(failed.length === 0 ? 0 : 1);
