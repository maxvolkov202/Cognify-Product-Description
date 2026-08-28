-- 0047_grading_instrumentation.sql
-- Grading audit 2026-08-26, workstream 1 (plans/grading-audit-2026-08-26.md §3.1).
--
-- Append-only. Every later grading change is measured on reps scored after
-- this lands, so the sync path must be able to join scoring_telemetry to the
-- rep it produced, and the evidence the grader used (word timings, prosody
-- features, RAG chunks) must be persisted instead of discarded.
--
-- All columns nullable / defaulted so existing rows and the mock-fallback
-- path stay valid.

ALTER TABLE "cognify_v2"."scoring_telemetry"
  ADD COLUMN IF NOT EXISTS "graded_from_audio" boolean,
  ADD COLUMN IF NOT EXISTS "rag_chunk_ids" text[],
  ADD COLUMN IF NOT EXISTS "rag_chunk_count" integer,
  ADD COLUMN IF NOT EXISTS "deepgram_ms" integer,
  ADD COLUMN IF NOT EXISTS "upload_ms" integer,
  ADD COLUMN IF NOT EXISTS "prosody_ms" integer,
  ADD COLUMN IF NOT EXISTS "client_e2e_ms" integer,
  ADD COLUMN IF NOT EXISTS "short_rep" boolean;

COMMENT ON COLUMN "cognify_v2"."scoring_telemetry"."graded_from_audio" IS
  'True when worker prosody (pitch/RMS or Hume) grounded the Tone score; false = text tier. NULL on mock rows.';
COMMENT ON COLUMN "cognify_v2"."scoring_telemetry"."rag_chunk_ids" IS
  'knowledge_chunks ids injected into the scoring prompt, in injection order. Empty array = RAG on but nothing injected; NULL = RAG off/mock.';
COMMENT ON COLUMN "cognify_v2"."scoring_telemetry"."client_e2e_ms" IS
  'Client-measured stop-recording -> score-visible wall clock (sync path only; written by saveRep).';
COMMENT ON COLUMN "cognify_v2"."scoring_telemetry"."short_rep" IS
  'duration_ms < 15000 at scoring time. Lets us check whether short reps are systematically scored low.';

-- Sync-path rows are now joinable: /api/score pre-generates the row id,
-- returns it on the score, and saveRep fills rep_id in.
CREATE INDEX IF NOT EXISTS "scoring_telemetry_rep_id_idx"
  ON "cognify_v2"."scoring_telemetry" ("rep_id");

ALTER TABLE "cognify_v2"."reps"
  ADD COLUMN IF NOT EXISTS "prosody_features" jsonb;

COMMENT ON COLUMN "cognify_v2"."reps"."prosody_features" IS
  'ProsodyFeatures bundle the grader saw (inline word-timing metrics + worker pitch/RMS when present). NULL on legacy/mock reps.';
