-- 0016_pgvector_knowledge_chunks.sql
-- Phase 4 of the RAG + scoring overhaul — enables pgvector and creates
-- the knowledge_chunks store that powers per-rep retrieval of skill /
-- framework / domain anchors.
--
-- Why pgvector + Supabase: zero new infra. Supabase Postgres has
-- pgvector as a first-class extension; we get vector similarity in
-- the same DB that already holds our reps, callouts, and feedback
-- ratings. No vendor lock-in to a separate vector DB. Per Saraev's
-- "frameworks are inversely correlated with revenue" lesson — direct
-- pgvector + raw SQL cosine similarity, no LangChain.
--
-- Why text-embedding-3-small (1536 dims): 5x cheaper than 3-large with
-- comparable retrieval quality on short technical chunks (~$0.02/1M
-- input tokens). One-time bulk embed of all knowledge ~$0.001 total.
-- Per-rep transcript embedding: ~$0.000002. Cost is rounding-error.
--
-- HNSW index on embedding gives sub-millisecond top-K cosine similarity
-- on the table sizes we expect (~150 chunks, growing slowly).
-- vector_cosine_ops is the right operator family because our embeddings
-- are length-normalized (OpenAI returns unit vectors); cosine similarity
-- = dot product in that case.
--
-- Idempotent — safe to re-apply via `node scripts/apply-migration.mjs`.

-- ——— Enable pgvector extension ——————————————————————————————
-- Supabase ships pgvector preinstalled but not always enabled per
-- project. CREATE EXTENSION IF NOT EXISTS is the standard pattern.
CREATE EXTENSION IF NOT EXISTS vector;

-- ——— knowledge_chunks table ——————————————————————————————
-- One row per logical chunk of our knowledge corpus. Chunking strategy:
-- split *-full.md (and frameworks/*.md, domains/*.md as Phase 4 expands)
-- on H2 (## ) section boundaries; cap at ~800 tokens per chunk; tag with
-- (kind, topic, section) so retrieval can hard-filter for coverage of
-- specific dims.
--
-- content_hash: SHA-256 of the chunk text. The build script uses this
-- to skip re-embedding chunks that haven't changed since last run
-- (idempotency without expensive re-embeds).
CREATE TABLE IF NOT EXISTS "cognify_v2"."knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Filename relative to src/lib/ai/knowledge/, e.g.
  -- "skills-full/clarity-full.md" or "frameworks/bluf.md"
  "source_file" text NOT NULL,
  -- H2 section name within the source file ("HIGH clarity sounds like",
  -- "Common failure modes", etc.)
  "section" text NOT NULL,
  -- The raw chunk text. Capped to a sensible upper bound at insert time
  -- (~3000 chars / ~800 tokens) so a runaway chunk doesn't bloat the
  -- table; not enforced at SQL because chunk size is build-script
  -- discipline.
  "content" text NOT NULL,
  -- Approximate token count of `content`, computed at build time.
  -- Used by retrieval to budget total context size when re-ranking
  -- top-K for coverage.
  "token_count" integer NOT NULL,
  -- Tags jsonb shape: { kind: 'skill'|'framework'|'domain', topic: string, ... }
  -- e.g. { kind: 'skill', topic: 'clarity', section_slug: 'high-signals' }
  -- Used for hard-filtering during retrieval ("ensure ≥1 chunk per
  -- scored_dim").
  "tags" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 1536-dim embedding from text-embedding-3-small. Length-normalized
  -- by the API, so dot product = cosine similarity.
  "embedding" vector(1536) NOT NULL,
  -- SHA-256 of the chunk text. Build script uses this to skip
  -- re-embedding unchanged chunks across runs.
  "content_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- (source_file, section, content_hash) is the natural key for upsert
  -- — same file + same section + same content = idempotent re-embed
  -- skip. If content changes for the same section, a new row is
  -- inserted (and the old one becomes stale; cleanup is a separate
  -- maintenance task, low-priority because retrieval ranks by
  -- similarity).
  UNIQUE ("source_file", "section", "content_hash")
);

-- HNSW index for fast cosine similarity search. Parameters tuned for
-- our scale (~150 chunks): m=16 (default), ef_construction=64 (default).
-- These are fine for tables up to ~100K rows; revisit if we 10x the
-- corpus.
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx"
  ON "cognify_v2"."knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops);

-- B-tree on tags->>'kind' for the kind filter; tags->>'topic' for
-- coverage-guarantee re-ranking.
CREATE INDEX IF NOT EXISTS "knowledge_chunks_kind_idx"
  ON "cognify_v2"."knowledge_chunks" ((tags->>'kind'));

CREATE INDEX IF NOT EXISTS "knowledge_chunks_topic_idx"
  ON "cognify_v2"."knowledge_chunks" ((tags->>'topic'));
