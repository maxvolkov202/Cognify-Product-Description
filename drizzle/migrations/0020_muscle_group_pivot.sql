-- 0020_muscle_group_pivot.sql
-- Phase 1 of the muscle-group adventure-path pivot
-- (see plans/muscle-group-pivot-progress.md).
--
-- Five new cognify_v2 tables backing the daily-muscle-group product:
--   exercises             — catalog of named drills per dimension
--   exercise_prompts      — ~20-prompt bank per exercise
--   muscle_group_days     — one row per (user, calendar day)
--   workout_sessions      — live runtime traversal of a muscle-group day
--   exercise_engagement   — per-(exercise, user) aggregates feeding rotation
--
-- Plus 4 nullable cols on cognify_v2.reps so future reps can be tagged
-- with the exercise + day they belong to. Historical reps stay NULL.
--
-- The migration is idempotent: every CREATE uses IF NOT EXISTS, every
-- ALTER TABLE ADD COLUMN uses IF NOT EXISTS, and the trailing FK on
-- workout_sessions.graduation_rep_id is added via a DO block that no-ops
-- if the constraint already exists. Re-running the file is a no-op.

CREATE TABLE IF NOT EXISTS "cognify_v2"."exercises" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "dimension" "cognify_v2"."dimension" NOT NULL,
  "description" text NOT NULL,
  "instructions" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "exercises_dimension_name_uniq" UNIQUE ("dimension", "name")
);
CREATE INDEX IF NOT EXISTS "exercises_dim_active_idx"
  ON "cognify_v2"."exercises" ("dimension", "is_active");

CREATE TABLE IF NOT EXISTS "cognify_v2"."exercise_prompts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exercise_id" uuid NOT NULL
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE CASCADE,
  "prompt_text" text NOT NULL,
  "prompt_id" text NOT NULL UNIQUE,
  "difficulty" integer NOT NULL DEFAULT 2,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "exercise_prompts_exercise_active_idx"
  ON "cognify_v2"."exercise_prompts" ("exercise_id", "is_active");

CREATE TABLE IF NOT EXISTS "cognify_v2"."muscle_group_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL
    REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "day_date" date NOT NULL,
  "dimension" "cognify_v2"."dimension" NOT NULL,
  "planned_exercise_ids" jsonb NOT NULL,
  "completed_reps" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'planned',
  "composite_at_close" real,
  "previous_day_id" uuid
    REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE SET NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mgd_user_date_uniq_idx"
  ON "cognify_v2"."muscle_group_days" ("user_id", "day_date");
CREATE INDEX IF NOT EXISTS "mgd_user_dim_date_idx"
  ON "cognify_v2"."muscle_group_days" ("user_id", "dimension", "day_date");

CREATE TABLE IF NOT EXISTS "cognify_v2"."workout_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "muscle_group_day_id" uuid NOT NULL
    REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE CASCADE,
  "practice_session_id" uuid NOT NULL
    REFERENCES "cognify_v2"."practice_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL
    REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "current_station_index" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'idle',
  "paused_at" timestamptz,
  "resumed_at" timestamptz,
  "graduation_rep_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "workout_sessions_mgd_idx"
  ON "cognify_v2"."workout_sessions" ("muscle_group_day_id");
CREATE INDEX IF NOT EXISTS "workout_sessions_user_idx"
  ON "cognify_v2"."workout_sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "cognify_v2"."exercise_engagement" (
  "exercise_id" uuid NOT NULL
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL
    REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "shown_count" integer NOT NULL DEFAULT 0,
  "completed_count" integer NOT NULL DEFAULT 0,
  "avg_composite" real,
  "recent_composite" real,
  "last_trained_at" timestamptz,
  "last_event_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("exercise_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "exercise_engagement_user_idx"
  ON "cognify_v2"."exercise_engagement" ("user_id");

ALTER TABLE "cognify_v2"."reps"
  ADD COLUMN IF NOT EXISTS "exercise_id" uuid
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "muscle_group_day_id" uuid
    REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "is_graduation_rep" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "score_failure_flag" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "reps_exercise_idx"
  ON "cognify_v2"."reps" ("exercise_id");
CREATE INDEX IF NOT EXISTS "reps_mgd_idx"
  ON "cognify_v2"."reps" ("muscle_group_day_id");

-- Trailing FK closes the workout_sessions ↔ reps cycle. Wrapped in a
-- DO block so re-runs don't fail with "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workout_sessions_grad_rep_fk'
  ) THEN
    ALTER TABLE "cognify_v2"."workout_sessions"
      ADD CONSTRAINT "workout_sessions_grad_rep_fk"
      FOREIGN KEY ("graduation_rep_id")
      REFERENCES "cognify_v2"."reps"("id") ON DELETE SET NULL;
  END IF;
END $$;
