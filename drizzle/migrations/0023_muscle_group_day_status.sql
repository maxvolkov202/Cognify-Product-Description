-- 0023_muscle_group_day_status.sql
-- Phase 10 of the muscle-group adventure-path pivot.
--
-- Adds the day-status lifecycle columns + the user_notifications table
-- that feeds the missed-day modal and the freeze-consumed toast.
-- Also adds a tz column to cognify_v2.users so the rollover cron can
-- close out days at user-local midnight instead of UTC.
--
-- All adds are nullable / default-safe so existing rows are unaffected.

ALTER TABLE "cognify_v2"."muscle_group_days"
  ADD COLUMN IF NOT EXISTS "graduated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "closed_out_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "freeze_applied_date" date;

ALTER TABLE "cognify_v2"."users"
  ADD COLUMN IF NOT EXISTS "tz" text NOT NULL DEFAULT 'UTC';

CREATE TABLE IF NOT EXISTS "cognify_v2"."user_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL
    REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  /** 'freeze_consumed' | 'day_missed' | 'day_complete' | 'day_partial' */
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_notifications_user_idx"
  ON "cognify_v2"."user_notifications" ("user_id", "read_at", "created_at" DESC);
