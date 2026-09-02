import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/current-user";
import { isLiveRepMetricsEnabled } from "@/lib/flags";
import { getCachedProsody } from "@/lib/audio/prosody-cache";

export const runtime = "nodejs";

/**
 * Prosody v2 Phase 4 — read-only feed for the "Measured delivery" strip.
 * Carries the server-resolved FF_LIVE_REP_METRICS flag (pure client code
 * never reads env) and, when the caller owns the audio path, the warm
 * cache's pitch measurements. Display-only: nothing here touches scoring.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const enabled = isLiveRepMetricsEnabled();
  const path = new URL(req.url).searchParams.get("path");
  // Owner scope: same rule as /api/score's audioPath check — a client can
  // only read prosody for audio under its own reps/<user.id>/ prefix.
  if (!enabled || !path || !path.startsWith(`reps/${user.id}/`)) {
    return NextResponse.json({ enabled, ready: false });
  }
  const features = await getCachedProsody(path);
  if (!features) return NextResponse.json({ enabled, ready: false });
  return NextResponse.json({
    enabled,
    ready: true,
    pitchStdSemitones: features.pitchStdSemitones ?? null,
    monotoneRatio: features.monotoneRatio ?? null,
    monotoneWindowed: features.monotoneWindowed ?? null,
  });
}
