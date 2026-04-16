import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreRep } from "@/lib/ai/score";
import { extractSignals } from "@/lib/scoring/signals";
import {
  scorePacing,
  scoreConfidenceDeterministic,
} from "@/lib/scoring/deterministic";
import { RUBRIC_VERSION, composite } from "@/lib/scoring/rubric";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import type { RepScore, SkillDimension, Callout } from "@/types/domain";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import {
  getUserCalibrationProfile,
  renderCalibrationForPrompt,
} from "@/lib/db/queries/calibration";

/**
 * Pull the user's calibration context from past ratings + corrections and
 * render it as a short system-prompt block. Safe to call for unauthenticated
 * users — returns null when there's no calibration signal yet.
 */
async function loadCalibrationForCurrentUser(): Promise<string | null> {
  const user = await currentUser();
  if (!user) return null;
  const profile = await getUserCalibrationProfile(user.id);
  return renderCalibrationForPrompt(profile);
}

export const runtime = "nodejs";
export const maxDuration = 30;

const wordSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

const bodySchema = z.object({
  transcript: z.string().min(1).max(10000),
  promptText: z.string().min(1).max(500),
  durationMs: z.number().int().min(1000).max(300000),
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
});

type ScoreBody = z.infer<typeof bodySchema>;

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
 */
function buildFallbackScore(body: ScoreBody, errorMsg: string): RepScore {
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
      dimension: "relevance",
      score: 72,
      signals: [
        "[mock mode] Claude scoring unavailable — relevance-to-prompt judgment skipped",
      ],
    },
    {
      dimension: "confidence",
      score: confidenceResult?.score ?? 70,
      signals: confidenceResult?.signals ?? [
        "[mock mode] signals unavailable without word timings",
      ],
    },
    {
      dimension: "pacing",
      score: pacingResult?.score ?? 70,
      signals: pacingResult?.signals ?? [
        "[mock mode] signals unavailable without word timings",
      ],
    },
    {
      dimension: "tone",
      score: 72,
      signals: [
        "[mock mode] Claude scoring unavailable — audience-register judgment skipped",
      ],
    },
  ];

  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of dimensions) dimensionMap[d.dimension] = d.score;
  const compositeScore = composite(dimensionMap);

  const callouts: Callout[] = [
    {
      dimension: "clarity",
      tone: "neutral",
      title: "Running in mock scoring mode",
      body: `Anthropic API call failed: ${errorMsg.slice(0, 160)}${errorMsg.length > 160 ? "…" : ""}. ${hasWords ? "Pacing and confidence are still real (deterministic). " : ""}Add credits at console.anthropic.com/settings/billing or set a different ANTHROPIC_API_KEY to get real semantic scoring + actionable callouts.`,
      quote: null,
      suggestedRewrite: null,
      transcriptStart: 0,
      transcriptEnd: Math.min(1000, body.durationMs),
    },
  ];

  // If we have real deterministic pacing data, surface it as a positive/warn
  // callout so the user sees actual signal, not just the mock notice.
  if (pacingResult) {
    const tone: Callout["tone"] =
      pacingResult.score >= 80
        ? "positive"
        : pacingResult.score >= 60
          ? "neutral"
          : "warn";
    callouts.push({
      dimension: "pacing",
      tone,
      title: `Pacing (real) — ${pacingResult.score}/100`,
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
      dimension: "confidence",
      tone,
      title: `Confidence (deterministic baseline) — ${confidenceResult.score}/100`,
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
  };
}

export async function POST(req: Request) {
  // Rate limiting — protects against runaway loops burning Anthropic credits.
  // Degrades gracefully without Upstash env vars (see src/lib/ratelimit.ts).
  const rl = await rateLimit(getRateLimitIdentifier(req), {
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

  try {
    const calibrationBlock = await loadCalibrationForCurrentUser();
    // Apply per-framework dimension weight adjustments so sales frameworks
    // emphasize relevance, interview frameworks emphasize structure+pacing,
    // etc. No-op when no frameworkId or no matching profile.
    const frameworkWeights = getFrameworkWeights(body.frameworkId);
    const result = await scoreRep({
      ...body,
      userCalibration: calibrationBlock,
      ...(frameworkWeights ? { weights: frameworkWeights } : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    // Anthropic scoring failed (no credits / rate limit / network / etc.).
    // Return a valid mock score so the workout flow stays usable end-to-end.
    // If word timings are present, pacing and confidence are STILL real
    // (deterministic). Only the LLM-scored dimensions are mocked.
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(
      "[api/score] Claude scoring failed, returning fallback mock score:",
      errorMsg,
    );
    const fallback = buildFallbackScore(body, errorMsg);
    return NextResponse.json(fallback);
  }
}
