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
import { runGroupedFanout } from "./score-arm-b";

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
