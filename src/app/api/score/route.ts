import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreRepWithMetrics } from "@/lib/ai/score";
import {
  writeScoringTelemetry,
  categorizeFailure,
  resolveFallbackReason,
} from "@/lib/scoring/telemetry";
import { extractSignals } from "@/lib/scoring/signals";
import {
  scorePacing,
  scoreConfidenceDeterministic,
} from "@/lib/scoring/deterministic";
import { RUBRIC_VERSION, composite } from "@/lib/scoring/rubric";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import { getPressureArchetype } from "@/lib/ai/pressure-archetypes";
import type { RepScore, SkillDimension, Callout } from "@/types/domain";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import {
  getUserCalibrationProfile,
  renderCalibrationForPrompt,
} from "@/lib/db/queries/calibration";
import { log, serializeErr } from "@/lib/log";
import { isTrainingEngineV2Enabled } from "@/lib/flags";
import {
  buildCoachingMemorySnapshot,
  renderCoachingMemoryBlock,
} from "@/lib/profile/snapshot";

/**
 * Pull the current user's id + calibration block in a single shot.
 * Returns { userId: null, calibrationBlock: null } for unauthenticated
 * requests (anonymous trial reps still flow through the legacy scoring
 * path; the Ch.11c FF gate uses userId to bucket users into the
 * deterministic-signals rollout, so anonymous reps are always off).
 */
async function loadUserContext(): Promise<{
  userId: string | null;
  calibrationBlock: string | null;
  coachingMemoryBlock: string | null;
}> {
  const user = await currentUser();
  if (!user)
    return { userId: null, calibrationBlock: null, coachingMemoryBlock: null };
  // PRD v3 Phase 3 — coaching memory (PRD §8.6.4), v2 engine only. Built
  // from the coaching_events ledger; null for users with no coaching
  // history, so calibration reference runs stay byte-identical.
  // I2 — memory-only snapshot: skips the 21-day trends aggregation the
  // scoring prompt never consumed.
  const [profile, snapshot] = await Promise.all([
    getUserCalibrationProfile(user.id),
    isTrainingEngineV2Enabled()
      ? buildCoachingMemorySnapshot(user.id)
      : Promise.resolve(null),
  ]);
  return {
    userId: user.id,
    calibrationBlock: renderCalibrationForPrompt(profile),
    coachingMemoryBlock: renderCoachingMemoryBlock(snapshot),
  };
}

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
  // PRD v3 engine — present when this rep is the required Retry (or an
  // "again" attempt). Switches feedback into implementation-review mode.
  retryContext: z
    .object({
      attempt: z.enum(["retry", "again"]),
      firstTranscript: z.string().min(1).max(10000),
      firstComposite: z.number().min(0).max(100).nullable(),
      coachFocus: z.object({
        dimension: dimensionEnum,
        subSkill: z.string().max(80).nullable().optional(),
        text: z.string().min(1).max(320),
      }),
    })
    .optional(),
  // Phase 15 L-2 (§7.5) — Build a Rep event grounding. Rendered as an
  // uncached block ONLY when present (renderEventContextBlock), so all
  // non-prep prompts stay byte-identical — calibration guardrail.
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
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  words: z.array(wordSchema).optional(),
  /** WS-3: when the rep is a pressure rep, the client sends the archetype
   *  id so the server can apply that archetype's scoring weight profile.
   *  Unknown / missing values → no weight override (falls back to
   *  framework weights or rubric defaults). */
  pressureArchetypeId: pressureArchetypeIdEnum.optional(),
  /** Phase 2: per-mode signals so the AI can write mode-aware feedback. */
  modeContext: modeContextSchema.optional(),
  /** Ch.3b: signed audio URL for the prosody worker. When supplied AND
   *  FF_PROSODY_WORKER=true, the score path calls the worker concurrently
   *  with the LLM call. Optional — score still works without it (Tone
   *  falls back to LLM-only with prosodyAvailable=false). */
  audioUrl: z.string().url().optional(),
  // Phase 8 — muscle-group context for exercise-aware scoring.
  exerciseId: z.string().uuid().optional(),
  muscleGroupDayId: z.string().uuid().optional(),
  isGraduationRep: z.boolean().optional(),
});

