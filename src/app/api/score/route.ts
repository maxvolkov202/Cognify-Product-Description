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
import { getPressureArchetype } from "@/lib/ai/pressure-archetypes";
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
  "adaptability",
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
      dimension: "adaptability",
      score: 72,
      signals: [
        "[mock mode] Claude scoring unavailable — adaptability judgment skipped",
      ],
    },
  ];

  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of dimensions) dimensionMap[d.dimension] = d.score;
  const compositeScore = composite(dimensionMap);

  // Server-side log keeps the full error for debugging; user-visible
  // callout is consumer-neutral — never reference billing/credits/tokens
  // in copy that ships to end users.
  console.error("[score] mock fallback triggered:", errorMsg);
  const callouts: Callout[] = [
    {
      dimension: "clarity",
      tone: "neutral",
      title: "Scoring is taking a moment",
      body: hasWords
        ? "Your delivery and thinking quality are scored from real signals. Detailed per-moment feedback will catch up shortly — try another rep in a moment."
        : "We couldn't reach the scoring service. Your rep is recorded — try another rep in a moment.",
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
    // Phase 2 fields are absent in mock mode — the FeedbackPanel falls
    // back to Phase 1 client-side derivation from callouts. Empty arrays
    // are intentional: don't manufacture bullets we can't ground.
    didWell: [],
    didntLand: [],
    nextRepFocus: [],
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

    // WS-3: pressure reps carry a weight profile from their archetype.
    // When present, it takes priority over framework weights — the
    // archetype's emphasis (e.g. Time Compression boosting pacing +
    // conciseness) is the whole point of the pressure rep, so letting
    // a framework profile dilute it would defeat the intent.
    const pressureWeights = body.pressureArchetypeId
      ? getPressureArchetype(body.pressureArchetypeId).weightProfile
      : null;

    const mergedWeights = pressureWeights ?? frameworkWeights ?? null;

    const result = await scoreRep({
      ...body,
      userCalibration: calibrationBlock,
      ...(mergedWeights ? { weights: mergedWeights } : {}),
      ...(body.modeContext ? { modeContext: body.modeContext } : {}),
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
