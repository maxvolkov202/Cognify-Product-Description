/**
 * Grading Engine V2 — unit tests for the variant scoring arms + the
 * flag-gated arm selector. runScoringArm takes the control scorer as a
 * parameter, so we drive it with a fake control that returns canned
 * results — no LLM, no DB.
 */

import { runScoringArm } from "@/lib/ai/score-arms";
import { selectScoringArm } from "@/lib/ai/score";
import {
  applyHybridLayer,
  LEAN_SYSTEM_PROMPT,
  scoringResponseSchema,
} from "@/lib/ai/score-shared";
import type { ScoreRepInput, ScoreRepResult } from "@/lib/ai/score";
import type { SkillDimension } from "@/types/domain";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const DIMS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

function makeResult(
  scores: Record<SkillDimension, number>,
  metrics: Partial<Record<string, number | boolean>> = {},
): ScoreRepResult {
  return {
    score: {
      composite: 0,
      dimensions: DIMS.map((d) => ({
        dimension: d,
        score: scores[d],
        signals: [],
        feedback: `feedback for ${d}`,
        subSkill: null,
      })),
      callouts: [],
      modelVersion: "test",
      rubricVersion: "test",
      headline: "h",
      coachFocus: {
        dimension: "clarity",
        subSkill: null,
        behavior: "b",
        why: "w",
        action: "a",
      },
      strongerVersion: null,
      primaryFocusDimension: "clarity",
      headlineTone: "directive",
      nextRepHint: "hint",
      feedbackVersion: "test",
      prosodyAvailable: false,
      requiresHumanReview: false,
    },
    metrics: {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      modelDurationMs: 10,
      validationDurationMs: 1,
      scoreRepTotalMs: 11,
      ragDurationMs: 0,
      ragChunkCount: 0,
      fallbackFired: false,
      modelUsed: "test",
      promptSizeBytes: 0,
      ...metrics,
    },
  } as unknown as ScoreRepResult;
}

const baseInput = {
  transcript: "t",
  durationMs: 60000,
  words: [],
  promptText: "p",
} as unknown as ScoreRepInput;