type ScoreBody = z.infer<typeof bodySchema>;

/**
 * Phase 1 — reason-aware user-facing copy for the mock-fallback callout.
 * Always consumer-neutral (never references billing/credits/tokens) but
 * differentiates the *kind* of problem so users get actionable signal
 * instead of a single generic message.
 *
 * Two distinct user moments to address:
 *   1. They might retry now (timeout, rate_limit → "try again in a moment")
 *   2. The pipeline itself is broken (validation, network → "saved, we're investigating")
 */
function fallbackCalloutCopy(
  failureReason: import("@/lib/scoring/telemetry").FailureReason,
  hasWords: boolean,
): { title: string; body: string } {
  const realDimsBlurb = hasWords
    ? " Your delivery and thinking quality below are scored from real signals."
    : "";
  switch (failureReason) {
    case "timeout":
      return {
        title: "Scoring took longer than expected",
        body: `Your rep is saved.${realDimsBlurb} Try another rep in a moment — usually clears up immediately.`,
      };
    case "rate_limit_429":
      return {
        title: "Too many scoring requests right now",
        body: `Your rep is saved.${realDimsBlurb} Try another rep in a moment.`,
      };
    case "validation_failed":
      return {
        title: "Scoring had a hiccup on this one",
        body: `Your rep is saved.${realDimsBlurb} This is rare — try another rep and it should clear.`,
      };
    case "network_error":
      return {
        title: "Couldn't reach the scoring service",
        body: `Your rep is saved.${realDimsBlurb} Try another rep in a moment.`,
      };
    case "mock_fallback_both_failed":
    default:
      return {
        title: "Scoring is taking a moment",
        body: `Your rep is saved.${realDimsBlurb} Try another rep in a moment.`,
      };
  }
}

/**
 * Build a fallback RepScore when the Claude scoring call fails (no
 * credits, rate limit, network, etc.). The fallback keeps the workout
 * flow fully usable so users can still experience end-to-end UX.
 *
 * Critically: if word timings are present, **pacing and confidence are
 * still computed from real deterministic signals** — those two
 * dimensions are always real even in mock mode. The LLM-scored
 * dimensions (clarity, structure, relevance, tone) get neutral mock
 * values with a clear "mock mode" callout explaining what happened.
 *
 * Phase 1 — accepts a `failureReason` so the user-facing callout copy
 * differentiates by problem type instead of always saying "Scoring is
 * taking a moment".
 */
