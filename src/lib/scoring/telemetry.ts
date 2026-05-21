/**
 * Phase 0 — scoring_telemetry write helper + failure-reason classifier.
 *
 * Both /api/score and /api/score-internal call writeScoringTelemetry()
 * after the scoreRep call resolves (success OR fail), so every scoring
 * request is captured.
 *
 * The classifier is intentionally narrow — categories should be small
 * and meaningful so /api/score/health/stats can group-by failure_reason
 * without LIKE queries against error messages. Add new categories only
 * when an unknown-bucketed pattern shows up repeatedly in production.
 */

import { db } from "@/lib/db/client";
import { scoringTelemetry } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { ScoreRepMetrics } from "@/lib/ai/score";

export type FailureReason =
  | "none"
  | "timeout"
  | "rate_limit_429"
  | "validation_failed"
  | "truncated"
  | "openai_fallback_used"
  | "mock_fallback_both_failed"
  | "network_error"
  | "unknown";

/**
 * Categorize a thrown error into one of the FailureReason buckets so
 * the telemetry dashboard can group failures meaningfully. Pass the
 * raw caught value — handles Error / string / unknown shapes.
 *
 * Categorization priority (first-match-wins):
 *   1. Timeout signals (AbortError, "abort", "timed out") — added in Phase 1
 *   2. HTTP status 429 → rate_limit_429
 *   3. HTTP status 5xx OR network error fragments → network_error
 *   4. Zod or JSON parse failures → validation_failed
 *   5. "max_tokens" or "truncated" in message → truncated
 *   6. Everything else → unknown
 */
export function categorizeFailure(err: unknown): FailureReason {
  if (!err) return "unknown";
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  const status = (err as { status?: number }).status;

  // Phase 1 will add explicit AbortController-driven timeouts; categorize
  // here so the bucket already exists when those fire.
  if (name === "AbortError" || /\babort(ed)?\b/i.test(msg) || /timed out/i.test(msg)) {
    return "timeout";
  }
  if (status === 429 || /rate.?limit/i.test(msg)) return "rate_limit_429";
  if (typeof status === "number" && status >= 500) return "network_error";
  if (/ECONNREFUSED|ETIMEDOUT|fetch failed|EAI_AGAIN|ENOTFOUND/i.test(msg)) {
    return "network_error";
  }
  // ZodError detection — match by error name first (most reliable when the
  // error wasn't re-thrown), then fall through to message patterns that
  // catch ZodIssue arrays. The "invalid_type" / "received.*undefined"
  // patterns are Zod-issue-array signatures — these show up when the LLM
  // returns JSON missing required fields (common with non-Anthropic
  // providers that don't follow our schema strictly).
  if (
    name === "ZodError" ||
    /ZodError|invalid_input|invalid_json|was not valid JSON|exceeded.*size cap/i.test(msg) ||
    /"code":\s*"invalid_type"/i.test(msg) ||
    /"received":\s*"undefined"/i.test(msg) ||
    /"path":\s*\[\s*"(callouts|dimensions|didWell|didntLand|nextRepFocus)"/i.test(msg)
  ) {
    return "validation_failed";
  }
  if (/max_tokens|truncated|stop_reason.*max_tokens/i.test(msg)) {
    return "truncated";
  }
  return "unknown";
}

export type WriteTelemetryInput = {
  source: "api_score" | "api_score_internal" | string;
  repId?: string | null;
  userId?: string | null;
  /** When the scoring call succeeded, pass the merged metrics from
   *  scoreRepWithMetrics. */
  metrics?: ScoreRepMetrics | null;
  /** Wall-clock duration of the entire route-handler request (includes
   *  auth, rate-limit, DB writes, etc.). Captured at the route boundary. */
  totalServerDurationMs: number;
  failureReason: FailureReason;
  /** Server-only error detail. Trimmed to 500 chars at write time. Never
   *  user-facing. */
  errorDetail?: string | null;
  compositeScore?: number | null;
  /** Override the model_used column — used for the mock-fallback path
   *  where no LLM was actually called. Defaults to metrics.modelUsed
   *  when metrics is present, otherwise "mock-fallback-v1". */
  modelUsedOverride?: string;
};

/**
 * Fire-and-forget telemetry write. Wrapped in safeDb so a DB outage
 * never blocks the scoring response — telemetry is observability, not
 * critical path. Callers should `void writeScoringTelemetry(...)` (don't
 * await) so the response goes back to the user without waiting.
 */
export async function writeScoringTelemetry(
  input: WriteTelemetryInput,
): Promise<void> {
  const modelUsed =
    input.modelUsedOverride ??
    input.metrics?.modelUsed ??
    "mock-fallback-v1";

  // Phase 1 — on the fallback-succeeded path, the route handler doesn't
  // see what made Anthropic fail (the wrapper swallowed it). The metrics
  // object carries that underlying error so telemetry can show
  // "fallback fired because of <reason>" without grepping logs.
  // Explicit errorDetail input wins (catch-block context is richer),
  // metrics.underlyingAnthropicError is used as a fallback when explicit
  // is absent (happy-fallback path).
  const rawErrorDetail =
    input.errorDetail ?? input.metrics?.underlyingAnthropicError ?? null;
  const errorDetail = rawErrorDetail ? rawErrorDetail.slice(0, 500) : null;

  await safeDb(async () => {
    await db.insert(scoringTelemetry).values({
      repId: input.repId ?? null,
      userId: input.userId ?? null,
      source: input.source,
      modelUsed,
      promptSizeBytes: input.metrics?.promptSizeBytes ?? null,
      inputTokens: input.metrics?.inputTokens ?? null,
      outputTokens: input.metrics?.outputTokens ?? null,
      cacheReadTokens: input.metrics?.cacheReadTokens ?? null,
      cacheCreationTokens: input.metrics?.cacheCreationTokens ?? null,
      modelDurationMs: input.metrics?.modelDurationMs ?? null,
      validationDurationMs: input.metrics?.validationDurationMs ?? null,
      totalServerDurationMs: input.totalServerDurationMs,
      ragDurationMs: null, // Phase 4 will populate
      failureReason: input.failureReason,
      errorDetail,
      compositeScore: input.compositeScore ?? null,
    });
    return true;
  }, false);
}
