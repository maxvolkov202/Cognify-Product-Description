import { NextResponse } from "next/server";
import { anthropic, MODELS } from "@/lib/ai/claude";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

/**
 * One-shot Claude reachability probe. Sends a single-token completion to
 * the scoring model. Used to disambiguate "the API is down" from "the
 * scoring prompt has a bug" without burning a real rep through /api/score.
 *
 * Cost: ~5–10 input tokens, 1 output token. Rate-limited to keep this
 * from being abused as a free Claude proxy.
 *
 * Returns:
 *   { ok: true,  model, latencyMs }                            — Claude reachable
 *   { ok: false, status, errorType, message, latencyMs }       — Claude responded with an error
 *   { ok: false, status: 0, errorType: "network", message }    — couldn't reach Anthropic at all
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 10,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, status: 429, errorType: "rate_limited", message: "Too many health checks." },
      { status: 429 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        status: 0,
        errorType: "no_api_key",
        message: "ANTHROPIC_API_KEY is not set in .env.local",
      },
      { status: 500 },
    );
  }

  const start = Date.now();
  try {
    await anthropic.messages.create({
      model: MODELS.scoring,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return NextResponse.json({
      ok: true,
      model: MODELS.scoring,
      latencyMs: Date.now() - start,
    });
  } catch (error) {
    const latencyMs = Date.now() - start;
    // Anthropic SDK errors expose .status (HTTP) and .message (verbatim
    // server response). Pass both through unfiltered — this endpoint is
    // diagnostic, the developer needs to see the real billing message
    // from Anthropic to know whether to add credits, swap workspaces, etc.
    const e = error as { status?: number; message?: string; name?: string };
    return NextResponse.json(
      {
        ok: false,
        status: e.status ?? 0,
        errorType: e.name ?? "unknown",
        message: e.message ?? String(error),
        latencyMs,
      },
      { status: 200 }, // 200 so curl doesn't hide the body — the JSON has the real status
    );
  }
}
