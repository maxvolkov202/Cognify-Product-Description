import { NextResponse } from "next/server";
import { anthropic, MODELS, AI_PROVIDER_ACTIVE } from "@/lib/ai/claude";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

/**
 * One-shot AI reachability probe (Phase 14: provider-agnostic). Sends a
 * single-token completion through the shim — whichever provider is the
 * configured primary answers (breaker/fallback rules apply, so this
 * probes the SAME serving path real reps use). Disambiguates "the API is
 * down" from "the scoring prompt has a bug" without burning a real rep.
 *
 * Cost: ~5–10 input tokens, 1 output token. Rate-limited to keep this
 * from being abused as a free proxy.
 *
 * Returns:
 *   { ok: true,  provider, model, latencyMs }                  — serving path reachable
 *   { ok: false, status, errorType, message, latencyMs }       — provider errored
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

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        status: 0,
        errorType: "no_api_key",
        message:
          "No AI provider key set — add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.local",
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
      provider: AI_PROVIDER_ACTIVE,
      model: MODELS.scoring,
      latencyMs: Date.now() - start,
    });
  } catch (error) {
    const latencyMs = Date.now() - start;
    // Provider SDK errors expose .status (HTTP) and .message (verbatim
    // server response). Pass both through unfiltered — this endpoint is
    // diagnostic; the developer needs the real billing message to know
    // whether to add credits, swap workspaces, etc.
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
