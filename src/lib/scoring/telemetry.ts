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
import { eq, and, isNull } from "drizzle-orm";
import { isProviderCreditsError } from "@/lib/ai/provider-errors";
import type { ScoreRepMetrics } from "@/lib/ai/score";

export type FailureReason =
  | "none"
  | "timeout"
  | "rate_limit_429"
  | "validation_failed"
  | "truncated"
  | "openai_fallback_used"
  | "anthropic_fallback_used"
  | "mock_fallback_both_failed"
  | "network_error"
  /** Grading audit WS1 — primary provider rejected the call for credits /
   *  quota (OpenAI "You have no credits remaining", Anthropic credit
   *  balance). Distinct from rate_limit_429 because it does not clear on
   *  its own and needs a human. */
  | "provider_credits"
  | "unknown";

/**
 * Resolve the success-path failureReason. On the happy path returns
 * "none". When fallback fired, returns the provider-specific tag so the
 * dashboard can show "anthropic primary, openai served" vs "openai
 * primary, anthropic served" distinctly.
 *
 * Detection keys on the model_used tag set by `claude.ts` translateFromOpenAI
 * + callAnthropicOnce:
 *   - "openai-fallback:..."    → openai_fallback_used
 *   - "anthropic-fallback:..." → anthropic_fallback_used
 *   - anything else with fallbackFired=true → openai_fallback_used
 *     (back-compat default; the legacy tag was always openai-fallback)
 */
export function resolveFallbackReason(metrics: {
  fallbackFired: boolean;
  modelUsed: string;
}): FailureReason {
  if (!metrics.fallbackFired) return "none";
  if (metrics.modelUsed.startsWith("anthropic-fallback:")) {
    return "anthropic_fallback_used";
  }
  return "openai_fallback_used";
}

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
  // Credits/quota first: the both-providers-failed wrapper embeds the
  // primary's "no credits remaining" text and takes the FALLBACK's
  // AbortError name when the fallback timed out (the 08-24 shape), so
  // checking timeout first would file a credits outage under "timeout".
  // Also ahead of the generic 429 bucket: OpenAI reports it with 429.
  if (isProviderCreditsError(err)) return "provider_credits";
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

/** Grading audit WS1 (§4.8) — short rep = under 15 s of recording. Single
 *  definition for both scoring routes so `short_rep` means one thing. */
export const SHORT_REP_MS = 15_000;
export function isShortRep(durationMs: number): boolean {
  return durationMs < SHORT_REP_MS;
}

export type WriteTelemetryInput = {
  /** Grading audit WS1 — pre-generated row id. The sync path (/api/score)
   *  does not know the rep id at scoring time, so it mints the telemetry
   *  id, returns it on the score, and saveRep fills `rep_id` in via
   *  `attachTelemetryToRep`. Omit to let the DB default one. */
  id?: string;
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
  /** Phase 8 — muscle-group exercise the rep belongs to. NULL for
   *  legacy Skill Lab / scenario reps. */
  exerciseId?: string | null;
  /** Phase 8 — muscle-group day the rep belongs to. */
  muscleGroupDayId?: string | null;
  /** Phase 8 — pressure graduation rep flag. */
  isGraduationRep?: boolean;
  /** Grading Engine V2 — A/B scoring arm. Explicit value wins; otherwise
   *  read from metrics.scoringArm (stamped by the scoreRepWithMetrics
   *  dispatcher). NULL/undefined = control. */
  arm?: string | null;
  /** Grading audit WS1 — `duration_ms < 15000` at scoring time. */
  shortRep?: boolean | null;
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
      // Phase 4 — populated by scoreRepWithMetrics; null on mock-fallback
      // path where scoring never ran.
      ragDurationMs: input.metrics?.ragDurationMs ?? null,
      failureReason: input.failureReason,
      errorDetail,
      compositeScore: input.compositeScore ?? null,
      // Phase 8 — muscle-group context. Nullable / default-false on
      // existing rows; callers pass undefined for non-workout reps and
      // the columns stay NULL / false.
      exerciseId: input.exerciseId ?? null,
      muscleGroupDayId: input.muscleGroupDayId ?? null,
      isGraduationRep: input.isGraduationRep ?? false,
      // Grading Engine V2 — explicit arm wins, else the arm the dispatcher
      // stamped onto metrics. NULL on the mock-fallback path (no real arm).
      arm: input.arm ?? input.metrics?.scoringArm ?? null,
      // Grading audit WS1 — evidence + latency breakdown (0047). NULL
      // on the mock path (metrics absent) except short_rep, which the
      // route computes from the body.
      ...(input.id ? { id: input.id } : {}),
      gradedFromAudio: input.metrics?.gradedFromAudio ?? null,
      ragChunkIds: input.metrics?.ragChunkIds ?? null,
      ragChunkCount: input.metrics ? input.metrics.ragChunkCount : null,
      prosodyMs: input.metrics?.prosodyMs ?? null,
      shortRep: input.shortRep ?? null,
    });
    return true;
  }, false);
}

export type ClientScoringTimings = {
  /** /api/transcribe round-trip as seen by the client. */
  deepgramMs?: number | null;
  /** /api/upload round-trip as seen by the client. */
  uploadMs?: number | null;
  /** stop-recording → score visible, client wall clock. */
  clientE2eMs?: number | null;
};

/**
 * Grading audit WS1 — join a sync-path telemetry row to the rep it scored.
 * Called from saveRep AFTER the rep row exists. Owner-scoped: the update
 * only touches a row whose user_id matches (or a guest row with NULL
 * user_id) and whose rep_id is still unset, so a forged id from the
 * client cannot re-point another user's telemetry. Best-effort — never
 * throws, never blocks the rep save.
 */
export async function attachTelemetryToRep(input: {
  telemetryId: string;
  repId: string;
  userId: string | null;
  timings?: ClientScoringTimings | null;
}): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(input.telemetryId)) return false;
  const clamp = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.min(Math.round(v), 10 * 60 * 1000)
      : null;
  return safeDb(async () => {
    const owner = input.userId
      ? eq(scoringTelemetry.userId, input.userId)
      : isNull(scoringTelemetry.userId);
    const updated = await db
      .update(scoringTelemetry)
      .set({
        repId: input.repId,
        deepgramMs: clamp(input.timings?.deepgramMs),
        uploadMs: clamp(input.timings?.uploadMs),
        clientE2eMs: clamp(input.timings?.clientE2eMs),
      })
      .where(
        and(
          eq(scoringTelemetry.id, input.telemetryId),
          owner,
          isNull(scoringTelemetry.repId),
        ),
      )
      .returning({ id: scoringTelemetry.id });
    return updated.length > 0;
  }, false);
}