function buildFallbackScore(
  body: ScoreBody,
  errorMsg: string,
  failureReason: import("@/lib/scoring/telemetry").FailureReason = "mock_fallback_both_failed",
): RepScore {
  const words = body.words ?? [];
  const hasWords = words.length > 0;

  const signals = hasWords
    ? extractSignals({
        words,
        transcript: body.transcript,
        durationMs: body.durationMs,
        timeBudgetMs: body.timeBudgetMs ?? body.durationMs,
      })
    : null;

  const pacingResult = signals ? scorePacing(signals) : null;
  const confidenceResult = signals ? scoreConfidenceDeterministic(signals) : null;

  const dimensions: Array<{
    dimension: SkillDimension;
    score: number;
    signals: string[];
  }> = [
    {
      dimension: "clarity",
      score: 70,
      signals: [
        "[mock mode] Claude scoring unavailable — semantic clarity judgment skipped",
      ],
    },
    {
      dimension: "structure",
      score: 68,
      signals: [
        "[mock mode] Claude scoring unavailable — structure judgment skipped",
      ],
    },
    {
      dimension: "conciseness",
      score: 72,
      signals: [
        "[mock mode] Claude scoring unavailable — conciseness judgment skipped",
      ],
    },
    {
      dimension: "thinking_quality",
      score: confidenceResult?.score ?? 70,
      signals: confidenceResult?.signals ?? [
        "[mock mode] signals unavailable without word timings",
      ],
    },
    {
      dimension: "delivery",
      score: pacingResult?.score ?? 70,
      signals: pacingResult?.signals ?? [
        "[mock mode] signals unavailable without word timings",
      ],
    },
    {
      dimension: "tone",
      score: 72,
      signals: [
        "[mock mode] Claude scoring unavailable — tone judgment skipped",
      ],
    },
  ];

  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of dimensions) dimensionMap[d.dimension] = d.score;
  const compositeScore = composite(dimensionMap);

  // Server-side log keeps the full error for debugging; user-visible
  // callout is consumer-neutral — never reference billing/credits/tokens
  // in copy that ships to end users.
  log.error({
    event: "score.mock_fallback",
    failureReason,
    errorMsg,
  });
  const copy = fallbackCalloutCopy(failureReason, hasWords);
  const callouts: Callout[] = [
    {
      dimension: "clarity",
      tone: "neutral",
      title: copy.title,
      body: copy.body,
      quote: null,
      suggestedRewrite: null,
      transcriptStart: 0,
      transcriptEnd: Math.min(1000, body.durationMs),
    },
  ];

  // If we have real deterministic delivery data, surface it as a
  // positive/warn callout so the user sees actual signal, not just the
  // mock notice. (Delivery = old "pacing" renamed under v2.0.0.)
  if (pacingResult) {
    const tone: Callout["tone"] =
      pacingResult.score >= 80
        ? "positive"
        : pacingResult.score >= 60
          ? "neutral"
          : "warn";
    callouts.push({
      dimension: "delivery",
      tone,
      title: `Delivery (real) — ${pacingResult.score}/100`,
      body: pacingResult.signals.join(". "),
      quote: null,
      suggestedRewrite: null,
      transcriptStart: 0,
      transcriptEnd: body.durationMs,
    });
  }

  if (confidenceResult) {
    const tone: Callout["tone"] =
      confidenceResult.score >= 80
        ? "positive"
        : confidenceResult.score >= 60
          ? "neutral"
          : "warn";
    callouts.push({
      dimension: "thinking_quality",
      tone,
      title: `Thinking Quality (deterministic baseline) — ${confidenceResult.score}/100`,
      body: confidenceResult.signals.join(". "),
      quote: null,
      suggestedRewrite: null,
      transcriptStart: 0,
      transcriptEnd: body.durationMs,
    });
  }

  return {
    composite: compositeScore,
    dimensions,
    callouts,
    modelVersion: "mock-fallback-v1",
    rubricVersion: RUBRIC_VERSION,
    headline: mockFallbackHeadline(compositeScore),
    // Grading v3 — a canned Coach's Focus so the feedback surface keeps
    // its Score → Focus → Breakdown shape even in mock mode. saveRep
    // skips the coaching-ledger write for mock scores, so this never
    // pollutes coaching history. strongerVersion stays null — we can't
    // ground a rewrite without a real model pass.
    coachFocus: {
      dimension: "clarity" as const,
      subSkill: null,
      behavior: "Scoring ran in offline mode, so this rep has no AI coaching.",
      why: "The deterministic timing metrics below are real; the language dimensions are placeholders.",
      action: "Re-record when scoring is back to get a real Coach's Focus.",
      text: "Re-record when scoring is back to get a real Coach's Focus.",
    },
    strongerVersion: null,
    primaryFocusDimension: "clarity" as const,
    // Phase 3 calibration scaffold: pick the band that matches mock
    // composite. nextRepHint omitted — UI falls back to static copy.ts.
    headlineTone: mockFallbackTone(compositeScore),
  };
}

function mockFallbackTone(
  composite: number,
): "blunt" | "directive" | "praise" | "celebratory" {
  if (composite < 50) return "blunt";
  if (composite < 75) return "directive";
  if (composite < 90) return "praise";
  return "celebratory";
}

