import { NextResponse } from "next/server";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { calloutDriftReports, cronRuns } from "@/lib/db/schema";
import { log, serializeErr } from "@/lib/log";

/**
 * Phase 7 — weekly callout-drift detection cron.
 *
 * Aggregates the last 7 days of cognify_v2.callout_corrections by
 * (dimension, sub_skill, verdict) and writes the result to
 * cognify_v2.callout_drift_reports. Flags rows where wrong_rate
 * (= count of wrong+not_relevant / total in the (dim, sub_skill) group)
 * is ≥ 25% AND the group has ≥ 4 corrections (sample-size threshold).
 *
 * The signal lights up only when users start correcting callouts in
 * production. Until then, the cron writes no rows (corrections table
 * is empty in dev). The auto-proposal generator that consumes these
 * flagged rows is deferred — it's only useful with real signal.
 *
 * Cron schedule: weekly. Vercel cron picks this up via vercel.json.
 *
 * Idempotent for the current week: deletes any existing rows for the
 * computed week_start before inserting, so re-running mid-week
 * overwrites cleanly instead of double-counting.
 *
 * Security: vercel cron triggers send an `Authorization: Bearer <secret>`
 * header. We require CRON_SECRET in env; without it, the route
 * still runs but logs a warning so the operator notices the gap.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function weekStart(date: Date): Date {
  // ISO-week-start = Monday at 00:00 UTC. Use that so weekly buckets
  // align with most calendar tools.
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

async function handleCron(req: Request) {
  // Verify cron secret. Skip in dev when CRON_SECRET isn't set so this
  // route can be invoked from the browser for manual testing.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    log.warn({
      event: "cron.weekly_callout_drift.no_secret",
      msg: "CRON_SECRET not set — running without auth (dev only).",
    });
  }

  const now = new Date();
  const wkStart = weekStart(now);
  // ISO date string for the date column.
  const wkStartIso = wkStart.toISOString().slice(0, 10);

  try {
    // Step 1: clear any prior rows for this week (idempotent re-run).
    await db.execute(
      drizzleSql`DELETE FROM cognify_v2.callout_drift_reports WHERE week_start = ${wkStartIso}::date`,
    );

    // Step 2: aggregate the last 7 days of callout_corrections.
    // Group by (dim, sub_skill, verdict). Compute total per (dim,
    // sub_skill) so wrong_rate uses the right denominator.
    //
    // sub_skill in callout_corrections lives in the corrections row
    // directly (post-Ch.2). For older rows where it isn't populated,
    // we group by NULL — those land in a single "no sub_skill" bucket
    // that still surfaces dim-level drift.
    //
    // NB: callout_corrections doesn't have a sub_skill column today.
    // We pull it from the parent callouts row (the bullet's
    // sub_skill lives there) via the join already on the corrections.
    type DriftRow = {
      dimension: string;
      sub_skill: string | null;
      verdict: string;
      count: number;
      total_for_group: number;
      wrong_rate: number;
      flagged: boolean;
    };

    const rows = (await db.execute(
      drizzleSql`
        WITH joined AS (
          SELECT
            cc.verdict,
            c.dimension::text AS dimension,
            -- callouts table doesn't have sub_skill; use NULL for
            -- now. When the bullet sub_skill is migrated onto the
            -- callouts table, swap this to c.sub_skill.
            NULL::text AS sub_skill
          FROM cognify_v2.callout_corrections cc
          JOIN cognify_v2.callouts c ON c.id = cc.callout_id
          WHERE cc.created_at >= NOW() - INTERVAL '7 days'
            AND c.dimension != 'structural_adherence'
        ),
        per_verdict AS (
          SELECT dimension, sub_skill, verdict, COUNT(*)::int AS count
          FROM joined
          GROUP BY dimension, sub_skill, verdict
        ),
        per_group AS (
          SELECT dimension, sub_skill, COUNT(*)::int AS total_for_group
          FROM joined
          GROUP BY dimension, sub_skill
        )
        SELECT
          pv.dimension,
          pv.sub_skill,
          pv.verdict,
          pv.count,
          pg.total_for_group,
          (
            (SELECT COUNT(*)::int FROM joined j
              WHERE j.dimension = pv.dimension
                AND COALESCE(j.sub_skill, '') = COALESCE(pv.sub_skill, '')
                AND j.verdict IN ('wrong', 'not_relevant')
            )::real / pg.total_for_group
          ) AS wrong_rate,
          (
            pg.total_for_group >= 4
            AND (
              (SELECT COUNT(*)::int FROM joined j
                WHERE j.dimension = pv.dimension
                  AND COALESCE(j.sub_skill, '') = COALESCE(pv.sub_skill, '')
                  AND j.verdict IN ('wrong', 'not_relevant')
              )::real / pg.total_for_group
            ) >= 0.25
          ) AS flagged
        FROM per_verdict pv
        JOIN per_group pg
          ON pg.dimension = pv.dimension
          AND COALESCE(pg.sub_skill, '') = COALESCE(pv.sub_skill, '')
      `,
    )) as unknown as DriftRow[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({
        ok: true,
        weekStart: wkStartIso,
        rowsWritten: 0,
        note: "no callout_corrections in last 7 days — empty report (expected before users start correcting).",
      });
    }

    // Step 3: insert.
    await db.insert(calloutDriftReports).values(
      rows.map((r) => ({
        weekStart: wkStartIso,
        dimension: r.dimension as
          | "clarity"
          | "structure"
          | "conciseness"
          | "thinking_quality"
          | "delivery"
          | "tone",
        subSkill: r.sub_skill,
        verdict: r.verdict,
        count: r.count,
        totalForGroup: r.total_for_group,
        wrongRate: r.wrong_rate,
        flagged: r.flagged,
      })),
    );

    const flaggedCount = rows.filter((r) => r.flagged).length;
    return NextResponse.json({
      ok: true,
      weekStart: wkStartIso,
      rowsWritten: rows.length,
      flaggedCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({
      event: "cron.weekly_callout_drift.failed",
      err: serializeErr(err),
    });
    return NextResponse.json(
      { ok: false, error: msg.slice(0, 500) },
      { status: 500 },
    );
  }
}

// ── P8 — cron run ledger ────────────────────────────────────────────────
// Wraps the handler so every authorized invocation records one
// cognify_v2.cron_runs row (name, ok, duration_ms, error). Best-effort:
// a down DB never turns the cron response into a 500. Unauthorized
// probes (401/403) are not recorded so they don't spam the ledger.
const CRON_NAME = "weekly-callout-drift";

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
