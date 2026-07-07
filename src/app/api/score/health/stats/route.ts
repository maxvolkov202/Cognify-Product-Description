import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scoringTelemetry, users } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";

/**
 * Phase 0 — scoring telemetry aggregates dashboard.
 *
 * Reads scoring_telemetry over 1h / 24h / 7d windows and returns:
 *   - count + p50/p95/p99 of total_server_duration_ms
 *   - p50/p95/p99 of model_duration_ms (LLM-only)
 *   - failure_reason distribution
 *   - cache-hit rate (rows where cache_read_tokens > 0)
 *   - mock-fallback rate (failure_reason = mock_fallback_both_failed)
 *   - openai-fallback rate (failure_reason = openai_fallback_used)
 *
 * Usage:
 *   GET /api/score/health/stats          → all windows
 *   GET /api/score/health/stats?window=1h → just 1h
 *
 * No auth — server-side observability endpoint. If we want to lock it
 * down later, gate on a header secret (same shape as /api/score-internal).
 *
 * Read-only; safe to call freely. No rate limit because each call hits
 * three indexed queries against a small append-only table.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

type WindowKey = "1h" | "24h" | "7d";

const WINDOWS: Record<WindowKey, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

type WindowStats = {
  window: WindowKey;
  count: number;
  /** Phase 15 P-6 — TRUE when this window's numbers are the safeDb
   *  fallback (DB unreachable), NOT a genuinely quiet healthy window.
   *  Without this, "the observability layer is down" rendered as
   *  count:0 / all-zero failure rates = "all healthy". */
  degraded?: boolean;
  // Server-wall-clock latency including auth + rate-limit + DB writes.
  totalLatencyMs: { p50: number | null; p95: number | null; p99: number | null };
  // LLM-only latency from the wrapper.
  modelLatencyMs: { p50: number | null; p95: number | null; p99: number | null };
  // Token + size aggregates.
  avgPromptSizeBytes: number | null;
  cacheHitRate: number; // 0-1, share of rows where cache_read_tokens > 0
  // Failure rates.
  mockFallbackRate: number; // 0-1
  openaiFallbackRate: number; // 0-1
  // Full distribution.
  failureReasonCounts: Record<string, number>;
};

async function statsForWindow(windowKey: WindowKey): Promise<WindowStats> {
  const since = new Date(Date.now() - WINDOWS[windowKey]);

  return safeDb<WindowStats>(
    async () => {
      // Single round-trip — one aggregate query plus a separate
      // group-by for failure_reason distribution. Postgres
      // percentile_disc is the standard for true percentile
      // computation here.
      const aggRows = await db
        .select({
          count: sql<number>`count(*)::int`,
          p50Total: sql<number | null>`percentile_disc(0.50) within group (order by ${scoringTelemetry.totalServerDurationMs})::int`,
          p95Total: sql<number | null>`percentile_disc(0.95) within group (order by ${scoringTelemetry.totalServerDurationMs})::int`,
          p99Total: sql<number | null>`percentile_disc(0.99) within group (order by ${scoringTelemetry.totalServerDurationMs})::int`,
          p50Model: sql<number | null>`percentile_disc(0.50) within group (order by ${scoringTelemetry.modelDurationMs})::int`,
          p95Model: sql<number | null>`percentile_disc(0.95) within group (order by ${scoringTelemetry.modelDurationMs})::int`,
          p99Model: sql<number | null>`percentile_disc(0.99) within group (order by ${scoringTelemetry.modelDurationMs})::int`,
          avgPromptBytes: sql<number | null>`avg(${scoringTelemetry.promptSizeBytes})::int`,
          cacheHits: sql<number>`count(*) filter (where ${scoringTelemetry.cacheReadTokens} > 0)::int`,
          mockFallbacks: sql<number>`count(*) filter (where ${scoringTelemetry.failureReason} = 'mock_fallback_both_failed')::int`,
          openaiFallbacks: sql<number>`count(*) filter (where ${scoringTelemetry.failureReason} = 'openai_fallback_used')::int`,
        })
        .from(scoringTelemetry)
        .where(gte(scoringTelemetry.createdAt, since));

      const distRows = await db
        .select({
          reason: scoringTelemetry.failureReason,
          count: sql<number>`count(*)::int`,
        })
        .from(scoringTelemetry)
        .where(gte(scoringTelemetry.createdAt, since))
        .groupBy(scoringTelemetry.failureReason);

      const agg = aggRows[0] ?? {
        count: 0,
        p50Total: null,
        p95Total: null,
        p99Total: null,
        p50Model: null,
        p95Model: null,
        p99Model: null,
        avgPromptBytes: null,
        cacheHits: 0,
        mockFallbacks: 0,
        openaiFallbacks: 0,
      };

      const count = agg.count ?? 0;
      const denom = count === 0 ? 1 : count; // avoid /0; rates show 0 when no data

      const failureReasonCounts: Record<string, number> = {};
      for (const r of distRows) {
        failureReasonCounts[r.reason] = r.count;
      }

      return {
        window: windowKey,
        count,
        totalLatencyMs: {
          p50: agg.p50Total,
          p95: agg.p95Total,
          p99: agg.p99Total,
        },
        modelLatencyMs: {
          p50: agg.p50Model,
          p95: agg.p95Model,
          p99: agg.p99Model,
        },
        avgPromptSizeBytes: agg.avgPromptBytes,
        cacheHitRate: agg.cacheHits / denom,
        mockFallbackRate: agg.mockFallbacks / denom,
        openaiFallbackRate: agg.openaiFallbacks / denom,
        failureReasonCounts,
      };
    },
    {
      window: windowKey,
      count: 0,
      degraded: true,
      totalLatencyMs: { p50: null, p95: null, p99: null },
      modelLatencyMs: { p50: null, p95: null, p99: null },
      avgPromptSizeBytes: null,
      cacheHitRate: 0,
      mockFallbackRate: 0,
      openaiFallbackRate: 0,
      failureReasonCounts: {},
    },
  );
}

export async function GET(req: Request) {
  // Operator-gated: this endpoint exposes pipeline failure rates +
  // latency percentiles + mock-fallback rates. Public access would leak
  // operational signal to competitors and tell attackers in real time
  // which scoring path is broken.
  const caller = await currentUser();
  if (!caller) {
    return NextResponse.json(
      { error: "auth_required" },
      { status: 401 },
    );
  }
  const callerRow = await db.query.users.findFirst({
    where: eq(users.id, caller.id),
  });
  if (!callerRow?.isOperator) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const windowParam = url.searchParams.get("window");
  if (windowParam && !(windowParam in WINDOWS)) {
    return NextResponse.json(
      { error: "invalid_window", message: "window must be 1h | 24h | 7d" },
      { status: 400 },
    );
  }

  const windows: WindowKey[] = windowParam
    ? [windowParam as WindowKey]
    : ["1h", "24h", "7d"];

  const results = await Promise.all(windows.map((w) => statsForWindow(w)));

  return NextResponse.json({
    capturedAt: new Date().toISOString(),
    windows: results,
  });
}

// Silence unused-import warnings — `and` is exported for future filter
// expansion (e.g. group-by source endpoint).
void and;
