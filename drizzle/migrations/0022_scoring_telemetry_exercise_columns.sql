-- 0022_scoring_telemetry_exercise_columns.sql
-- Phase 8 of the muscle-group adventure-path pivot.
--
-- Extend cognify_v2.scoring_telemetry with the per-rep exercise +
-- muscle-group-day context so ops dashboards can slice scoring
-- behavior per exercise (which exercise drifts most? which has the
-- worst validation_failed rate? which graduation reps p95 the worst?).
--
-- All three columns are nullable / default-false so existing Skill Lab
-- + scenario-mode telemetry rows continue to write unchanged.

ALTER TABLE "cognify_v2"."scoring_telemetry"
  ADD COLUMN IF NOT EXISTS "exercise_id" uuid
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "muscle_group_day_id" uuid
    REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "is_graduation_rep" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "scoring_telemetry_exercise_idx"
  ON "cognify_v2"."scoring_telemetry" ("exercise_id", "created_at");

CREATE INDEX IF NOT EXISTS "scoring_telemetry_mgd_idx"
  ON "cognify_v2"."scoring_telemetry" ("muscle_group_day_id", "created_at");
