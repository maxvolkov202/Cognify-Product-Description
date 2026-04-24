import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/current-user";
import { getWeeklyRepSummary } from "@/lib/db/queries/progress";
import { generateWeeklyNarrative } from "@/lib/ai/weekly-summary";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/weekly-narrative
 *
 * Returns { summary, narrative } for the authenticated user's current week.
 * Narrative is generated on-demand by Claude Sonnet from the summary.
 * Client caches in localStorage for the current weekStartISO so we
 * don't re-generate on every /progress page visit.
 */
export async function GET(req: Request) {
  // Generous rate limit — this is a read-only recap, not a hot path.
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
  try {
    const narrative = await generateWeeklyNarrative(summary);
    return NextResponse.json({ summary, narrative });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/weekly-narrative] generation failed:", message);
    // Graceful fallback so /progress always has something to show —
    // a short data-only summary with no LLM-written paragraph.
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
