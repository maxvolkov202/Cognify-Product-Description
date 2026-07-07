import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";
import { generateWeeklyNarrative } from "@/lib/ai/weekly-summary";
import { getWeeklyRepSummary } from "@/lib/db/queries/progress";
import {
  getActiveUserIdsForWeeklyReport,
  upsertWeeklyReport,
  currentWeekStartIso,
} from "@/lib/db/queries/weekly-reports";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Per-user fanout concurrency. 8 keeps Claude + DB pressure bounded while
// shrinking wall time roughly 8x vs. the previous serial loop. Audit PR-6
// flagged this as the next bottleneck past ~150 active users.
const CONCURRENCY = 8;
// Per-cron-run cap. The cron has 300s; a single user averages ~2-3s end to
// end so 400 fits comfortably. Past this we skip and pick up next week —
// the narrative is informational, not transactional.
const MAX_USERS_PER_RUN = 400;

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
async function handleCron(req: Request) {
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
  const allUserIds = await getActiveUserIdsForWeeklyReport();
  const userIds = allUserIds.slice(0, MAX_USERS_PER_RUN);
  const deferred = allUserIds.length - userIds.length;

  log.info({
    event: "cron.weekly_narrative.start",
    totalActive: allUserIds.length,
    processing: userIds.length,
    deferred,
    concurrency: CONCURRENCY,
  });

  const results: Array<{ userId: string; status: "ok" | "error"; error?: string }> = [];

  async function processOne(userId: string): Promise<void> {
    try {
      const summary = await getWeeklyRepSummary(userId);
      if (summary.repCount === 0) {
        results.push({ userId, status: "ok" });
        return;
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
      log.error({
        event: "cron.weekly_narrative.user_failed",
        userId,
        err: serializeErr(err),
      });
      results.push({ userId, status: "error", error: msg });
    }
  }

  // Hand-rolled bounded concurrency — N workers pull from a shared cursor.
  // Avoids a p-limit dep and keeps memory flat regardless of queue size.
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, userIds.length) }, async () => {
    while (cursor < userIds.length) {
      const i = cursor++;
      await processOne(userIds[i]!);
    }
  });
  await Promise.all(workers);

  const ok = results.filter((r) => r.status === "ok").length;
  const errors = results.length - ok;
  log.info({
    event: "cron.weekly_narrative.done",
    weekStartIso,
    totalUsers: results.length,
    ok,
    errors,
    deferred,
  });
  return NextResponse.json({
    weekStartIso,
    totalUsers: results.length,
    ok,
    errors,
    deferred,
  });
}

// ── P8 — cron run ledger ────────────────────────────────────────────────
// Wraps the handler so every authorized invocation records one
// cognify_v2.cron_runs row (name, ok, duration_ms, error). Best-effort:
// a down DB never turns the cron response into a 500. Unauthorized
// probes (401/403) are not recorded so they don't spam the ledger.
const CRON_NAME = "weekly-narrative";

async function recordCronRun(
  ok: boolean,
  durationMs: number,
  error: string | null,
): Promise<void> {
  try {
    await db
      .insert(cronRuns)
      .values({ name: CRON_NAME, ok, durationMs, error });
  } catch {
    // Ledger write is best-effort — never fail the cron over it.
  }
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = Date.now();
  let res: Response;
  try {
    res = await handleCron(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(false, Date.now() - startedAt, message.slice(0, 300));
    throw err;
  }
  if (res.status !== 401 && res.status !== 403) {
    const ok = res.status >= 200 && res.status < 300;
    let error: string | null = null;
    if (!ok) {
      try {
        error = (await res.clone().text()).slice(0, 300);
      } catch {
        error = `HTTP ${res.status}`;
      }
    }
    await recordCronRun(ok, Date.now() - startedAt, error);
  }
  return res;
}
