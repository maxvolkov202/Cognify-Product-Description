// PRD v3 Phase 6.8 — committed-day reminder cron.
//
// Runs hourly. For each user whose LOCAL time is early evening
// (REMINDER_LOCAL_HOUR) on one of their committed training days, who
// hasn't trained yet today (their tz), has reminders enabled, and
// hasn't been reminded today: send the nudge email + stamp the dedupe
// column. Guarded by FF_RANK_SYSTEM? No — reminders are independent of
// rank; guarded only by the user-level opt-out (default on).
//
// Auth: same CRON_SECRET pattern as the other crons.

import { NextResponse } from "next/server";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";
import { log, serializeErr } from "@/lib/log";
import { isDateCommitted } from "@/lib/onboarding/committed-days";
import { sendCommittedDayReminderEmail } from "@/lib/email/send";
import { getStreakDays } from "@/lib/db/queries/progress";

export const runtime = "nodejs";
export const maxDuration = 300;

/** User-local hour (0-23) the reminder fires at. 17:00 leaves the whole
 *  evening to act on it. */
const REMINDER_LOCAL_HOUR = 17;
const BATCH_LIMIT = 200;

function localParts(tz: string, now: Date): { ymd: string; hour: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      ymd: `${get("year")}-${get("month")}-${get("day")}`,
      hour: Number(get("hour")) % 24,
    };
  } catch {
    return {
      ymd: now.toISOString().slice(0, 10),
      hour: now.getUTCHours(),
    };
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
      event: "cron.committed_day_reminder.no_secret",
      msg: "CRON_SECRET not set — running without auth (dev only).",
    });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const now = new Date();

  try {
    // Candidates: reminders enabled, has an email, not yet reminded on
    // any date ≥ today-UTC-1 (cheap prefilter; exact local-day dedupe
    // happens below), and no rep in the last ~26h (cheap prefilter for
    // "hasn't trained today in any tz").
    const rows = await db.execute<{
      id: string;
      email: string;
      name: string | null;
      tz: string;
      committed_days: number;
      last_reminder_sent_at: string | null;
      last_rep_at: Date | null;
    }>(drizzleSql`
      SELECT u.id, u.email, u.name, u.tz, u.committed_days,
             u.last_reminder_sent_at::text AS last_reminder_sent_at,
             (SELECT MAX(r.created_at) FROM cognify_v2.reps r WHERE r.user_id = u.id)
               AS last_rep_at
      FROM cognify_v2.users u
      WHERE u.reminder_emails_enabled = true
        AND u.email IS NOT NULL
        AND (SELECT MAX(r.created_at) FROM cognify_v2.reps r WHERE r.user_id = u.id) IS NOT NULL
      LIMIT ${BATCH_LIMIT}
    `);

    let sent = 0;
    let considered = 0;
    for (const u of rows) {
      const { ymd, hour } = localParts(u.tz, now);
      if (hour !== REMINDER_LOCAL_HOUR) continue;
      considered++;
      if (u.last_reminder_sent_at === ymd) continue;
      if (!isDateCommitted(u.committed_days, now, u.tz)) continue;
      // Trained today (their local day)? Compare last rep's local date.
      if (u.last_rep_at) {
        const lastRepLocal = localParts(u.tz, new Date(u.last_rep_at)).ymd;
        if (lastRepLocal === ymd) continue;
      }
      const streakDays = await getStreakDays(u.id);
      if (!dryRun) {
        await sendCommittedDayReminderEmail({
          to: u.email,
          name: u.name,
          streakDays,
        });
        await db.execute(drizzleSql`
          UPDATE cognify_v2.users
          SET last_reminder_sent_at = ${ymd}::date
          WHERE id = ${u.id}
        `);
      }
      sent++;
    }

    log.info({
      event: "cron.committed_day_reminder.done",
      considered,
      sent,
      dryRun,
    });
    return NextResponse.json({ ok: true, considered, sent, dryRun });
  } catch (err) {
    log.error({
      event: "cron.committed_day_reminder.failed",
      err: serializeErr(err),
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// ── P8 — cron run ledger ────────────────────────────────────────────────
// Wraps the handler so every authorized invocation records one
// cognify_v2.cron_runs row (name, ok, duration_ms, error). Best-effort:
// a down DB never turns the cron response into a 500. Unauthorized
// probes (401/403) are not recorded so they don't spam the ledger.
const CRON_NAME = "committed-day-reminder";

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
