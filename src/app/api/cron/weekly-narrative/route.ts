import { NextResponse } from "next/server";
import { generateWeeklyNarrative } from "@/lib/ai/weekly-summary";
import { getWeeklyRepSummary } from "@/lib/db/queries/progress";
import {
  getActiveUserIdsForWeeklyReport,
  upsertWeeklyReport,
  currentWeekStartIso,
} from "@/lib/db/queries/weekly-reports";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Weekly narrative cron — GET /api/cron/weekly-narrative
 *
 * Scheduled by Vercel Cron (see vercel.json) for Sunday 18:00 UTC.
 * Iterates users who have reps in the last 14 days, generates their
 * narrative for the current week, and upserts into weekly_reports.
 *
 * Auth model: Vercel's Cron invocations send `x-vercel-cron: 1` and a
 * shared secret in `authorization: Bearer ${CRON_SECRET}`. We verify
 * the secret in prod — bypass it in dev so manual triggering from
 * `curl localhost:3333/api/cron/weekly-narrative` works.
 */
export async function GET(req: Request) {
  // Fail closed. Either the request carries a matching Bearer secret,
  // or it carries Vercel's own cron header (set only on real cron runs).
  // In development we relax so `curl localhost:3333/...` still triggers
  // the cron manually.
  const expected = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const authOk = expected
    ? req.headers.get("authorization") === `Bearer ${expected}`
    : false;
  if (process.env.NODE_ENV === "production" && !authOk && !isVercelCron) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const weekStartIso = currentWeekStartIso();
  const userIds = await getActiveUserIdsForWeeklyReport();

  const results: Array<{ userId: string; status: "ok" | "error"; error?: string }> = [];
  // Serial iteration keeps Claude + DB pressure low. The cron has a
  // 300s budget so ~100 users at ~2s each is fine; if the active user
  // count grows past that we'll batch with p-limit or Queue.
  for (const userId of userIds) {
    try {
      const summary = await getWeeklyRepSummary(userId);
      if (summary.repCount === 0) {
        // No reps this week — skip to save Claude spend.
        results.push({ userId, status: "ok" });
        continue;
      }
      const narrative = await generateWeeklyNarrative(summary);
      await upsertWeeklyReport({
        userId,
        weekStartIso: summary.weekStartISO || weekStartIso,
        narrative,
      });
      results.push({ userId, status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(
        `[cron/weekly-narrative] user ${userId} failed:`,
        msg,
      );
      results.push({ userId, status: "error", error: msg });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const errors = results.length - ok;
  return NextResponse.json({
    weekStartIso,
    totalUsers: results.length,
    ok,
    errors,
  });
}
