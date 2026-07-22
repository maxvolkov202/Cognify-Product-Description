import type { RepScore } from "@/types/domain";
import { createHash } from "node:crypto";
import { runScoringArm } from "./score-arms";
import { runSingleCallScore } from "./score-shared";
import type {
  ScoreRepInput,
  ScoreRepResult,
} from "./score-shared";

// Grading Engine V2 — the scoring pipeline internals live in score-shared.ts
// (the leaf module, so score-arms.ts can import them without a cycle). This
// file keeps the public entry points + the A/B arm dispatcher, and re-exports
// the shared surface so existing importers of "@/lib/ai/score" are unchanged.
export type {
  ScoreRepInput,
  ScoreRepResult,
  ScoreRepMetrics,
  ScoreRepModeContext,
  PreparedScoringPrompt,
  HybridConfig,
} from "./score-shared";
export {
  scoringResponseSchema,
  implementationReviewSchema,
  normalizeProviderQuirks,
  sanitizeCoachFocus,
  sanitizeStrongerVersion,
  sanitizeDimSubSkill,
  containsBannedPhrase,
  renderEventContextBlock,
  renderRetryEvaluationBlock,
  buildUserPrompt,
  buildSystemBlocks,
  computeScoringPromptBytes,
  parseAndValidate,
  applyHybridLayer,
  assembleRepScore,
} from "./score-shared";


/**
 * Phase 0 — backward-compat wrapper. Existing callers (e.g. test scripts)
 * keep using the legacy single-return shape; production route handlers
 * use scoreRepWithMetrics directly so they can write a scoring_telemetry
 * row at request end.
 */
export async function scoreRep(input: ScoreRepInput): Promise<RepScore> {
  const { score } = await scoreRepWithMetrics(input);
  return score;
}

/**
 * Grading Engine V2 — control-PINNED scorer for the calibration/drift path.
 * The calibration-drift cron (and any reference-rep scoring) MUST bypass the
 * A/B dispatcher and always run the byte-identical control path. Otherwise a
 * variant at FF_SCORING_VARIANT_PERCENT>=100 — which the dispatcher applies
 * even to anonymous (no-userId) reps — would score reference reps with the
 * variant prompt and contaminate the drift baseline, breaking the calibration
 * guardrail (reference reps must stay byte-identical). This entry point is
 * immune to FF_SCORING_VARIANT regardless of its percent, so signals-drop can
 * ramp to 100% without ever touching the drift cron.
 */
export async function scoreRepForCalibration(
  input: ScoreRepInput,
): Promise<RepScore> {
  const { score } = await scoreRepControl(input);
  return score;
}

/**
 * Grading Engine V2 — the set of A/B scoring arms. "control" is today's
 * single-call scorer; the rest are variants gated behind FF_SCORING_VARIANT.
 */
export type ScoringArm =
  | "control"
  | "median-of-n"
  | "reference-anchored"
  | "grouped-fanout"
  | "tone-decomposed"
  | "all-llm"
  | "lean-output"
  | "lean-split"
  | "per-skill-fanout"
  | "holistic-split"
  | "signals-drop";

/** Arms `runScoringArm` can actually execute today. A flag value naming an
 *  arm outside this set falls back to control (safe no-op) rather than
 *  throwing at scoring time. */
const IMPLEMENTED_VARIANT_ARMS: readonly ScoringArm[] = [
  "median-of-n",
  "reference-anchored",
  "grouped-fanout",
  "tone-decomposed",
  "all-llm",
  "lean-output",
  "lean-split",
  "per-skill-fanout",
  "holistic-split",
  "signals-drop",
];

/**
 * Grading Engine V2 — resolve which scoring arm to run for this user.
 * Mirrors `isDeterministicSignalsOn`'s stable SHA-256 percentile bucket so
 * ramps only ADD users (a bucketed user never flaps back to control) and
 * rollback is env-only. Anonymous reps (no userId, e.g. the calibration
 * harness) stay control unless PERCENT>=100 forces the arm on.
 *
 *   FF_SCORING_VARIANT          master kill switch (default OFF)
 *   FF_SCORING_VARIANT_PERCENT  ramp 0..100 (>=100 = on even for anon)
 *   FF_SCORING_VARIANT_ARM      which arm to run when bucketed on
 *
 * Default-OFF is deliberate: the calibration suite + drift cron must keep
 * exercising the byte-identical control path, so a variant only runs when
 * explicitly enabled.
 */
export function selectScoringArm(userId: string | undefined): ScoringArm {
  if (process.env.FF_SCORING_VARIANT !== "true") return "control";
  const percent = parseInt(process.env.FF_SCORING_VARIANT_PERCENT ?? "0", 10);
  if (Number.isNaN(percent) || percent <= 0) return "control";
  const inBucket =
    percent >= 100 ||
    (!!userId &&
      createHash("sha256").update(userId).digest().readUInt32BE(0) % 100 <
        percent);
  if (!inBucket) return "control";
  const arm = process.env.FF_SCORING_VARIANT_ARM as ScoringArm | undefined;
  return arm && IMPLEMENTED_VARIANT_ARMS.includes(arm) ? arm : "control";
}

/**
 * Grading Engine V2 — public scoring entry point. Routes to the control
 * path (today's single call) or a variant arm, then stamps the arm onto
 * `metrics` so telemetry attributes it automatically. Every arm honors the
 * same `ScoreRepResult` contract, so route handlers and downstream
 * consumers are arm-agnostic.
 */
export async function scoreRepWithMetrics(
  input: ScoreRepInput,
): Promise<ScoreRepResult> {
  const arm = selectScoringArm(input.userId);
  const result =
    arm === "control"
      ? await scoreRepControl(input)
      : await runScoringArm(arm, input, scoreRepControl);
  result.metrics.scoringArm = arm;
  if (result.metrics.llmCallCount == null) result.metrics.llmCallCount = 1;
  return result;
}

/**
 * Grading Engine V2 — the CONTROL scoring path: today's single-call scorer.
 * After the §0 extraction refactor this is a thin composition of the shared
 * pipeline helpers (buildUserPrompt / buildSystemBlocks / parseAndValidate /
 * applyHybridLayer / assembleRepScore), which reproduce the pre-refactor
 * prompt + score assembly byte-for-byte. The public scoreRepWithMetrics
 * dispatcher routes here for the control arm and for any user not bucketed
 * into a variant. Keeping this composition on the control config
 * ({deliveryMode:"deterministic", thinkingMode:"blend"}) is what preserves
 * the calibration guardrail: reference reps (scored with the variant flag
 * off) exercise exactly this path.
 */
async function scoreRepControl(input: ScoreRepInput): Promise<ScoreRepResult> {
  // Control == the single-call flow with no reference anchors and the
  // default hybrid config → byte-identical prompt + score assembly to the
  // pre-refactor scorer (the calibration guardrail).
  return runSingleCallScore(input);
}

