/**
 * Grading Engine V2 — variant scoring arms.
 *
 * The public `scoreRepWithMetrics` dispatcher (score.ts) routes bucketed
 * users here. Every arm receives the pristine control scorer as a
 * parameter (`control`) so this module never imports a value from score.ts
 * — only types — which keeps the import graph one-directional
 * (score.ts → score-arms.ts) and cycle-free.
 *
 * Contract every arm MUST honor: return `{ score, metrics }` with all six
 * dimensions present and a composite. Arm-specific data rides on `metrics`
 * (append-only optional fields), never on a forked response shape, so
 * `buildFeedbackDoc` and the route serializer stay arm-agnostic.
 *
 * ── Arms ─────────────────────────────────────────────────────────────
 * median-of-n : run control N times concurrently, take the per-dimension
 *               median score, recompute the composite. This is the
 *               stability lever — it directly tests whether smoothing
 *               run-to-run LLM variance is worth N× cost, and is the
 *               deciding instrument for "can we lean more on the LLM
 *               (less determinism) without losing reproducibility?".
 *               (The previously-proposed-but-never-built median harness
 *               mode, now a first-class arm.)
 */

import type { ScoreRepInput, ScoreRepResult, ScoringArm } from "./score";
import { ALL_DIMENSIONS, composite } from "@/lib/scoring/rubric";
import type { SkillDimension } from "@/types/domain";
import { runSingleCallScore } from "./score-shared";
import {
  selectAnchors,
  renderReferenceAnchorsBlock,
} from "./reference-anchors";
import { runGroupedFanout, runPerSkillFanout } from "./score-arm-b";

type ControlFn = (input: ScoreRepInput) => Promise<ScoreRepResult>;

export async function runScoringArm(
  arm: ScoringArm,
  input: ScoreRepInput,
  control: ControlFn,
): Promise<ScoreRepResult> {
  switch (arm) {
    case "median-of-n":
      return runMedianOfN(input, control);
    case "reference-anchored":
      return runReferenceAnchored(input);
    case "grouped-fanout":
      return runGroupedFanout(input);
    case "tone-decomposed":
      return runGroupedFanout(input, { toneDecomposition: true });
    case "all-llm":
      return runAllLlm(input);
    case "lean-output":
      return runLeanOutput(input);
    case "signals-drop":
      return runSignalsDrop(input);
    case "lean-split":
      // lever (a) × (b) — lean output ON the clarity-safe parallel decode.
      return runGroupedFanout(input, { lean: true });
    case "per-skill-fanout":
      // Six single-dim calls in parallel + synthesis — the strongest form of
      // the parallel-decode latency lever (PIVOT 2026-07-21).
      return runPerSkillFanout(input);
    // Any arm not switched above (or an unrecognized flag value) is a
    // defensive fallback to control, not a live path — the dispatcher's
    // IMPLEMENTED_VARIANT_ARMS gate keeps unimplemented arms from reaching here.
    default:
      return control(input);
  }
}

/**
 * All-LLM arm — the control single-call flow with BOTH deterministic layers
 * turned off: the model's raw delivery (pacing) and thinking_quality scores
 * pass straight through instead of the deterministic pacing override and the
 * 60/40 thinking blend. This is the head-to-head answer to "can we drop
 * determinism?" on the CURRENT architecture: same prompt, same cost (one
 * call), the only variable is who owns delivery/thinking — the LLM or the
 * math. The variance harness decides whether the stability loss is tolerable.
 */
async function runAllLlm(input: ScoreRepInput): Promise<ScoreRepResult> {
  const result = await runSingleCallScore(input, {
    config: { deliveryMode: "llm", thinkingMode: "llm" },
  });
  result.metrics.llmCallCount = 1;
  return result;
}

