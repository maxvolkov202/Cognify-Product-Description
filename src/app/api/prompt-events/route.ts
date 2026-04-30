import { NextResponse } from "next/server";
import { z } from "zod";
import {
  recordPromptsShown,
  recordPromptsRefreshedPast,
} from "@/lib/db/queries/prompt-engagement";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * POST /api/prompt-events
 *
 * Aggregate-only telemetry for the prompt-evolution loop. No per-user
 * dimension — see prompt-engagement.ts for the rationale.
 *
 * Events:
 *   shown            — slate of N rendered. Fires on mount + every refresh.
 *   refreshed_past   — N prompts were on screen and the user hit Refresh.
 *                       The picked event lives at /api/prompt-history (the
 *                       per-user history POST) which also bumps the
 *                       picked counter as a side effect.
 *
 * Authentication: not required. The aggregate doesn't need user identity,
 * and unauthenticated /try sessions still produce useful engagement
 * signal. Rate-limited to keep abuse contained.
 */
const bodySchema = z.object({
  event: z.enum(["shown", "refreshed_past"]),
  promptIds: z.array(z.string().min(1).max(120)).min(1).max(50),
});

export async function POST(req: Request): Promise<Response> {
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 60,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests." },
      { status: 429 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_input", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "invalid_input", message: "Bad request body" },
      { status: 400 },
    );
  }

  if (body.event === "shown") {
    await recordPromptsShown(body.promptIds);
  } else {
    await recordPromptsRefreshedPast(body.promptIds);
  }

  return NextResponse.json({ ok: true });
}