function mockFallbackHeadline(composite: number): string {
  if (composite < 50) return "That rep didn't land — see the breakdown below.";
  if (composite < 75)
    return "Solid bones. The breakdown below names what to tighten.";
  if (composite < 90) return "Strong rep. Sharpen one moment and this is a 90.";
  return "Nothing to fix here. Stretch yourself with a harder prompt.";
}

export async function POST(req: Request) {
  // Phase 0 — track total wall-clock from request entry to response so
  // telemetry captures the full picture (auth + rate-limit + DB writes +
  // scoring), not just the scoring step. Used for /api/score/health/stats.
  const requestStart = Date.now();

  // Auth: scoring is the single most expensive endpoint in the system
  // (Anthropic Opus). Require a user (auth or guest cookie) so the open-
  // internet anonymous-curl vector is closed. Rate-limit by user.id.
  const callerUser = await currentUser();
  if (!callerUser) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`user:${callerUser.id}:score`, {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many scoring requests. Wait a moment and try again.",
      },
      { status: 429 },
    );
  }

  let body: ScoreBody;
  try {
    const json = await req.json();
    body = bodySchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.errors[0];
      return NextResponse.json(
        {
          error: "invalid_input",
          message: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid request body",
          details: error.errors,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "invalid_input",
        message: error instanceof Error ? error.message : "Invalid request body",
      },
      { status: 400 },
    );
  }

  // Hoist userId out of the try so the catch block's telemetry write
  // can still attribute the failure to the right user.
  const { userId, calibrationBlock, coachingMemoryBlock } = await loadUserContext();

  try {
    // Apply per-framework dimension weight adjustments so sales frameworks
    // emphasize relevance, interview frameworks emphasize structure+pacing,
    // etc. No-op when no frameworkId or no matching profile.
    const frameworkWeights = getFrameworkWeights(body.frameworkId);

    // WS-3: pressure reps carry a weight profile from their archetype.
    // When present, it takes priority over framework weights — the
    // archetype's emphasis (e.g. Time Compression boosting pacing +
    // conciseness) is the whole point of the pressure rep, so letting
    // a framework profile dilute it would defeat the intent.
    const pressureWeights = body.pressureArchetypeId
      ? getPressureArchetype(body.pressureArchetypeId).weightProfile
      : null;

    const mergedWeights = pressureWeights ?? frameworkWeights ?? null;

    const { score, metrics } = await scoreRepWithMetrics({
      ...body,
      userCalibration: calibrationBlock,
      coachingMemory: coachingMemoryBlock,
      ...(userId ? { userId } : {}),
      ...(mergedWeights ? { weights: mergedWeights } : {}),
      ...(body.modeContext ? { modeContext: body.modeContext } : {}),
    });

    // Phase 0 — telemetry on the happy path. Fallback-fired counts as
    // a separate failure_reason so /api/score/health/stats can show
    // OpenAI-fallback rate distinct from anthropic-only success.
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
    // Anthropic scoring failed (no credits / rate limit / network / etc.).
    // Return a valid mock score so the workout flow stays usable end-to-end.
    // If word timings are present, pacing and confidence are STILL real
    // (deterministic). Only the LLM-scored dimensions are mocked.
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const failureReason = categorizeFailure(error);
    log.error({
      event: "score.scoring_failed",
      failureReason,
      err: serializeErr(error),
    });
    const fallback = buildFallbackScore(body, errorMsg, failureReason);

    // Phase 0 — categorize the failure so /api/score/health/stats can
    // group fallback rate by reason. Mock-fallback always means BOTH
    // anthropic AND openai failed (or openai wasn't configured), since
    // the wrapper's fallback path doesn't throw if openai succeeds.
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
      compositeScore: fallback.composite,
      modelUsedOverride: "mock-fallback-v1",
    });

    return NextResponse.json(fallback);
  }
}