/**
 * lean-output arm — the control single-call flow with a leaner OUTPUT
 * contract: the never-rendered per-dimension `signals` narratives are dropped
 * and the per-dim `feedback` cap is halved (400→160 chars, 1-2 sentences → 1).
 * Grading is decode-bound (one gpt-4o call, ~8.2s p50 is almost all output-
 * token generation), so cutting output tokens is a ~linear latency lever.
 * Within each dimension the JSON emits `score` BEFORE its prose, so a dim's
 * own score can't be moved by trimming its feedback; the only channel is
 * cross-dimension (earlier dims' prose precedes later dims' scores), which
 * predicts a weak effect. Measured (12 reps × N=3, RAG off): output tokens
 * −26%, latency p50 −20%, composite MAE 2.5 vs control 2.3 (inside the noise
 * floor → accuracy-neutral on composite), with minor per-dim reshuffling
 * (slightly worse tone/conciseness, better thinking/delivery, all ~1 MAE).
 * Same cost (one call), same determinism (control hybrid config).
 * See plans/bench/LATENCY-2026-07-21-lean-output.md.
 */
async function runLeanOutput(input: ScoreRepInput): Promise<ScoreRepResult> {
  const result = await runSingleCallScore(input, { lean: true });
  result.metrics.llmCallCount = 1;
  return result;
}

/**
 * signals-drop arm — THE ship candidate (PIVOT 2026-07-21). The control
 * single-call flow with exactly ONE change to the output contract: the
 * never-rendered per-dimension `signals` narratives are dropped
 * (`leanFeedbackCap: 400` keeps the full 400-char / "1-2 sentences" feedback
 * — byte-identical to control's feedback instruction; only the invisible
 * `signals` field is removed). This is the subset of `lean-output` that Max
 * approved: the feedback the user reads does not change AT ALL, so there is
 * no copy trade-off to review — the arm trims a dead output field, nothing
 * more.
 *
 * Measured (12 reps × N=3, gpt-4o, RAG off): output tokens −15% (652→553),
 * latency p50 −16% (7.7s→6.5s), composite MAE 2.2 vs control 2.9
 * (neutral-to-better), no per-dimension regression. It is the only latency
 * lever in the whole sweep that preserves output quality FULLY — the milder
 * feedback caps add ~nothing over it (the cap rarely binds), the 160-char cut
 * costs a clarity wobble, fan-out breaks tone/thinking calibration, and the
 * smaller models are both slower AND worse.
 * See plans/bench/LATENCY-2026-07-21-lean-output.md ("OBJECTIVE STANDPOINT").
 */
async function runSignalsDrop(input: ScoreRepInput): Promise<ScoreRepResult> {
  // leanFeedbackCap: 400 → drop the `signals` field, keep control's feedback
  // prose (≤400, 1-2 sentences). Distinct from lean-output's cap of 160.
  const result = await runSingleCallScore(input, { leanFeedbackCap: 400 });
  result.metrics.llmCallCount = 1;
  return result;
}

/**
 * Arm A — reference-anchored single call. Identical to control except for
 * one additional CACHED system block (REFERENCE ANCHORS) holding three
 * human-scored reps that span the range, so the model calibrates absolute
 * 0-100 placement against known anchors instead of guessing. Leave-one-out
 * (selectAnchors) guarantees the rep is never scored against a copy of
 * itself. All other behavior — prompt, parsing, hybrid layer, assembly —
 * is the shared single-call flow, so downstream stays arm-agnostic.
 */
async function runReferenceAnchored(
  input: ScoreRepInput,
): Promise<ScoreRepResult> {
  const anchorsBlock = renderReferenceAnchorsBlock(
    selectAnchors(input.transcript),
  );
  const result = await runSingleCallScore(input, { anchorsBlock });
  result.metrics.llmCallCount = 1;
  return result;
}

/** N for median-of-n, clamped to a sane range. Odd N gives a true middle
 *  value; even N averages the two central scores. */
