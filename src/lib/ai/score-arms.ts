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
 */

import type { ScoreRepInput, ScoreRepResult, ScoringArm } from "./score";
import { runSingleCallScore } from "./score-shared";
import { runGroupedFanout, runPerSkillFanout } from "./score-arm-b";

type ControlFn = (input: ScoreRepInput) => Promise<ScoreRepResult>;

export async function runScoringArm(
  arm: ScoringArm,
  input: ScoreRepInput,
  control: ControlFn,
): Promise<ScoreRepResult> {
  switch (arm) {
    case "lean-output":
      return runLeanOutput(input);
    case "signals-drop":
      return runSignalsDrop(input);
    case "lean-split":
      // lever (a) × (b) — lean output ON the clarity-safe parallel decode.
      return runGroupedFanout(input, { lean: true });
    case "holistic-split":
      // The fan-out CALIBRATION fix — split only the output decode, keep full
      // rep context in both passes so tone isn't starved (PIVOT 2026-07-22).
      return runHolisticSplit(input);
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
 * holistic-split arm — the fan-out CALIBRATION fix (PIVOT 2026-07-22). Same
 * two-parallel-passes-plus-synthesis shape as grouped-fanout, but neither pass
 * is told to ignore the other half of the rep: both reason over the full
 * transcript/prosody/RAG context exactly as control does, and each merely
 * EMITS its dimension subset. This splits the ~2500-tok decode across two
 * concurrent calls (the real latency lever) WITHOUT the calibration loss that
 * sank grouped-fanout and per-skill-fanout — those isolated the tone/content
 * passes, and on text reps that starved tone of the transcript cues control
 * reads it from (control tone MAE 3.8 vs grouped 4.5).
 *
 * Direct bench (12 reps × 2, gpt-4o, text/no-prosody, RAG off): composite MAE
 * 2.1 vs control 3.1, clarity 1.9 vs 4.0 (grouped's blowup GONE), structure
 * 3.8 vs 5.4, thinking 4.1 vs 6.5 — better than control on content dims; tone
 * 4.5 (still ~0.7 over control, not fully recovered); latency p50 −17%, output
 * −18%. Three calls (cost OK per Max). See
 * plans/bench/LATENCY-2026-07-21-lean-output.md.
 */
async function runHolisticSplit(input: ScoreRepInput): Promise<ScoreRepResult> {
  return runGroupedFanout(input, { holistic: true });
}
