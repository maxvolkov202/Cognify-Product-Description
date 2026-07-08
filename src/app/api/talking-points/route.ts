import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateTalkingPoints,
  defaultTalkingPoints,
  type GenerateTalkingPointsInput,
} from "@/lib/ai/talking-points";
import { hasAnthropic } from "@/lib/db/safe";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import { log, serializeErr } from "@/lib/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scenario: z.string().min(1).max(2000),
  archetype: z.string().max(100).optional(),
  framework: z
    .object({
      slug: z.string().max(60),
      label: z.string().max(120).optional(),
    })
    .optional(),
  vertical: z.string().max(60).optional(),
  goal: z.string().max(120).optional(),
}).passthrough();

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
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`user:${user.id}:talking-points`, {
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

  // Phase 11.A2 — the generation shim falls back to OpenAI, so gate on
  // ANY provider being configured, not Anthropic specifically (this
  // silently served defaults while running OpenAI-only).
  if (!hasAnthropic() && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(defaultTalkingPoints());
  }

  let body: GenerateTalkingPointsInput;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw) as GenerateTalkingPointsInput;
  } catch (err) {
    const detail =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : "Bad request";
    return NextResponse.json(
      { error: "invalid_body", message: detail },
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
    log.error({
      event: "talking_points.unexpected",
      err: serializeErr(err),
    });
    return NextResponse.json(defaultTalkingPoints());
  }
}
