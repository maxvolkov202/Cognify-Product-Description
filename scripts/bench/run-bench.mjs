#!/usr/bin/env node
/**
 * Grading Engine V2 — unified grading eval bench.
 *
 * One command that scores the reference bank through /api/score (for the arm
 * the target deploy is configured for) and reports, in one place:
 *
 *   accuracy   — MAE per dimension + composite vs the human-authored expected
 *                scores, and band-match rate (reuses calibration/_bands.mjs)
 *   feedback   — groundedness / distinctness / banned-filler (feedback-quality.mjs)
 *   variance   — per-dim run-to-run spread over a subset (variance-harness.mjs)
 *   latency    — client-side p50/p95 wall-clock per /api/score call
 *
 * Run it twice — once against a `control` deploy, once against a variant
 * deploy (FF_SCORING_VARIANT=true, PERCENT=100, ARM=<arm>) — and diff the two
 * report files to decide whether the variant is worth committing to.
 *
 * Token COST is deliberately not recomputed here (the /api/score response
 * carries no token counts — those live in scoring_telemetry). Use
 * scripts/phase-baseline.mjs for latency+token capture and scripts/bench/
 * pricing.mjs (computeUsd) to turn its telemetry rows into USD per arm.
 *
 * Usage:
 *   node scripts/bench/run-bench.mjs --arm=control
 *   node scripts/bench/run-bench.mjs --arm=median-of-n --n=7
 *   DEV_BASE_URL=https://staging... node scripts/bench/run-bench.mjs --arm=control
 *
 * Exit codes: 0 ok · 1 a call failed / mock-fallback · 2 config.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bandFor, bandsAdjacent } from "../calibration/_bands.mjs";
import {
  scoreOnce,
  runVariance,
  DIMENSIONS,
  DEFAULT_VARIANCE_SUBSET,
} from "./variance-harness.mjs";
import {
  evaluateFeedbackQuality,
  summarizeFeedbackQuality,
} from "./feedback-quality.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_REPS_PATH = resolve(
  __dirname,
  "..",
  "calibration",
  "reference-reps.json",
);
const OUT_DIR = resolve(__dirname, "..", "..", "plans", "bench");

function parseArg(name, fallback = null) {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function mean(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

async function main() {
  const armLabel = parseArg("--arm", "unknown");
  const varianceN = Math.max(2, parseInt(parseArg("--n", "5"), 10) || 5);
  const baseUrl = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
  const guestId = process.env.CALIBRATION_GUEST_ID;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(REF_REPS_PATH, "utf8"));
  } catch (err) {
    console.error(`Failed to read/parse ${REF_REPS_PATH}: ${err.message}`);
    process.exit(2);
  }
  // Accuracy needs expected composite + per-dim scores → band reps only.
  let bandReps = (parsed.reps ?? []).filter(
    (r) => r.kind === "band" && r.expected,
  );
  // --accuracy-ids=a,b,c slims the accuracy pass to a stratified subset
  // (keeps the call budget bounded when sweeping many arms). Variance still
  // uses its own DEFAULT_VARIANCE_SUBSET.
  const accuracyIds = parseArg("--accuracy-ids");
  if (accuracyIds) {
    const want = new Set(accuracyIds.split(",").map((s) => s.trim()));
    const before = bandReps.length;
    bandReps = bandReps.filter((r) => want.has(r.id));
    const missing = [...want].filter((w) => !bandReps.some((r) => r.id === w));
    if (missing.length) {
      console.error(`--accuracy-ids: no band rep matched: ${missing.join(", ")}`);
      process.exit(2);
    }
    console.log(`accuracy subset: ${bandReps.length}/${before} band reps\n`);
  }

  console.log(
    `Grading eval bench · arm=${armLabel} · ${bandReps.length} band reps · ${baseUrl}\n`,
  );

  // ── Accuracy + feedback quality (one scoring pass) ──
  const absErrByDim = Object.fromEntries(DIMENSIONS.map((d) => [d, []]));
  const absErrComposite = [];
  const latenciesMs = [];
  let bandMatches = 0;
  const feedbackPerRep = [];

  for (const rep of bandReps) {
    const t0 = Date.now();
    const score = await scoreOnce(rep, { baseUrl, guestId });
    latenciesMs.push(Date.now() - t0);

    const actualByDim = Object.fromEntries(
      (score.dimensions ?? []).map((d) => [d.dimension, d.score]),
    );
    for (const d of DIMENSIONS) {
      const exp = rep.expected.dimensions?.[d];
      if (typeof exp === "number" && typeof actualByDim[d] === "number") {
        // Skip dims the rep marks untestable without audio (tone/delivery on
        // text-only reps) so they don't pollute the MAE.
        if ((rep.untestableDimensions ?? []).includes(d)) continue;
        absErrByDim[d].push(Math.abs(actualByDim[d] - exp));
      }
    }
    absErrComposite.push(Math.abs(score.composite - rep.expected.composite));
    const actualBand = bandFor(score.composite);
    if (
      actualBand === rep.expected.band ||
      bandsAdjacent(actualBand, rep.expected.band)
    ) {
      bandMatches++;
    }

    feedbackPerRep.push(evaluateFeedbackQuality(score, rep.transcript));
  }

  const maeByDim = Object.fromEntries(
    DIMENSIONS.map((d) => [d, Math.round(mean(absErrByDim[d]) * 10) / 10]),
  );
  const sortedLat = [...latenciesMs].sort((a, b) => a - b);

  // ── Variance over the standard subset ──
  const subsetReps = (parsed.reps ?? []).filter((r) =>
    DEFAULT_VARIANCE_SUBSET.includes(r.id),
  );
  console.log(`Variance (N=${varianceN}) over ${subsetReps.length} reps...`);
  const variance = await runVariance({
    reps: subsetReps,
    n: varianceN,
    baseUrl,
    guestId,
    armLabel,
    log: (m) => console.log(m),
  });

  const report = {
    arm: armLabel,
    baseUrl,
    generatedAt: new Date().toISOString(),
    accuracy: {
      bandReps: bandReps.length,
      maeComposite: Math.round(mean(absErrComposite) * 10) / 10,
      maeByDimension: maeByDim,
      bandMatchRate: Math.round((bandMatches / (bandReps.length || 1)) * 100) / 100,
    },
    feedbackQuality: summarizeFeedbackQuality(feedbackPerRep),
    latencyMs: {
      p50: percentile(sortedLat, 50),
      p95: percentile(sortedLat, 95),
      mean: Math.round(mean(latenciesMs)),
    },
    variance: {
      n: varianceN,
      worstDimSwing: variance.worstDimSwing,
      perRep: variance.perRep,
    },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const outPath = resolve(OUT_DIR, `bench-${armLabel}-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // ── Console summary ──
  console.log("\n════════════════════════════════════════════════");
  console.log(`  arm: ${armLabel}`);
  console.log(`  accuracy  · composite MAE ${report.accuracy.maeComposite} · band-match ${report.accuracy.bandMatchRate}`);
  console.log(
    `            · per-dim MAE ${DIMENSIONS.map((d) => `${d.slice(0, 4)} ${maeByDim[d]}`).join(" · ")}`,
  );
  console.log(
    `  feedback  · grounded ${report.feedbackQuality.avgGroundedFraction} · pairwise-sim ${report.feedbackQuality.avgPairwiseSimilarity} · banned ${report.feedbackQuality.totalBannedFiller}`,
  );
  console.log(`  latency   · p50 ${report.latencyMs.p50}ms · p95 ${report.latencyMs.p95}ms`);
  console.log(`  variance  · worst dim swing ${report.variance.worstDimSwing.value} (${report.variance.worstDimSwing.where})`);
  console.log("════════════════════════════════════════════════");
  console.log(`Report → ${outPath}`);
  console.log(`(cost: run scripts/phase-baseline.mjs + pricing.mjs computeUsd for per-arm USD)`);
}

main().catch((err) => {
  console.error(`\nBench failed: ${err.message}`);
  process.exit(1);
});
