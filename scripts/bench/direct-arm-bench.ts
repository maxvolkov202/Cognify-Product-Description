/**
 * Grading Engine V2 — direct (server-free) arm accuracy + latency bench.
 *
 * Runs arms IN-PROCESS on the reference band bank and reports per-dimension
 * MAE vs the human-authored expected scores, composite MAE, output tokens,
 * wall-clock latency, and LLM call count — all from `runSingleCallScore` /
 * `runGroupedFanout` return metrics. No dev server, no worktree: the arm is
 * selected here by function, not by `FF_SCORING_VARIANT` env, so this can A/B
 * many arms in one run without the isolated-server dance.
 *
 * Purpose: decide whether the latency levers hold ACCURACY — specifically
 * whether `lean-split` (lever a × b) keeps the parallel-decode latency win
 * WITHOUT the clarity MAE regression the grouped-fanout arm showed in the lean
 * sweep. RAG is disabled (constant across arms, no DB dependency).
 *
 *   npx tsx scripts/bench/direct-arm-bench.ts
 *   npx tsx scripts/bench/direct-arm-bench.ts --arms control,lean-output,lean-split --reps 10 --samples 1
 *
 * Exit codes: 0 ok · 1 no OPENAI key / a call threw.
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.local" });
process.env.FF_RAG_RETRIEVE = "false";
process.env.FF_PROSODY_WORKER = "false";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argStr(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
function argNum(name: string, fallback: number): number {
  const v = argStr(name, String(fallback));
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const ARMS = argStr("--arms", "control,lean-output,lean-split").split(",").map((s) => s.trim());
const N_REPS = argNum("--reps", 10);
const SAMPLES = argNum("--samples", 1);

// ── Model / provider override (experiment 2: faster-model sweep) ──────────
// claude.ts reads these env vars at MODULE LOAD, and the arm modules are
// dynamically imported inside main() below — so setting them here (before any
// import of score-shared/claude) is what makes the override take effect. The
// provider is inferred from the model id unless --provider is given.
const MODEL_OVERRIDE = argStr("--model", "");
const PROVIDER_OVERRIDE = argStr("--provider", "");
function inferProvider(model: string): "openai" | "anthropic" {
  return /claude|haiku|sonnet|opus/i.test(model) ? "anthropic" : "openai";
}
const PROVIDER =
  (PROVIDER_OVERRIDE as "openai" | "anthropic") ||
  (MODEL_OVERRIDE ? inferProvider(MODEL_OVERRIDE) : "") ||
  (process.env.AI_PROVIDER as "openai" | "anthropic") ||
  "openai";
process.env.AI_PROVIDER = PROVIDER;
if (MODEL_OVERRIDE) {
  if (PROVIDER === "anthropic") {
    process.env.ANTHROPIC_SCORING_MODEL = MODEL_OVERRIDE;
  } else {
    process.env.OPENAI_SCORING_MODEL = MODEL_OVERRIDE;
  }
}
const MODEL_LABEL = MODEL_OVERRIDE || (PROVIDER === "anthropic" ? "claude(default)" : "gpt-4o");

const DIMS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
] as const;
type Dim = (typeof DIMS)[number];

type BandRep = {
  id: string;
  kind: string;
  promptText: string;
  transcript: string;
  durationMs: number;
  untestableDimensions?: string[];
  expected: { composite: number; dimensions: Record<string, number> };
};

function pickStratified(reps: BandRep[], n: number): BandRep[] {
  const sorted = [...reps].sort((a, b) => a.expected.composite - b.expected.composite);
  if (sorted.length <= n) return sorted;
  const out: BandRep[] = [];
  for (let i = 0; i < n; i++) {
    out.push(sorted[Math.round((i * (sorted.length - 1)) / (n - 1))]!);
  }
  return [...new Map(out.map((r) => [r.id, r])).values()];
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r1 = (x: number) => Math.round(x * 10) / 10;
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2)) : 0;
}

async function main() {
  const keyOk =
    PROVIDER === "anthropic"
      ? !!process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY?.startsWith("sk");
  if (!keyOk) {
    console.error(
      `${PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"} not loaded — aborting.`,
    );
    process.exit(1);
  }
  const { runSingleCallScore } = await import("../../src/lib/ai/score-shared");
  const { runGroupedFanout, runPerSkillFanout } = await import(
    "../../src/lib/ai/score-arm-b"
  );

  type ArmFn = (
    input: Parameters<typeof runSingleCallScore>[0],
  ) => ReturnType<typeof runSingleCallScore>;
  const ARM_FNS: Record<string, ArmFn> = {
    control: (i) => runSingleCallScore(i),
    "lean-output": (i) => runSingleCallScore(i, { lean: true }),
    "lean-split": (i) => runGroupedFanout(i, { lean: true }),
    "grouped-fanout": (i) => runGroupedFanout(i),
    "per-skill-fanout": (i) => runPerSkillFanout(i),
    // Milder feedback-trim sweep (experiment 1). `lean-400` = signals-only
    // floor (invisible field dropped, feedback prose byte-identical to
    // control); 320/280/240/160 = progressively tighter feedback caps.
    "lean-400": (i) => runSingleCallScore(i, { leanFeedbackCap: 400 }),
    "lean-320": (i) => runSingleCallScore(i, { leanFeedbackCap: 320 }),
    "lean-280": (i) => runSingleCallScore(i, { leanFeedbackCap: 280 }),
    "lean-240": (i) => runSingleCallScore(i, { leanFeedbackCap: 240 }),
    "lean-160": (i) => runSingleCallScore(i, { leanFeedbackCap: 160 }),
  };

  const refPath = resolve(__dirname, "..", "calibration", "reference-reps.json");
  const parsed = JSON.parse(readFileSync(refPath, "utf8")) as { reps: BandRep[] };
  const bandReps = (parsed.reps ?? []).filter((r) => r.kind === "band" && r.expected);
  const reps = pickStratified(bandReps, N_REPS);

  console.log(
    `direct-arm bench · arms=[${ARMS.join(", ")}] · ${reps.length} reps × ${SAMPLES} samples · ${PROVIDER}:${MODEL_LABEL} · RAG off\n`,
  );

  type ArmAcc = {
    absByDim: Record<Dim, number[]>;
    absComposite: number[];
    out: number[];
    totalMs: number[];
    calls: number[];
  };
  const acc: Record<string, ArmAcc> = {};
  for (const a of ARMS) {
    acc[a] = {
      absByDim: Object.fromEntries(
        DIMS.map((d) => [d, [] as number[]]),
      ) as Record<Dim, number[]>,
      absComposite: [],
      out: [],
      totalMs: [],
      calls: [],
    };
  }

  for (const rep of reps) {
    const input = {
      transcript: rep.transcript,
      promptText: rep.promptText,
      durationMs: rep.durationMs,
    } as Parameters<typeof runSingleCallScore>[0];

    for (let s = 0; s < SAMPLES; s++) {
      for (const armName of ARMS) {
        const fn = ARM_FNS[armName];
        if (!fn) {
          console.error(`unknown arm: ${armName}`);
          process.exit(1);
        }
        const res = await fn(input);
        const a = acc[armName]!;
        const byDim = Object.fromEntries(
          res.score.dimensions.map((d) => [d.dimension, d.score]),
        ) as Record<Dim, number>;
        for (const d of DIMS) {
          const exp = rep.expected.dimensions?.[d];
          if (typeof exp === "number" && typeof byDim[d] === "number") {
            a.absByDim[d].push(Math.abs(byDim[d] - exp));
          }
        }
        a.absComposite.push(Math.abs(res.score.composite - rep.expected.composite));
        a.out.push(res.metrics.outputTokens ?? 0);
        a.totalMs.push(res.metrics.scoreRepTotalMs ?? 0);
        a.calls.push(res.metrics.llmCallCount ?? 1);
      }
    }
    process.stdout.write(
      `  ${rep.id.padEnd(42)} ` +
        ARMS.map((a) => {
          const byComp = acc[a]!.absComposite;
          const byClar = acc[a]!.absByDim.clarity;
          return `${a}: cΔ${byComp[byComp.length - 1]} clarΔ${byClar[byClar.length - 1] ?? "-"}`;
        }).join(" · ") +
        "\n",
    );
  }

  console.log("\n════════════════════════════════════════════════════════════");
  const head =
    "  arm".padEnd(16) +
    "comp".padStart(6) +
    DIMS.map((d) => d.slice(0, 5).padStart(7)).join("") +
    "   out  latP50  calls";
  console.log(head);
  for (const armName of ARMS) {
    const a = acc[armName]!;
    const row =
      `  ${armName}`.padEnd(16) +
      r1(mean(a.absComposite)).toFixed(1).padStart(6) +
      DIMS.map((d) => r1(mean(a.absByDim[d])).toFixed(1).padStart(7)).join("") +
      String(Math.round(mean(a.out))).padStart(6) +
      `${median(a.totalMs)}ms`.padStart(8) +
      String(r1(mean(a.calls))).padStart(6);
    console.log(row);
  }
  console.log("════════════════════════════════════════════════════════════");
  console.log("  (comp + per-dim columns = MAE vs human expected, lower=better)");
}

main().catch((e) => {
  console.error(`\ndirect-arm bench failed: ${e.stack ?? e.message}`);
  process.exit(1);
});
