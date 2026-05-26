import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/current-user";
import { getWeeklyRepSummary } from "@/lib/db/queries/progress";
import { generateWeeklyNarrative } from "@/lib/ai/weekly-summary";
import {
  getWeeklyReportForWeek,
  upsertWeeklyReport,
  currentWeekStartIso,
} from "@/lib/db/queries/weekly-reports";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/weekly-narrative
 *
 * Read-through cache:
 *   1. Look up weekly_reports for (userId, currentWeekStartIso). If a row
 *      exists and was written in the last 24h, return it immediately —
 *      this is the cron-produced path.
 *   2. Otherwise call Claude, return the narrative, and write back to
 *      weekly_reports so subsequent requests this week are free.
 *
 * Client still caches for 12h in localStorage — the DB cache is for
 * cross-device consistency + cost containment, not hot-path latency.
 */
export async function GET(req: Request) {
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 10,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Try again in a moment." },
      { status: 429 },
    );
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401 },
    );
  }

  const summary = await getWeeklyRepSummary(user.id);
  const weekStartIso = summary.weekStartISO || currentWeekStartIso();

  // Cache hit path — use only if the stored narrative is < 24h old.
  const cached = await getWeeklyReportForWeek(user.id, weekStartIso);
  if (cached && Date.now() - cached.generatedAt.getTime() < 24 * 60 * 60 * 1000) {
    return NextResponse.json({
      summary,
      narrative: cached.narrative,
      cached: true,
    });
  }

  try {
    const narrative = await generateWeeklyNarrative(summary);
    // Best-effort DB write — if safeDb fails, the response still works.
    await upsertWeeklyReport({
      userId: user.id,
      weekStartIso,
      narrative,
    });
    return NextResponse.json({ summary, narrative });
  } catch (err) {
    log.error({
      event: "weekly_narrative.generation_failed",
      err: serializeErr(err),
    });
    return NextResponse.json({
      summary,
      narrative: {
        paragraph:
          summary.repCount === 0
            ? "No reps logged this week — the gym's waiting."
            : `${summary.repCount} reps this week. Average composite ${summary.averageComposite}/100. Recap generation is temporarily unavailable.`,
        hookStat: `${summary.repCount} reps · avg ${summary.averageComposite}`,
        nextFocus: summary.weakestDimension
          ? `Work on ${summary.weakestDimension} this week.`
          : "Run a Daily Workout today.",
      },
    });
  }
}
