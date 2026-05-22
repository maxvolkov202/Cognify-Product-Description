import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreStage1, type Stage1Output } from "@/lib/ai/score-stages";
import {
  writeScoringTelemetry,
  categorizeFailure,
  resolveFallbackReason,
} from "@/lib/scoring/telemetry";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import {
  getUserCalibrationProfile,
  renderCalibrationForPrompt,
} from "@/lib/db/queries/calibration";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import { getPressureArchetype } from "@/lib/ai/pressure-archetypes";

/**
 * Phase 5 (progressive UI surface) — Stage 1 of two-stage scoring.
 *
 * Returns the 6 dimension scores + composite + primaryFocusDimension +
 * headlineTone band. ~300-token output, smaller prompt than the
 * combined endpoint. Lets the client render the dimension grid
 * immediately while it kicks off stage 2 for the copy.
 *
 * The client should call this first, render the dim grid + composite,
 * then POST the SAME body PLUS the stage1 result to /api/score/stage2
 * to get the headline + callouts + bullets.
 *
 * Telemetry: writes a scoring_telemetry row with source='api_score_stage1'
 * so we can see the latency split between stages in /api/score/health/stats.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const wordSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

const dimensionEnum = z.enum([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
]);

const pressureArchetypeIdEnum = z.enum([
  "pushback",
  "time_compression",
  "audience_switch",
  "clarifying_interrupt",
  "stakes_raise",
]);

const modeContextSchema = z.object({
  sessionType: z.enum(["focus", "combined", "flow"]),
  focusDimension: dimensionEnum.optional(),
  pressureArchetypeId: pressureArchetypeIdEnum.optional(),
  previousRepFocus: z
    .object({
      dimension: dimensionEnum,
      headline: z.string().min(1).max(200),
      score: z.number().min(0).max(100),
    })
    .optional(),
  repIndex: z.number().int().min(0),
  totalReps: z.number().int().min(1),
});

const bodySchema = z.object({
  transcript: z.string().min(1).max(10000),
  promptText: z.string().min(1).max(500),
  durationMs: z.number().int().min(1000).max(300000),
  timeBudgetMs: z.number().int().optional(),
  frameworkId: z.string().optional(),
  frameworkNodes: z
    .array(z.object({ label: z.string(), description: z.string() }))
    .optional(),
  words: z.array(wordSchema).optional(),
  pressureArchetypeId: pressureArchetypeIdEnum.optional(),
  modeContext: modeContextSchema.optional(),
  audioUrl: z.string().url().optional(),
  // Phase 8 — muscle-group context for exercise-aware scoring.
  exerciseId: z.string().uuid().optional(),
  muscleGroupDayId: z.string().uuid().optional(),
  isGraduationRep: z.boolean().optional(),
});

export type Stage1Response = {
  stage1: Stage1Output;
};

async function loadUserContext() {
  const user = await currentUser();
  if (!user) return { userId: null, calibrationBlock: null };
  const profile = await getUserCalibrationProfile(user.id);
  return {
    userId: user.id,
    calibrationBlock: renderCalibrationForPrompt(profile),
  };
}

export async function POST(req: Request) {
  const requestStart = Date.now();

  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many scoring requests." },
      { status: 429 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.errors[0];
      return NextResponse.json(
        {
          error: "invalid_input",
          message: first
            ? `${first.path.join(".") || "input"}: ${first.message}`
            : "Invalid body",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "invalid_input", message: "Invalid body" },
      { status: 400 },
    );
  }

  const { userId, calibrationBlock } = await loadUserContext();

  try {
    const frameworkWeights = getFrameworkWeights(body.frameworkId);
    const pressureWeights = body.pressureArchetypeId
      ? getPressureArchetype(body.pressureArchetypeId).weightProfile
      : null;
    const mergedWeights = pressureWeights ?? frameworkWeights ?? null;

    const { stage1, metrics } = await scoreStage1({
      ...body,
      userCalibration: calibrationBlock,
      ...(userId ? { userId } : {}),
      ...(mergedWeights ? { weights: mergedWeights } : {}),
      ...(body.modeContext ? { modeContext: body.modeContext } : {}),
    });

    void writeScoringTelemetry({
      source: "api_score_stage1",
      userId,
      // Cast metrics shape — score-stages emits ScoreStageMetrics which
      // is structurally compatible with the telemetry input metrics
      // (subset of ScoreRepMetrics). Add the missing scoreRepTotalMs
      // field as the model+validation duration since stage 1 has no
      // separate validation phase distinct from the LLM call.
      metrics: {
        ...metrics,
        scoreRepTotalMs:
          metrics.modelDurationMs + metrics.validationDurationMs,
      },
      totalServerDurationMs: Date.now() - requestStart,
      failureReason: resolveFallbackReason(metrics),
      compositeScore: stage1.composite,
    });

    return NextResponse.json({ stage1 } satisfies Stage1Response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const failureReason = categorizeFailure(error);
    console.error(
      `[api/score/stage1] failed (${failureReason}):`,
      errorMsg,
    );

    void writeScoringTelemetry({
      source: "api_score_stage1",
      userId,
      metrics: null,
      totalServerDurationMs: Date.now() - requestStart,
      failureReason:
        failureReason === "none"
          ? "mock_fallback_both_failed"
          : failureReason === "openai_fallback_used" ||
              failureReason === "anthropic_fallback_used"
            ? "mock_fallback_both_failed"
            : failureReason,
      errorDetail: errorMsg,
      modelUsedOverride: "mock-fallback-v1",
    });

    return NextResponse.json(
      { error: "scoring_failed", message: errorMsg.slice(0, 500) },
      { status: 500 },
    );
  }
}
