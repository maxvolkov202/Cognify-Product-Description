-- DB hygiene migration. Findings from full-app audit 2026-05-24 (§DB).
--
-- Buckets:
--   1. Add missing FKs so user-delete + rep-delete cascades work.
--   2. Add missing indexes; drop one redundant.
--   3. Convert four stable JSONB array columns to native postgres arrays.
--
-- Email citext migration (audit PR-20) is INTENTIONALLY DEFERRED — it
-- touches Supabase auth.users joins and needs a preview deploy + manual
-- verification first. Tracked separately.

BEGIN;

-- ─── 1. FKs ───────────────────────────────────────────────────────────────

-- league_membership.user_id was declared on the column but never an FK in
-- migrations. Same for daily_quests.user_id. Without ON DELETE CASCADE,
-- deleting a user leaves orphaned rows.
ALTER TABLE cognify_v2.league_membership
  ADD CONSTRAINT league_membership_user_id_fk
  FOREIGN KEY (user_id) REFERENCES cognify_v2.users(id) ON DELETE CASCADE;

ALTER TABLE cognify_v2.daily_quests
  ADD CONSTRAINT daily_quests_user_id_fk
  FOREIGN KEY (user_id) REFERENCES cognify_v2.users(id) ON DELETE CASCADE;

-- scoring_telemetry FKs — migration 0022 added FKs on the newer columns
-- (exercise_id, muscle_group_day_id) but left user_id + rep_id un-FK'd.
ALTER TABLE cognify_v2.scoring_telemetry
  ADD CONSTRAINT scoring_telemetry_user_id_fk
  FOREIGN KEY (user_id) REFERENCES cognify_v2.users(id) ON DELETE SET NULL;

ALTER TABLE cognify_v2.scoring_telemetry
  ADD CONSTRAINT scoring_telemetry_rep_id_fk
  FOREIGN KEY (rep_id) REFERENCES cognify_v2.reps(id) ON DELETE SET NULL;

-- personal_bests.rep_id — cascade so deleting a rep removes the PB.
ALTER TABLE cognify_v2.personal_bests
  ADD CONSTRAINT personal_bests_rep_id_fk
  FOREIGN KEY (rep_id) REFERENCES cognify_v2.reps(id) ON DELETE CASCADE;

-- reference_reps.source_rep_id — set null on rep delete; keep the
-- reference row (it may have hand-edited gold-standard feedback).
ALTER TABLE cognify_v2.reference_reps
  ADD CONSTRAINT reference_reps_source_rep_id_fk
  FOREIGN KEY (source_rep_id) REFERENCES cognify_v2.reps(id) ON DELETE SET NULL;

-- users.baseline_rep_id — set null if their baseline rep is deleted;
-- dashboard handles a null baseline cleanly.
ALTER TABLE cognify_v2.users
  ADD CONSTRAINT users_baseline_rep_id_fk
  FOREIGN KEY (baseline_rep_id) REFERENCES cognify_v2.reps(id) ON DELETE SET NULL;

-- ─── 2. Indexes ──────────────────────────────────────────────────────────

-- scoring_telemetry per-rep ops drilldown was seq-scanning. Partial index
-- so the bloat from many-null rep_id rows stays small.
CREATE INDEX IF NOT EXISTS scoring_telemetry_rep_idx
  ON cognify_v2.scoring_telemetry (rep_id)
  WHERE rep_id IS NOT NULL;

-- exercise_prompts ops scans filter by (dimension, is_active, difficulty).
-- The existing (exercise_id, is_active) doesn't help that path.
CREATE INDEX IF NOT EXISTS exercise_prompts_dim_active_diff_idx
  ON cognify_v2.exercise_prompts (exercise_id, is_active, difficulty);

-- reference_reps.source_rep_id needs an index for the new FK + reverse
-- lookups (find ref-rep promoted from a given rep).
CREATE INDEX IF NOT EXISTS reference_reps_source_rep_idx
  ON cognify_v2.reference_reps (source_rep_id)
  WHERE source_rep_id IS NOT NULL;

-- user_prompt_history_user_idx duplicates the PK leading column. Drop.
DROP INDEX IF EXISTS cognify_v2.user_prompt_history_user_idx;

-- ─── 3. JSONB → native array conversions ─────────────────────────────────

-- muscle_group_days.planned_exercise_ids: jsonb → uuid[].
-- Cast via the SQL/JSON path operator. The existing rows are all JSON
-- arrays of UUID strings; bug rows would already have failed reads.
ALTER TABLE cognify_v2.muscle_group_days
  ALTER COLUMN planned_exercise_ids TYPE uuid[]
  USING (
    SELECT array_agg(elem::uuid)
    FROM jsonb_array_elements_text(planned_exercise_ids) elem
  );

-- bug_reports.image_paths: jsonb → text[]. Same pattern.
ALTER TABLE cognify_v2.bug_reports
  ALTER COLUMN image_paths TYPE text[]
  USING (
    SELECT array_agg(elem)
    FROM jsonb_array_elements_text(image_paths) elem
  );
-- Default must be re-asserted after the type change.
ALTER TABLE cognify_v2.bug_reports
  ALTER COLUMN image_paths SET DEFAULT '{}';

-- external_validations.rep_ids: jsonb → uuid[].
ALTER TABLE cognify_v2.external_validations
  ALTER COLUMN rep_ids TYPE uuid[]
  USING (
    SELECT array_agg(elem::uuid)
    FROM jsonb_array_elements_text(rep_ids) elem
  );

-- external_rankings.ranking: jsonb → text[]. Note this stores UUIDs as
-- text but text[] keeps the column type-agnostic for future shape change.
ALTER TABLE cognify_v2.external_rankings
  ALTER COLUMN ranking TYPE text[]
  USING (
    SELECT array_agg(elem)
    FROM jsonb_array_elements_text(ranking) elem
  );

COMMIT;
