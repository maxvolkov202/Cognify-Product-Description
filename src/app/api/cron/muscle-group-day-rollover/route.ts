// Phase 10 — muscle-group day-rollover cron.
//
// Scans cognify_v2.muscle_group_days for rows whose day_date is in the
// past (in the user's local timezone) and whose closed_out_at is NULL,
// then runs closeOutDay() on each. Idempotent — closeOutDay's
// internal guard short-circuits if a row was already closed.
//
// Schedule: hourly. Each user's local-midnight lands inside one of
// 24 hourly invocations. Vercel cron config in vercel.json.
//
// Auth: same pattern as src/app/api/cron/weekly-callout-drift —
// Bearer header with CRON_SECRET in prod; warn-and-allow in dev.

import { NextResponse } from "next/server";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";
import { closeOutDay } from "@/lib/muscle-groups/day-status";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";

const GRACE_MINUTES = 60;

/** Returns YYYY-MM-DD for the current local-date in the user's tz.
 *  Falls back to UTC date when the tz is missing or malformed. */
function localDateForTz(tz: string, now: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA emits YYYY-MM-DD natively.
    return fmt.format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

async function handleCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    log.warn({
      event: "cron.muscle_group_day_rollover.no_secret",
      msg: "CRON_SECRET not set — running without auth (dev only).",
    });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const now = new Date();

  // Fetch open days + the owning user's tz in one go. Limit a single
  // cron invocation to a manageable batch so runaway scans don't time
  // out; the hourly cadence catches up over multiple runs.
  const rows = await db.execute<{
    id: string;
    user_id: string;
    day_date: string;
    dimension: string;
    completed_reps: number;
    tz: string;
    most_recent_rep_started_at: Date | null;
  }>(drizzleSql`
    SELECT
      d.id, d.user_id, d.day_date::text AS day_date, d.dimension::text AS dimension,
      d.completed_reps, u.tz,
      (SELECT MAX(r.created_at) FROM cognify_v2.reps r WHERE r.muscle_group_day_id = d.id)
        AS most_recent_rep_started_at
    FROM cognify_v2.muscle_group_days d
    JOIN cognify_v2.users u ON u.id = d.user_id
    WHERE d.closed_out_at IS NULL
      AND d.status NOT IN ('complete', 'frozen_skip', 'missed')
    ORDER BY d.day_date ASC
    LIMIT 500
  `);

  const stats = {
    inspected: rows.length,
    closedComplete: 0,
    closedPartial: 0,
    closedMissed: 0,
    closedFrozen: 0,
    skippedInGrace: 0,
    skippedFuture: 0,
    skippedIdempotent: 0,
    errors: 0,
  };

  for (const row of rows) {
    const userLocalToday = localDateForTz(row.tz ?? "UTC", now);
    // Only close out rows whose day_date is strictly before today in
    // the user's tz. Today's row stays open until tomorrow.
    if (row.day_date >= userLocalToday) {
      stats.skippedFuture += 1;
      continue;
    }
    // 1-hour grace window: if the most recent rep on this day was
    // saved within the last GRACE_MINUTES, skip — the user might still
    // be wrapping up.
    if (row.most_recent_rep_started_at) {
      const ageMs = now.getTime() - row.most_recent_rep_started_at.getTime();
      if (ageMs < GRACE_MINUTES * 60_000) {
        stats.skippedInGrace += 1;
        continue;
      }
    }

    if (dryRun) {
      stats.inspected += 0; // already counted
      continue;
    }

    try {
      const result = await closeOutDay(row.user_id, row.id, now);
      if (!result.ok) {
        stats.errors += 1;
        continue;
      }
      if (result.idempotentSkip) {
        stats.skippedIdempotent += 1;
        continue;
      }
      switch (result.status) {
        case "complete":
        case "complete_graduated":
          stats.closedComplete += 1;
          break;
        case "partial":
          stats.closedPartial += 1;
          break;
        case "missed":
          stats.closedMissed += 1;
          break;
        case "frozen_skip":
          stats.closedFrozen += 1;
          break;
      }
    } catch (err) {
      log.error({
        event: "cron.muscle_group_day_rollover.close_out_failed",
        dayId: row.id,
        userId: row.user_id,
        err: serializeErr(err),
      });
      stats.errors += 1;
    }
  }

  log.info({
    event: "cron.muscle_group_day_rollover.done",
    dryRun,
    ...stats,
  });

  return NextResponse.json({ ok: true, dryRun, ...stats });
}

// ── P8 — cron run ledger ────────────────────────────────────────────────
// Wraps the handler so every authorized invocation records one
// cognify_v2.cron_runs row (name, ok, duration_ms, error). Best-effort:
// a down DB never turns the cron response into a 500. Unauthorized
// probes (401/403) are not recorded so they don't spam the ledger.
const CRON_NAME = "muscle-group-day-rollover";

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
