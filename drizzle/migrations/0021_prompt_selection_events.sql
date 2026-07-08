-- 0021_prompt_selection_events.sql
-- Phase 6 of the muscle-group adventure-path pivot.
--
-- Records one row per "user selected a prompt for a workout rep" event.
-- Powers ops dashboards (mode mix, ms_to_select, reshuffle rate per
-- exercise) and the alert when auto_idle > 20% (picker too heavy).
--
-- workout_session_id FKs to the active workout session. We require it
-- non-null because the picker only fires inside a workout context;
-- Skill-Lab prompt picks live in a different table (the Phase 11
-- session-runner extraction reuses primitives but not telemetry).
--
-- Idempotent: re-running the file is a no-op.

CREATE TABLE IF NOT EXISTS "cognify_v2"."prompt_selection_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL
    REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "workout_session_id" uuid NOT NULL
    REFERENCES "cognify_v2"."workout_sessions"("id") ON DELETE CASCADE,
  "exercise_id" uuid NOT NULL
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE CASCADE,
  "prompt_id" uuid
    REFERENCES "cognify_v2"."exercise_prompts"("id") ON DELETE SET NULL,
  "mode" text NOT NULL
    CHECK (mode IN ('shuffle','list','surprise','auto_idle')),
  "reshuffles" smallint NOT NULL DEFAULT 0,
  "ms_to_select" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "prompt_selection_events_user_created_idx"
  ON "cognify_v2"."prompt_selection_events" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "prompt_selection_events_exercise_idx"
  ON "cognify_v2"."prompt_selection_events" ("exercise_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "prompt_selection_events_mode_idx"
  ON "cognify_v2"."prompt_selection_events" ("mode", "created_at" DESC);
