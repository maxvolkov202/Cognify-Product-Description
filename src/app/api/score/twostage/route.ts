import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreRepTwoStage } from "@/lib/ai/score-stages";
import {
  writeScoringTelemetry,
  categorizeFailure,
  resolveFallbackReason,
} from "@/lib/scoring/telemetry";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import {
  getUserCalibrationProfile,
  renderCalibrationForPrompt,
} from "@/lib/db/queries/calibration";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import { getPressureArchetype } from "@/lib/ai/pressure-archetypes";
import { log, serializeErr } from "@/lib/log";

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
export const maxDuration = 120;

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
  // Phase 15 L-2 (§7.5) — Build a Rep event grounding; rendered only
  // when present (calibration guardrail).
  eventContext: z
    .object({
      title: z.string().min(1).max(200),
      eventType: z.string().min(1).max(40),
      description: z.string().max(4000),
      contextSummary: z.string().max(2000).nullable(),
      // L4 — the practiced Critical Moment's scoring lens; one extra
      // line inside the same only-when-present block (calibration-safe).
      momentHint: z.string().max(300).optional(),
    })
    .optional(),
  repIndex: z.number().int().min(0),
  totalReps: z.number().int().min(1),
});

const bodySchema = z.object({
  // PRD v3 Phase 5 — cap covers Full Simulation long reps (~20 min speech).
  transcript: z.string().min(1).max(48000),
  promptText: z.string().min(1).max(500),
  durationMs: z.number().int().min(1000).max(1500000),
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

  const callerUser = await currentUser();
  if (!callerUser) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }
  const rl = await rateLimit(`user:${callerUser.id}:score-twostage`, {
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
      failureReason: resolveFallbackReason(metrics),
      compositeScore: score.composite,
    });

    return NextResponse.json(score);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const failureReason = categorizeFailure(error);
    log.error({
      event: "score.twostage.failed",
      failureReason,
      err: serializeErr(error),
    });

    void writeScoringTelemetry({
      source: "api_score",
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
      { error: "scoring_failed", message: errorMsg },
      { status: 500 },
    );
  }
}
