/**
 * Grading Engine V2 — lean-output arm micro-bench (latency lever a).
 *
 * Grading is decode-bound: one gpt-4o call, temp 0.2, and ~8.2s p50 is almost
 * all output-token generation. The lean-output arm cuts the accuracy-neutral
 * output — the never-rendered per-dim `signals` narratives + the over-long
 * feedback cap (400→160 chars) — so it should decode fewer tokens and finish
 * faster while the SCORES (produced by separate fields / the same reasoning)
 * stay put.
 *
 * This measures the mechanism DIRECTLY by calling runSingleCallScore both ways
 * in-process and reading `metrics.outputTokens` + `metrics.modelDurationMs`
 * (the /api/score HTTP body carries no token counts, so the wall-clock bench
 * can't see the token cut). RAG is disabled so there's no DB dependency and
 * both arms see the identical (no-RAG) input — RAG is constant across arms, so
 * it can't affect the control-vs-lean delta anyway.
 *
 *   npx tsx scripts/bench/lean-output-micro.ts            # 6 reps × 2 samples
 *   npx tsx scripts/bench/lean-output-micro.ts --samples 3 --reps 8
 *
 * Exit codes: 0 ok · 1 a call failed / no OPENAI key.
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Env MUST load before the score module is imported — the OpenAI/Anthropic
// clients read their keys at module-init (claude.ts). dotenv first, then a
// dynamic import below guarantees ordering.
config({ path: ".env.local" });
process.env.FF_RAG_RETRIEVE = "false"; // isolate the decode; no DB dependency.
process.env.FF_PROSODY_WORKER = "false";
process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  if (i !== -1 && process.argv[i + 1]) return parseInt(process.argv[i + 1]!, 10);
  return fallback;
}

const SAMPLES = arg("--samples", 2);
const N_REPS = arg("--reps", 6);

type BandRep = {
  id: string;
  kind: string;
  promptText: string;
  transcript: string;
  durationMs: number;
  expected: { composite: number; dimensions: Record<string, number> };
};

function pickStratified(reps: BandRep[], n: number): BandRep[] {
  // Sort by expected composite and take an even spread across the range so
  // the bench sees poor→elite reps, where output length varies most.
  const sorted = [...reps].sort(
    (a, b) => a.expected.composite - b.expected.composite,
  );
  if (sorted.length <= n) return sorted;
  const out: BandRep[] = [];
  for (let i = 0; i < n; i++) {
    out.push(sorted[Math.round((i * (sorted.length - 1)) / (n - 1))]!);
  }
  return [...new Map(out.map((r) => [r.id, r])).values()];
}

function pct(a: number, b: number): string {
  if (b === 0) return "n/a";
  const d = ((a - b) / b) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2));
}

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

async function main() {
  if (!process.env.OPENAI_API_KEY?.startsWith("sk")) {
    console.error("OPENAI_API_KEY not loaded — aborting.");
    process.exit(1);
  }

  // Dynamic import AFTER env is set (clients init from env at module load).
  const { runSingleCallScore } = await import("../../src/lib/ai/score-shared");

  const refPath = resolve(__dirname, "..", "calibration", "reference-reps.json");
  const parsed = JSON.parse(readFileSync(refPath, "utf8")) as { reps: BandRep[] };
  const bandReps = (parsed.reps ?? []).filter(
    (r) => r.kind === "band" && r.expected,
  );
  const reps = pickStratified(bandReps, N_REPS);

  console.log(
    `lean-output micro-bench · ${reps.length} reps × ${SAMPLES} samples/arm · model=${process.env.OPENAI_SCORING_MODEL ?? "gpt-4o"} · RAG off\n`,
  );

  const acc = {
    control: { out: [] as number[], inp: [] as number[], modelMs: [] as number[], totalMs: [] as number[] },
    lean: { out: [] as number[], inp: [] as number[], modelMs: [] as number[], totalMs: [] as number[] },
  };
  // Per-rep mean composite + dim scores per arm, to check accuracy neutrality.
  const scoreDeltas: number[] = []; // |control - lean| composite, per sample-pair
  const dimDeltas: number[] = []; // |control - lean| per dimension

  for (const rep of reps) {
    const input = {
      transcript: rep.transcript,
      promptText: rep.promptText,
      durationMs: rep.durationMs,
    } as Parameters<typeof runSingleCallScore>[0];

    for (let s = 0; s < SAMPLES; s++) {
      // Interleave arms within a sample so provider-side drift hits both.
      const c = await runSingleCallScore(input);
      const l = await runSingleCallScore(input, { lean: true });

      acc.control.out.push(c.metrics.outputTokens ?? 0);
      acc.control.inp.push(c.metrics.inputTokens ?? 0);
      acc.control.modelMs.push(c.metrics.modelDurationMs ?? 0);
      acc.control.totalMs.push(c.metrics.scoreRepTotalMs ?? 0);

      acc.lean.out.push(l.metrics.outputTokens ?? 0);
      acc.lean.inp.push(l.metrics.inputTokens ?? 0);
      acc.lean.modelMs.push(l.metrics.modelDurationMs ?? 0);
      acc.lean.totalMs.push(l.metrics.scoreRepTotalMs ?? 0);

      scoreDeltas.push(Math.abs(c.score.composite - l.score.composite));
      const cDim = Object.fromEntries(
        c.score.dimensions.map((d) => [d.dimension, d.score]),
      );
      for (const d of l.score.dimensions) {
        const cv = cDim[d.dimension];
        if (typeof cv === "number") dimDeltas.push(Math.abs(cv - d.score));
      }

      process.stdout.write(
        `  ${rep.id} s${s + 1}: control out=${c.metrics.outputTokens} ${c.metrics.modelDurationMs}ms · lean out=${l.metrics.outputTokens} ${l.metrics.modelDurationMs}ms\n`,
      );
    }
  }

  const row = (label: string, a: typeof acc.control) =>
    `  ${label.padEnd(8)} out ${String(mean(a.out)).padStart(5)} (p50 ${String(median(a.out)).padStart(4)}) · in ${String(mean(a.inp)).padStart(5)} · model p50 ${String(median(a.modelMs)).padStart(5)}ms (mean ${mean(a.modelMs)}ms) · total p50 ${median(a.totalMs)}ms`;

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(row("control", acc.control));
  console.log(row("lean", acc.lean));
  console.log("  ── deltas (lean vs control) ──");
  console.log(
    `  output tokens: ${pct(mean(acc.lean.out), mean(acc.control.out))}  ·  model latency p50: ${pct(median(acc.lean.modelMs), median(acc.control.modelMs))}  ·  model latency mean: ${pct(mean(acc.lean.modelMs), mean(acc.control.modelMs))}`,
  );
  console.log(
    `  accuracy neutrality: composite |Δ| mean ${mean(scoreDeltas)} · per-dim |Δ| mean ${mean(dimDeltas)} (LLM run-to-run noise floor ~2-5pt; lean should sit inside it)`,
  );
  console.log("════════════════════════════════════════════════════════════");
}

main().catch((e) => {
  console.error(`\nmicro-bench failed: ${e.message}`);
  process.exit(1);
});
