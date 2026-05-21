-- 0017_reference_reps.sql
-- Phase 6 — few-shot exemplar bank for two-stage scoring's Stage 2.
--
-- Stores calibrated transcripts with known-good scores so retrieve-
-- SimilarReps can inject the 2 nearest reps as exemplars in the copy-
-- generation prompt. The model sees what good feedback looks like on
-- a transcript similar in shape to the new rep.
--
-- Primary seed: scripts/calibration/reference-reps.json (48 hand-
-- curated entries). Secondary seed (future): operator-confirmed reps
-- promoted via /ops/review-queue.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS "cognify_v2"."reference_reps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for hand-crafted seed entries; populated when promoted from
  -- a real production rep.
  "source_rep_id" uuid,
  -- Stable identifier: seed file id ("band-strong-clean-pitch") OR
  -- generated slug for promoted reps. UNIQUE for upsert idempotency.
  "ref_id" text NOT NULL UNIQUE,
  "transcript" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "prompt_text" text NOT NULL,
  -- { composite, dimensions: { clarity, ... }, band?, kind? }
  "known_scores" jsonb NOT NULL,
  -- Optional canonical feedback shape, when available
  "known_feedback" jsonb,
  -- { kind, domain?, framework_id?, archetype?, band, dim_profile }
  "tags" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 1536-dim embedding from text-embedding-3-small (same model as
  -- knowledge_chunks for consistency).
  "embedding" vector(1536) NOT NULL,
  "promoted_at" timestamptz NOT NULL DEFAULT now(),
  "promoted_by" uuid,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "reference_reps_ref_idx"
  ON "cognify_v2"."reference_reps" ("ref_id");

-- HNSW index for fast top-K cosine similarity. Same parameters as
-- knowledge_chunks; revisit if the bank scales past ~10K rows.
CREATE INDEX IF NOT EXISTS "reference_reps_embedding_hnsw_idx"
  ON "cognify_v2"."reference_reps"
  USING hnsw ("embedding" vector_cosine_ops);

-- Filter by band / domain for retrieval coverage rules.
CREATE INDEX IF NOT EXISTS "reference_reps_band_idx"
  ON "cognify_v2"."reference_reps" ((tags->>'band'));

CREATE INDEX IF NOT EXISTS "reference_reps_kind_idx"
  ON "cognify_v2"."reference_reps" ((tags->>'kind'));
