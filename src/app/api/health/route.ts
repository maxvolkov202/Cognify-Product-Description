import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hasDatabase, getDbWriteFailureStats } from "@/lib/db/safe";
import { getAuthDegradedStats } from "@/lib/ops/counters";
import { getAiHealthSnapshot } from "@/lib/ai/claude";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

/**
 * Phase 15 P-4 — the general platform health surface.
 *
 * One GET answers the launch-ops questions the score-specific probes
 * can't: is the DB reachable (and how close to the pooler ceiling), are
 * WRITES silently failing (the F-4 class, via safeDb's labeled-write
 * counters), is auth silently degrading to guest (the F-2 class), and
 * which AI provider is serving (with breaker state).
 *
 * The in-process counters are per-instance by design: they exist so a
 * failing instance can't report "all healthy" just because the DB —
 * where a ledger would live — is the thing that's down.
 */
export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: Request) {
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  // DB reachability + pooler pressure. Both best-effort: this endpoint
  // must render something useful even when the DB is the problem.
  const dbHealth: {
    reachable: boolean;
    latencyMs: number | null;
    connections: number | null;
    error: string | null;
  } = { reachable: false, latencyMs: null, connections: null, error: null };

  if (!hasDatabase()) {
    dbHealth.error = "DATABASE_URL not set";
  } else {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      dbHealth.reachable = true;
      dbHealth.latencyMs = Date.now() - start;
      try {
        const rows = await db.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM pg_stat_activity`,
        );
        dbHealth.connections = rows[0]?.n ?? null;
      } catch {
        // pg_stat_activity can be restricted through poolers — fine.
      }
    } catch (err) {
      dbHealth.error =
        err instanceof Error ? err.message.slice(0, 200) : "unknown";
    }
  }

  const writeFailures = getDbWriteFailureStats();
  const authDegraded = getAuthDegradedStats();
  const ai = getAiHealthSnapshot();

  // ok = nothing is CURRENTLY known-broken on this instance. Historical
  // counters don't flip ok (they're since process start) — they're for
  // dashboards/alerts to threshold on.
  const ok =
    dbHealth.reachable &&
    !ai.breaker[ai.provider].open;

  // Phase 16 pre-prod hardening: the PUBLIC body is a bare liveness
  // signal (safe for external uptime pollers). The detailed body — raw
  // DB error strings, pooler connection counts, write-failure messages,
  // provider/breaker state — requires the ops bearer (OPS_SECRET, falls
  // back to CRON_SECRET so no new credential is strictly required).
  const opsSecret = process.env.OPS_SECRET ?? process.env.CRON_SECRET;
  const authorized =
    process.env.NODE_ENV !== "production" ||
    (!!opsSecret &&
      req.headers.get("authorization") === `Bearer ${opsSecret}`);

  if (!authorized) {
    return NextResponse.json(
      { ok, ts: new Date().toISOString() },
      { status: ok ? 200 : 503 },
    );
  }

  return NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
      db: dbHealth,
      writes: writeFailures,
      auth: authDegraded,
      ai,
    },
    { status: ok ? 200 : 503 },
  );
}