function resolveN(): number {
  const raw = parseInt(process.env.FF_SCORING_VARIANT_N ?? "5", 10);
  if (Number.isNaN(raw)) return 5;
  return Math.max(3, Math.min(9, raw));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? 0;
}

async function runMedianOfN(
  input: ScoreRepInput,
  control: ControlFn,
): Promise<ScoreRepResult> {
  const n = resolveN();

  // Concurrent so wall-clock ≈ a single call, not N×. allSettled so one
  // failed/validation-thrown run doesn't collapse the whole rep to the
  // route's mock-fallback — we median over whatever succeeded.
  const settled = await Promise.allSettled(
    Array.from({ length: n }, () => control(input)),
  );
  const runs = settled
    .filter(
      (r): r is PromiseFulfilledResult<ScoreRepResult> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  if (runs.length === 0) {
    // Every run failed — rethrow so the route's catch produces its normal
    // mock-fallback (and telemetry records the real failure reason).
    const firstRejected = settled.find(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    throw firstRejected?.reason ?? new Error("median-of-n: all runs failed");
  }

  // Per-dimension median across the successful runs.
  const perDim: Partial<Record<SkillDimension, number[]>> = {};
  for (const run of runs) {
    for (const d of run.score.dimensions) {
      (perDim[d.dimension] ??= []).push(d.score);
    }
  }
  const medianByDim: Partial<Record<SkillDimension, number>> = {};
  for (const dim of ALL_DIMENSIONS) {
    const scores = perDim[dim];
    if (scores && scores.length > 0) medianByDim[dim] = median(scores);
  }

  // Pick the run whose dimension scores are collectively closest to the
  // medians, so its feedback/coachFocus/strongerVersion best matches the
  // numbers the user sees. Deterministic tie-break: first such run.
  let base: ScoreRepResult = runs[0]!; // runs.length > 0 verified above
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const run of runs) {
    let distance = 0;
    for (const d of run.score.dimensions) {
      const med = medianByDim[d.dimension];
      if (med != null) distance += Math.abs(d.score - med);
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      base = run;
    }
  }

  // Rebuild the base run's dimensions with the median numbers. Feedback,
  // signals, subSkill(Scores) stay from the base run (the closest match).
  const dimensions = base.score.dimensions.map((d) => {
    const med = medianByDim[d.dimension];
    return med != null ? { ...d, score: med } : d;
  });
  const compositeScore = composite(medianByDim, input.weights);

  const score: ScoreRepResult["score"] = {
    ...base.score,
    dimensions,
    composite: compositeScore,
    requiresHumanReview: compositeScore >= 95,
  };

  // Merge metrics: token counts SUM across the N calls (real spend), while
  // wall-clock durations take the MAX (calls ran concurrently). Everything
  // else (modelUsed, fallbackFired, promptSizeBytes, …) rides from base.
  const sum = (
    pick: (m: ScoreRepResult["metrics"]) => number | null | undefined,
  ) => runs.reduce((acc, r) => acc + (pick(r.metrics) ?? 0), 0);
  const max = (
    pick: (m: ScoreRepResult["metrics"]) => number | null | undefined,
  ) => runs.reduce((acc, r) => Math.max(acc, pick(r.metrics) ?? 0), 0);

  const metrics: ScoreRepResult["metrics"] = {
    ...base.metrics,
    inputTokens: sum((m) => m.inputTokens),
    outputTokens: sum((m) => m.outputTokens),
    cacheReadTokens: sum((m) => m.cacheReadTokens),
    cacheCreationTokens: sum((m) => m.cacheCreationTokens),
    modelDurationMs: max((m) => m.modelDurationMs),
    validationDurationMs: max((m) => m.validationDurationMs),
    scoreRepTotalMs: max((m) => m.scoreRepTotalMs),
    ragDurationMs: max((m) => m.ragDurationMs),
    fallbackFired: runs.some((r) => r.metrics.fallbackFired),
    llmCallCount: runs.length,
  };

  return { score, metrics };
}
