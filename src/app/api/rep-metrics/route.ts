import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/current-user";
import { isLiveRepMetricsEnabled } from "@/lib/flags";
import { getProsodyCacheState } from "@/lib/audio/prosody-cache";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Prosody v2 Phase 4 — read-only feed for the "Measured delivery" strip.
 * Carries the server-resolved FF_LIVE_REP_METRICS flag (pure client code
 * never reads env) and the warm-cache pitch STATE for the caller's own
 * audio, so the client stops polling the moment the answer is terminal:
 *   unavailable — worker off / path not eligible: never ask again
 *   pending     — warm may still land: poll within budget
 *   failed      — warm failed: stop, hide the pitch line
 *   ready       — measurements included
 * Display-only: nothing here touches scoring.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const enabled = isLiveRepMetricsEnabled();
  if (!enabled) return NextResponse.json({ enabled: false });
  const rl = await rateLimit(`user:${user.id}:rep-metrics`, { count: 40, window: "1 m" });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const path = new URL(req.url).searchParams.get("path");
  // No warm ever happens when the worker flag is off; owner scope mirrors
  // /api/score's audioPath rule.
  if (process.env.FF_PROSODY_WORKER !== "true" || (path && !path.startsWith(`reps/${user.id}/`))) {
    return NextResponse.json({ enabled, state: "unavailable" });
  }
  if (!path) return NextResponse.json({ enabled, state: "pending" });
  const row = await getProsodyCacheState(path);
  if (!row) return NextResponse.json({ enabled, state: "pending" });
  if (row.status === "failed") return NextResponse.json({ enabled, state: "failed" });
  if (row.status !== "ready" || !row.features) {
    return NextResponse.json({ enabled, state: "pending" });
  }
  return NextResponse.json({
    enabled,
    state: "ready",
    pitchStdSemitones: row.features.pitchStdSemitones ?? null,
    monotoneRatio: row.features.monotoneRatio ?? null,
    monotoneWindowed: row.features.monotoneWindowed ?? null,
  });
}
