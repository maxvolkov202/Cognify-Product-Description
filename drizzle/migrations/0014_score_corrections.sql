-- 0014_score_corrections.sql
-- DNA Ch.C2 — operator review queue persistence.
--
-- One row per operator review of a flagged rep. The /ops/review-queue
-- page lists `reps` rows where composite_score >= 95 and there is no
-- existing row in score_corrections — so reviewing a rep removes it
-- from the queue without mutating the rep itself. Operator corrections
-- feed Ch.C3's reference-bank promotion script.
--
-- Verdict semantics:
--   confirmed_accurate → operator agrees with the LLM's score
--   should_be_lower    → operator disagrees, suggests lower composite
--   should_be_higher   → operator disagrees, suggests higher composite
--   skipped            → not enough context; rep stays in queue but
--                        with a note (re-queued after 7 days)
--
-- Idempotent — safe to re-apply via `node scripts/apply-migration.mjs`.

CREATE TABLE IF NOT EXISTS "cognify_v2"."score_corrections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rep_id" uuid NOT NULL
    REFERENCES "cognify_v2"."reps"("id") ON DELETE CASCADE,
  "reviewer_user_id" uuid NOT NULL
    REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "reviewed_at" timestamptz NOT NULL DEFAULT now(),
  "verdict" text NOT NULL
    CHECK ("verdict" IN (
      'confirmed_accurate',
      'should_be_lower',
      'should_be_higher',
      'skipped'
    )),
  -- Optional: operator-suggested composite when verdict is should_be_*.
  "corrected_composite" integer
    CHECK (
      "corrected_composite" IS NULL
      OR ("corrected_composite" >= 0 AND "corrected_composite" <= 100)
    ),
  -- Optional: per-dim corrected scores (jsonb shape: { clarity: 75, ... }).
  "corrected_per_dim" jsonb,
  -- Free-form notes (≤500 chars expected; not enforced at SQL).
  "notes" text
);

-- One review per rep per reviewer. If an operator wants to update
-- their verdict, they can DELETE+INSERT or update via the UI's
-- re-review path.
CREATE UNIQUE INDEX IF NOT EXISTS
  "score_corrections_rep_reviewer_uniq"
  ON "cognify_v2"."score_corrections" ("rep_id", "reviewer_user_id");

-- Lets the queue page check "is this rep already reviewed?" with a
-- single index seek instead of a sequential scan.
CREATE INDEX IF NOT EXISTS "score_corrections_rep_idx"
  ON "cognify_v2"."score_corrections" ("rep_id");

CREATE INDEX IF NOT EXISTS "score_corrections_reviewed_at_idx"
  ON "cognify_v2"."score_corrections" ("reviewed_at" DESC);
