-- PRD v3 Phase 1 — Universal Training Engine: rep attempt lineage +
-- coaching-history ledger. (plans/prd/phase1-engine-design.md)
--
-- The engine loop makes every exercise a First Rep + required Retry
-- (+ optional "again" attempts). `attempt_kind` distinguishes them;
-- `parent_rep_id` links a retry back to the First Rep it improves on;
-- `coach_focus` freezes the single Coach's Focus the rep received so the
-- retry evaluation and Phase 3 coaching memory don't re-parse feedback
-- jsonb.
--
-- All statements are idempotent (IF NOT EXISTS / guarded DO blocks) per
-- repo convention — migrations are applied by scripts/apply-migration.mjs
-- without a journal table, so re-running must be a no-op.

ALTER TABLE cognify_v2.reps
  ADD COLUMN IF NOT EXISTS attempt_kind TEXT NOT NULL DEFAULT 'first';

COMMENT ON COLUMN cognify_v2.reps.attempt_kind IS
  'first | retry | again — position of this rep in the exercise learning loop. Default first keeps historical rows valid.';

ALTER TABLE cognify_v2.reps
  ADD COLUMN IF NOT EXISTS parent_rep_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reps_parent_rep_id_fkey'
  ) THEN
    ALTER TABLE cognify_v2.reps
      ADD CONSTRAINT reps_parent_rep_id_fkey
      FOREIGN KEY (parent_rep_id) REFERENCES cognify_v2.reps(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN cognify_v2.reps.parent_rep_id IS
  'For retry/again attempts: the First Rep this attempt improves on. SET NULL so purging a first rep keeps the retry row.';

ALTER TABLE cognify_v2.reps
  ADD COLUMN IF NOT EXISTS coach_focus JSONB;

COMMENT ON COLUMN cognify_v2.reps.coach_focus IS
  'Coach''s Focus this rep received: { dimension, subSkill?, text }. Written post-scoring.';

CREATE INDEX IF NOT EXISTS reps_parent_rep_idx
  ON cognify_v2.reps (parent_rep_id);

-- Coaching-history ledger (seed of PRD §8.3.9). One row per delivered
-- Coach's Focus; the retry evaluation back-fills implemented_verdict.
CREATE TABLE IF NOT EXISTS cognify_v2.coaching_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES cognify_v2.reps(id) ON DELETE CASCADE,
  dimension cognify_v2.dimension NOT NULL,
  sub_skill TEXT,
  focus_text TEXT NOT NULL,
  implemented_verdict TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cognify_v2.coaching_events IS
  'Coaching History ledger: what was coached (dimension + Hidden Skill + focus text) and whether the retry implemented it (nailed | partial | missed | NULL).';

CREATE INDEX IF NOT EXISTS coaching_events_user_created_idx
  ON cognify_v2.coaching_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS coaching_events_rep_idx
  ON cognify_v2.coaching_events (rep_id);
