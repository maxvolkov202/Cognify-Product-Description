import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreRepTwoStage } from "@/lib/ai/score-stages";
import {
  writeScoringTelemetry,
  categorizeFailure,
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
 * Phase 5 — two-stage scoring endpoint. Same input/output as /api/score
 * but runs the two-stage pipeline (stage 1 scores → stage 2 copy).
 *
 * Why a separate endpoint: lets the baseline harness + the client opt
 * into two-stage independently of the legacy single-call path. The
 * existing /api/score stays untouched and serves as the rollback target
 * if two-stage shows quality or cost regressions in production.
 *
 * For the progressive UI win, callers should use /api/score/stage1 +
 * /api/score/stage2 directly so they can render stage 1 results while
 * stage 2 is still in flight. This endpoint is the "I want the same
 * shape as /api/score but with the two-stage benefits internally"
 * convenience.
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
});

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
            : "Invalid request body",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "invalid_input", message: "Invalid request body" },
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

    const { score, metrics } = await scoreRepTwoStage({
      ...body,
      userCalibration: calibrationBlock,
      ...(userId ? { userId } : {}),
      ...(mergedWeights ? { weights: mergedWeights } : {}),
      ...(body.modeContext ? { modeContext: body.modeContext } : {}),
    });

    void writeScoringTelemetry({
      source: "api_score",
      userId,
      metrics,
      totalServerDurationMs: Date.now() - requestStart,
      failureReason: metrics.fallbackFired ? "openai_fallback_used" : "none",
      compositeScore: score.composite,
    });

    return NextResponse.json(score);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const failureReason = categorizeFailure(error);
    console.error(
      `[api/score/twostage] scoring failed (${failureReason}):`,
      errorMsg,
    );

    void writeScoringTelemetry({
      source: "api_score",
      userId,
      metrics: null,
      totalServerDurationMs: Date.now() - requestStart,
      failureReason:
        failureReason === "none"
          ? "mock_fallback_both_failed"
          : failureReason === "openai_fallback_used"
            ? "mock_fallback_both_failed"
            : failureReason,
      errorDetail: errorMsg,
      modelUsedOverride: "mock-fallback-v1",
    });

    return NextResponse.json(
      { error: "scoring_failed", message: errorMsg },
      { status: 500 },
    );
  }
}
