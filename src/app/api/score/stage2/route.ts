import { NextResponse } from "next/server";
import { z } from "zod";
import {
  scoreStage2,
  assembleRepScore,
  type Stage1Output,
} from "@/lib/ai/score-stages";
import type { RepScore } from "@/types/domain";
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

/**
 * Phase 5 (progressive UI surface) — Stage 2 of two-stage scoring.
 *
 * Takes the SAME body the client sent to /api/score/stage1 PLUS the
 * stage1 result. Returns the headline + 3 callouts + didWell /
 * didntLand / nextRepFocus + nextRepHint.
 *
 * Stage 2 re-runs the same context prep (RAG, prosody, etc.) — about
 * +500ms vs sharing context across stages. Acceptable for the progressive
 * UI win; if it becomes a problem, a future endpoint variant could
 * accept a precomputed context blob from stage 1.
 *
 * Failure semantics: if Stage 2 fails, the client should fall back to
 * rendering scores-only with a "Detailed feedback unavailable" notice
 * — NOT a full mock-fallback. Stage 1 result is still real and usable.
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

// Mirror of the Stage1Output shape; tightened to avoid client tampering
// (e.g. someone sending impossible composite > 100).
const stage1Schema = z.object({
  dimensions: z.array(
    z.object({
      dimension: dimensionEnum,
      score: z.number().min(0).max(100),
      signals: z.array(z.string()),
    }),
  ),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  primaryFocusDimension: dimensionEnum,
  headlineTone: z.enum(["blunt", "directive", "praise", "celebratory"]),
  composite: z.number().min(0).max(100),
});

const bodySchema = z.object({
  // Same fields as stage1 — we re-run context prep
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
  // The stage1 result from the previous call
  stage1: stage1Schema,
});

/**
 * Stage 2 response: the fully assembled RepScore (stage1 + stage2 merged
 * into the canonical shape). Lets the client just call saveRep with
 * `score` directly — no client-side assembly logic.
 */
export type Stage2Response = {
  score: RepScore;
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

  const callerUser = await currentUser();
  if (!callerUser) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }
  const rl = await rateLimit(`user:${callerUser.id}:score-stage2`, {
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

    const { stage2, metrics } = await scoreStage2(
      {
        ...body,
        userCalibration: calibrationBlock,
        ...(userId ? { userId } : {}),
        ...(mergedWeights ? { weights: mergedWeights } : {}),
        ...(body.modeContext ? { modeContext: body.modeContext } : {}),
      },
      body.stage1 as Stage1Output,
    );

    // Stage 2 doesn't have the prosody context the original scoreStage1
    // pass produced. prosodyAvailable defaults to false here; the score
    // row's prosody flag would only be accurate if the client called
    // /api/score/twostage (which preserves context across stages). For
    // the progressive UI path, accepting "prosodyAvailable=false" on
    // the assembled response is fine — prosody status is informational
    // only and the deterministic dim scores in stage1 already reflect
    // prosody features when present.
    const score = assembleRepScore(body.stage1 as Stage1Output, stage2);

    void writeScoringTelemetry({
      source: "api_score_stage2",
      userId,
      metrics: {
        ...metrics,
        scoreRepTotalMs:
          metrics.modelDurationMs + metrics.validationDurationMs,
      },
      totalServerDurationMs: Date.now() - requestStart,
      failureReason: resolveFallbackReason(metrics),
      compositeScore: body.stage1.composite,
    });

    return NextResponse.json({ score } satisfies Stage2Response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const failureReason = categorizeFailure(error);
    console.error(
      `[api/score/stage2] failed (${failureReason}):`,
      errorMsg,
    );

    void writeScoringTelemetry({
      source: "api_score_stage2",
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

    // Stage 2 failure DOES NOT trigger a full mock-fallback — the client
    // already has real stage 1 scores and should render them with a
    // "Detailed feedback unavailable" notice. Returning 500 lets the
    // client distinguish stage 2 from total scoring failure.
    return NextResponse.json(
      { error: "stage2_failed", message: errorMsg.slice(0, 500) },
      { status: 500 },
    );
  }
}
