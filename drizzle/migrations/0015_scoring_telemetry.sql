-- 0015_scoring_telemetry.sql
-- Phase 0 of the RAG + scoring overhaul — per-request telemetry so we
-- can prove (or disprove) that each phase's latency / fallback / quality
-- changes actually moved the needle.
--
-- One row per scoring request, written by /api/score and
-- /api/score-internal regardless of outcome (success, fallback, mock).
-- Append-only; never UPDATEd. Old rows can be pruned by a weekly cron
-- once retention exceeds 90d if needed.
--
-- Drives /api/score/health/stats (p50/p95/p99 latency, fallback rate,
-- cache-hit rate, etc.).
--
-- Idempotent — safe to re-apply via `node scripts/apply-migration.mjs`.

CREATE TABLE IF NOT EXISTS "cognify_v2"."scoring_telemetry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable: /api/score (sync user-facing path) doesn't know repId at
  -- scoring time; /api/score-internal does. Both still write a row.
  "rep_id" uuid,
  "user_id" uuid,

  -- Which endpoint wrote this row. Free-text since the set is tiny and
  -- adding a CHECK would just complicate the inevitable future phases
  -- where two-stage scoring writes two-source rows ('api_score_stage1' /
  -- 'api_score_stage2').
  "source" text NOT NULL,

  -- Final model that actually returned content. Happy path:
  --   'claude-haiku-4-5-20251001'
  -- OpenAI-fallback path:
  --   'openai-fallback:gpt-4o'
  -- Full failure:
  --   'mock-fallback-v1'
  "model_used" text NOT NULL,

  -- Prompt size budget telemetry — the lever we're optimizing.
  "prompt_size_bytes" integer,
  "input_tokens" integer,
  "output_tokens" integer,
  "cache_read_tokens" integer,
  "cache_creation_tokens" integer,

  -- Timing breakdown — what's actually expensive.
  "model_duration_ms" integer,
  "validation_duration_ms" integer,
  "total_server_duration_ms" integer,

  -- Future-phase placeholders (kept nullable so schema is stable across
  -- phases — Phase 4 writes rag_duration_ms, Phase 5 may add more).
  "rag_duration_ms" integer,

  -- Categorized so we can group fallback rate by reason without LIKE
  -- queries against error messages. Values:
  --   none, timeout, rate_limit_429, validation_failed, truncated,
  --   openai_fallback_used, mock_fallback_both_failed, network_error,
  --   unknown
  "failure_reason" text NOT NULL,

  -- Server-only debug detail. Never user-facing. Trim to 500 chars at
  -- write time so verbose Anthropic errors don't bloat the table.
  "error_detail" text,

  -- Composite score that was returned. Null on mock-fallback paths that
  -- skip persistence.
  "composite_score" integer,

  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "scoring_telemetry_created_idx"
  ON "cognify_v2"."scoring_telemetry" ("created_at" DESC);

-- Lets the /stats endpoint group by failure_reason within a time window
-- without a sequential scan.
CREATE INDEX IF NOT EXISTS "scoring_telemetry_failure_idx"
  ON "cognify_v2"."scoring_telemetry" ("failure_reason", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "scoring_telemetry_model_idx"
  ON "cognify_v2"."scoring_telemetry" ("model_used");
