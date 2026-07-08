import { NextResponse } from "next/server";
import { and, eq, isNotNull, lt, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronRuns, reps, users } from "@/lib/db/schema";
import { supabaseAdmin, hasSupabase } from "@/lib/supabase/admin";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUCKET = "rep-audio";
// Cap per-cron-run so a backlog can't blow the 300s budget. Remaining
// expired rows are picked up on the next daily run.
const MAX_REPS_PER_RUN = 2_000;

/**
 * Audio retention sweep — GET /api/cron/audio-retention
 *
 * Scheduled daily at 03:30 UTC. For each user with a positive
 * audio_retention_days, finds reps whose audio is older than that
 * window, deletes the blob from Supabase Storage, and nulls
 * audio_url + transcript on the rep row. NULL retention = user opted
 * out and rep audio is kept indefinitely.
 *
 * Voice is biometric PII; retention is GDPR/CCPA-relevant. Auth model
 * is the same as the other crons (Bearer CRON_SECRET — Vercel injects it automatically; the
 * spoofable x-vercel-cron header is deliberately NOT accepted).
 */
async function handleCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  const authOk = expected
    ? req.headers.get("authorization") === `Bearer ${expected}`
    : false;
  if (process.env.NODE_ENV === "production" && !authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasSupabase()) {
    log.warn({
      event: "cron.audio_retention.no_supabase",
      msg: "supabase not configured; skipping",
    });
    return NextResponse.json({ skipped: "no_supabase" });
  }

  // Mirrors the muscle-group-day-rollover pattern: callers preview blast
  // radius via ?dryRun=1 before letting the scheduler do the real work.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  log.info({ event: "cron.audio_retention.start", dryRun });

  // Single SQL pass over expired reps. Joins users to read each user's
  // configured retention window — users with NULL audio_retention_days
  // are excluded (kept forever).
  const expired = await db
    .select({
      repId: reps.id,
      userId: reps.userId,
      audioUrl: reps.audioUrl,
      createdAt: reps.createdAt,
      audioRetentionDays: users.audioRetentionDays,
    })
    .from(reps)
    .innerJoin(users, eq(users.id, reps.userId))
    .where(
      and(
        isNotNull(reps.audioUrl),
        isNotNull(users.audioRetentionDays),
        lt(
          reps.createdAt,
          // NOW() - INTERVAL N days. drizzleSql composes the parameterized
          // expression so the column value drives the interval per row.
          drizzleSql`NOW() - (${users.audioRetentionDays} || ' days')::interval`,
        ),
      ),
    )
    .limit(MAX_REPS_PER_RUN);

  if (dryRun) {
    const sample = expired.slice(0, 5).map((r) => ({
      repId: r.repId,
      userId: r.userId,
      ageDays: Math.floor(
        (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000,
      ),
      retentionDays: r.audioRetentionDays,
    }));
    log.info({
      event: "cron.audio_retention.dry_run",
      expired: expired.length,
      capped: expired.length === MAX_REPS_PER_RUN,
    });
    return NextResponse.json({
      dryRun: true,
      expired: expired.length,
      capped: expired.length === MAX_REPS_PER_RUN,
      sample,
    });
  }

  if (expired.length === 0) {
    log.info({ event: "cron.audio_retention.done", deleted: 0 });
    return NextResponse.json({ deleted: 0 });
  }

  const admin = supabaseAdmin();
  // Supabase Storage supports batched .remove(paths[]) up to 1000 at a time.
  // Group by 500 for safety + observability.
  const BATCH = 500;
  let deleted = 0;
  let storageErrors = 0;
  let dbErrors = 0;

  for (let i = 0; i < expired.length; i += BATCH) {
    const slice = expired.slice(i, i + BATCH);
    const paths = slice
      .map((r) => r.audioUrl)
      .filter((p): p is string => Boolean(p));

    if (paths.length > 0) {
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      if (error) {
        storageErrors += paths.length;
        log.error({
          event: "cron.audio_retention.storage_remove_failed",
          batchSize: paths.length,
          err: serializeErr(error),
        });
        // Keep going — null the DB columns even if blob removal failed,
        // since the user-facing intent is "this audio is gone." Operators
        // can sweep orphaned blobs separately.
      }
    }

    const repIds = slice.map((r) => r.repId);
    try {
      await db
        .update(reps)
        .set({ audioUrl: null, transcript: null })
        .where(drizzleSql`${reps.id} = ANY(${repIds}::uuid[])`);
      deleted += repIds.length;
    } catch (err) {
      dbErrors += repIds.length;
      log.error({
        event: "cron.audio_retention.db_update_failed",
        batchSize: repIds.length,
        err: serializeErr(err),
      });
    }
  }

  log.info({
    event: "cron.audio_retention.done",
    deleted,
    storageErrors,
    dbErrors,
    capped: expired.length === MAX_REPS_PER_RUN,
  });

  return NextResponse.json({
    deleted,
    storageErrors,
    dbErrors,
    capped: expired.length === MAX_REPS_PER_RUN,
  });
}

// ── P8 — cron run ledger ────────────────────────────────────────────────
// Wraps the handler so every authorized invocation records one
// cognify_v2.cron_runs row (name, ok, duration_ms, error). Best-effort:
// a down DB never turns the cron response into a 500. Unauthorized
// probes (401/403) are not recorded so they don't spam the ledger.
const CRON_NAME = "audio-retention";

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