async function run() {
  // ── median-of-n: per-dimension median + recomputed composite ──
  {
    process.env.FF_SCORING_VARIANT_N = "3";
    // Three runs with distinct scores; median per dim is the middle value.
    const runsData: Record<SkillDimension, number>[] = [
      { clarity: 80, structure: 50, conciseness: 60, thinking_quality: 70, delivery: 40, tone: 90 },
      { clarity: 70, structure: 60, conciseness: 62, thinking_quality: 72, delivery: 45, tone: 80 },
      { clarity: 60, structure: 55, conciseness: 61, thinking_quality: 71, delivery: 50, tone: 85 },
    ];
    let call = 0;
    const control = async () => makeResult(runsData[call++ % 3]!);
    const result = await runScoringArm("median-of-n", baseInput, control);

    const byDim = Object.fromEntries(
      result.score.dimensions.map((d) => [d.dimension, d.score]),
    );
    check("median clarity = 70", byDim.clarity === 70, `got ${byDim.clarity}`);
    check("median structure = 55", byDim.structure === 55, `got ${byDim.structure}`);
    check("median conciseness = 61", byDim.conciseness === 61, `got ${byDim.conciseness}`);
    check("median thinking = 71", byDim.thinking_quality === 71, `got ${byDim.thinking_quality}`);
    check("median delivery = 45", byDim.delivery === 45, `got ${byDim.delivery}`);
    check("median tone = 85", byDim.tone === 85, `got ${byDim.tone}`);
    // Composite recomputed from medians (weighted), not carried from a run.
    check("composite recomputed > 0", result.score.composite > 0);

    // Metrics: tokens SUM across 3 runs, durations MAX, llmCallCount = 3.
    check("inputTokens summed = 300", result.metrics.inputTokens === 300, `got ${result.metrics.inputTokens}`);
    check("outputTokens summed = 150", result.metrics.outputTokens === 150, `got ${result.metrics.outputTokens}`);
    check("llmCallCount = 3", result.metrics.llmCallCount === 3, `got ${result.metrics.llmCallCount}`);
  }

  // ── median-of-n: survives a partial failure (allSettled) ──
  {
    process.env.FF_SCORING_VARIANT_N = "3";
    let call = 0;
    const control = async () => {
      call++;
      if (call === 2) throw new Error("one run failed");
      return makeResult({ clarity: 88, structure: 88, conciseness: 88, thinking_quality: 88, delivery: 88, tone: 88 });
    };
    const result = await runScoringArm("median-of-n", baseInput, control);
    check("partial failure still returns a score", result.score.composite > 0);
    check("llmCallCount reflects only successful runs (2)", result.metrics.llmCallCount === 2, `got ${result.metrics.llmCallCount}`);
  }

  // ── median-of-n: all runs fail → rethrow (route handles fallback) ──
  {
    process.env.FF_SCORING_VARIANT_N = "3";
    const control = async () => {
      throw new Error("boom");
    };
    let threw = false;
    try {
      await runScoringArm("median-of-n", baseInput, control);
    } catch {
      threw = true;
    }
    check("all runs fail → rethrows", threw);
  }

  // ── requiresHumanReview recomputed from median composite ──
  {
    process.env.FF_SCORING_VARIANT_N = "3";
    const control = async () => makeResult({ clarity: 98, structure: 97, conciseness: 96, thinking_quality: 98, delivery: 97, tone: 98 });
    const result = await runScoringArm("median-of-n", baseInput, control);
    check("composite >= 95 sets requiresHumanReview", result.score.requiresHumanReview === true);
  }

  // ── selectScoringArm: flag gating ──
  {
    const saved = { ...process.env };
    delete process.env.FF_SCORING_VARIANT;
    check("flag unset → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT = "true";
    process.env.FF_SCORING_VARIANT_PERCENT = "0";
    process.env.FF_SCORING_VARIANT_ARM = "median-of-n";
    check("percent 0 → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT_PERCENT = "100";
    check("percent 100 + median arm → median-of-n", selectScoringArm("user-1") === "median-of-n");

    process.env.FF_SCORING_VARIANT_PERCENT = "100";
    check("anonymous at 100 → median-of-n", selectScoringArm(undefined) === "median-of-n");

    process.env.FF_SCORING_VARIANT_ARM = "reference-anchored";
    check("percent 100 + reference-anchored arm → reference-anchored", selectScoringArm("user-1") === "reference-anchored");

    process.env.FF_SCORING_VARIANT_ARM = "grouped-fanout";
    check("percent 100 + grouped-fanout arm → grouped-fanout", selectScoringArm("user-1") === "grouped-fanout");

    process.env.FF_SCORING_VARIANT_ARM = "tone-decomposed";
    check("percent 100 + tone-decomposed arm → tone-decomposed", selectScoringArm("user-1") === "tone-decomposed");

    process.env.FF_SCORING_VARIANT_ARM = "all-llm";
    check("all-llm arm → all-llm", selectScoringArm("user-1") === "all-llm");

    process.env.FF_SCORING_VARIANT_ARM = "lean-output";
    check("lean-output arm → lean-output", selectScoringArm("user-1") === "lean-output");

    process.env.FF_SCORING_VARIANT_ARM = "lean-split";
    check("lean-split arm → lean-split", selectScoringArm("user-1") === "lean-split");

    process.env.FF_SCORING_VARIANT_ARM = "not-a-real-arm";
    check("unrecognized arm → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT_ARM = "median-of-n";
    process.env.FF_SCORING_VARIANT_PERCENT = "0";
    check("percent 0 anon → control", selectScoringArm(undefined) === "control");

    // restore
    for (const k of ["FF_SCORING_VARIANT", "FF_SCORING_VARIANT_PERCENT", "FF_SCORING_VARIANT_ARM"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }

  // ── selectScoringArm: stable bucketing (monotonic ramp) ──
  {
    process.env.FF_SCORING_VARIANT = "true";
    process.env.FF_SCORING_VARIANT_ARM = "median-of-n";
    // A user in-bucket at 30% must stay in-bucket at 60% (ramp only adds).
    const inAt = (pct: number, uid: string) => {
      process.env.FF_SCORING_VARIANT_PERCENT = String(pct);
      return selectScoringArm(uid) === "median-of-n";
    };
    let monotonic = true;
    for (let i = 0; i < 50; i++) {
      const uid = `ramp-user-${i}`;
      if (inAt(30, uid) && !inAt(60, uid)) monotonic = false;
    }
    check("bucketing is monotonic across ramp", monotonic);
    delete process.env.FF_SCORING_VARIANT;
    delete process.env.FF_SCORING_VARIANT_PERCENT;
    delete process.env.FF_SCORING_VARIANT_ARM;
  }

  // ── all-llm arm: config bypasses BOTH deterministic layers ──
  // The whole point of all-llm (Max's "can we drop determinism?" Q): with
  // word timings present, the control config overrides delivery (pacing math)
  // and blends thinking_quality, while the all-llm config lets the model's raw
  // numbers pass straight through. This proves the config switch is load-bearing
  // — runAllLlm just calls runSingleCallScore with this config, so the model
  // call itself needs no coverage here.
  {
    const RAW_DELIVERY = 82;
    const RAW_THINKING = 88;
    const dims = DIMS.map((d) => ({
      dimension: d,
      score: d === "delivery" ? RAW_DELIVERY : d === "thinking_quality" ? RAW_THINKING : 70,
      signals: [],
      feedback: `f ${d}`,
      subSkill: null,
    }));
    // ~30 words over 60s ≈ 30 wpm — far slower than any "well-paced" band, so
    // the deterministic pacing override lands well below the raw 82.
    const words = Array.from({ length: 30 }, (_, i) => ({
      word: `w${i}`,
      startMs: i * 2000,
      endMs: i * 2000 + 400,
    }));
    const hybridInput = {
      transcript: Array.from({ length: 30 }, (_, i) => `w${i}`).join(" "),
      durationMs: 60000,
      words,
      promptText: "p",
    } as unknown as ScoreRepInput;

    const control = applyHybridLayer({
      dims: dims as never,
      input: hybridInput,
      config: { deliveryMode: "deterministic", thinkingMode: "blend" },
    });
    const allLlm = applyHybridLayer({
      dims: dims as never,
      input: hybridInput,
      config: { deliveryMode: "llm", thinkingMode: "llm" },
    });
    const dGet = (r: { finalDimensions: { dimension: string; score: number }[] }, dim: string) =>
      r.finalDimensions.find((x) => x.dimension === dim)!.score;

    check("control config overrides delivery (≠ raw)", dGet(control, "delivery") !== RAW_DELIVERY, `got ${dGet(control, "delivery")}`);
    check("control config blends thinking (≠ raw)", dGet(control, "thinking_quality") !== RAW_THINKING, `got ${dGet(control, "thinking_quality")}`);
    check("all-llm config preserves raw delivery", dGet(allLlm, "delivery") === RAW_DELIVERY, `got ${dGet(allLlm, "delivery")}`);
    check("all-llm config preserves raw thinking", dGet(allLlm, "thinking_quality") === RAW_THINKING, `got ${dGet(allLlm, "thinking_quality")}`);
  }

  // ── lean-output arm: the lean prompt cuts the accuracy-neutral output ──
  // The arm's whole thesis is a leaner OUTPUT contract (drop the never-rendered
  // `signals` narratives + halve the per-dim feedback cap) with byte-identical
  // SCORING rules, so the numbers are produced by the same reasoning. Assert the
  // transforms landed and that no other cut leaked in.
  {
    // Signals field is gone from the output schema block...
    check(
      "lean prompt drops the signals output field",
      !LEAN_SYSTEM_PROMPT.includes(`"signals": ["..."]`),
    );
    // ...feedback cap is halved (400→160)...
    check(
      "lean prompt tightens feedback cap to ≤160 chars",
      LEAN_SYSTEM_PROMPT.includes("no hedging, ≤160 chars.") &&
        !LEAN_SYSTEM_PROMPT.includes("no hedging, ≤400 chars."),
    );
    check(
      "lean prompt asks for 1 sentence per dim (not 1-2)",
      LEAN_SYSTEM_PROMPT.includes("1 tight sentence per dimension") &&
        !LEAN_SYSTEM_PROMPT.includes("1-2 tight sentences per dimension"),
    );
    // ...but the load-bearing outputs the user actually reads are untouched.
    check(
      "lean prompt keeps the coachFocus contract",
      LEAN_SYSTEM_PROMPT.includes("COACH'S FOCUS RULES"),
    );
    check(
      "lean prompt keeps the strongerVersion contract",
      LEAN_SYSTEM_PROMPT.includes("STRONGER VERSION RULES"),
    );
  }

  // ── schema tolerates a dimension with no `signals` (lean output) ──
  // The lean prompt never emits `signals`, so the parse must default it to []
  // rather than mock-fallback. Control still emits it, so this is byte-neutral
  // for control (the value is present → default never fires).
  {
    const noSignalsDims = DIMS.map((d) => ({
      dimension: d,
      score: 70,
      // NOTE: no `signals` key — exactly what the lean prompt produces.
      feedback: `f ${d}`,
      subSkill: null,
    }));
    const parsed = scoringResponseSchema.safeParse({
      dimensions: noSignalsDims,
      headline: "h",
      coachFocus: { dimension: "clarity", behavior: "b", why: "w", action: "a" },
      strongerVersion: null,
      headlineTone: "directive",
      nextRepHint: "hint",
    });
    check("schema parses dimensions with no signals", parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues[0]));
    check(
      "missing signals defaults to []",
      parsed.success && parsed.data.dimensions.every((d) => Array.isArray(d.signals) && d.signals.length === 0),
    );
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  pass: ${pass}   fail: ${fail}`);
  if (fail === 0) console.log("  ✓ all scoring-arms tests pass");
  else process.exitCode = 1;
}

run();
