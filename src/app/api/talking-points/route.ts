import { NextResponse } from "next/server";
import {
  generateTalkingPoints,
  defaultTalkingPoints,
  type GenerateTalkingPointsInput,
} from "@/lib/ai/talking-points";
import { hasAnthropic } from "@/lib/db/safe";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/talking-points
 * Body: GenerateTalkingPointsInput
 * Returns: TalkingPoints ({ sections: [...] })
 *
 * Graceful degradation: if ANTHROPIC_API_KEY is missing, returns the
 * default Problem → Impact → Solution structure so the UX still works
 * in dev without keys. Never returns a blank state.
 */
export async function POST(request: Request) {
  // Rate limiting — protects against abuse hitting Claude Opus.
  const rl = await rateLimit(getRateLimitIdentifier(request), {
    count: 15,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many structure generations. Wait a moment and try again.",
      },
      { status: 429 },
    );
  }

  if (!hasAnthropic()) {
    return NextResponse.json(defaultTalkingPoints());
  }

  let body: GenerateTalkingPointsInput;
  try {
    body = (await request.json()) as GenerateTalkingPointsInput;
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!body.scenario || typeof body.scenario !== "string") {
    return NextResponse.json(
      { error: "scenario_required" },
      { status: 400 },
    );
  }

  try {
    const result = await generateTalkingPoints(body);
    return NextResponse.json(result);
  } catch (err) {
    // generateTalkingPoints itself has a try/catch that returns
    // defaultTalkingPoints on failure, so this should be unreachable.
    // Keep as a safety net.
    console.error("[api/talking-points] unexpected error", err);
    return NextResponse.json(defaultTalkingPoints());
  }
}
