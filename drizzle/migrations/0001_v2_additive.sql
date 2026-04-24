-- Cognify v2 additive migration
-- Hand-written delta for WS-1 rename + WS-3 pressure archetypes + WS-6 session types
-- + personal_bests + weekly_reports. Idempotent (safe to re-run).
--
-- This migration only ADDS: new enum values, new columns (nullable or with defaults),
-- new tables, and new indexes. It does NOT drop or rename anything — legacy enum
-- values (relevance/confidence/pacing/tone) stay in place so historical rows in
-- dimension_scores / callouts still read back correctly.

-- ----- New enum values on "dimension" -----------------------------------
ALTER TYPE "cognify_v2"."dimension" ADD VALUE IF NOT EXISTS 'clarity';
ALTER TYPE "cognify_v2"."dimension" ADD VALUE IF NOT EXISTS 'structure';
ALTER TYPE "cognify_v2"."dimension" ADD VALUE IF NOT EXISTS 'conciseness';
ALTER TYPE "cognify_v2"."dimension" ADD VALUE IF NOT EXISTS 'thinking_quality';
ALTER TYPE "cognify_v2"."dimension" ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE "cognify_v2"."dimension" ADD VALUE IF NOT EXISTS 'adaptability';

-- ----- New enum: session_type (WS-6) ------------------------------------
DO $$ BEGIN
  CREATE TYPE "cognify_v2"."session_type" AS ENUM ('focus', 'combined', 'flow');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- New enum: pressure_archetype (WS-3) ------------------------------
DO $$ BEGIN
  CREATE TYPE "cognify_v2"."pressure_archetype" AS ENUM (
    'pushback',
    'time_compression',
    'audience_switch',
    'clarifying_interrupt',
    'stakes_raise'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- users: streak + pressure + completed-reps counter ---------------
ALTER TABLE "cognify_v2"."users"
  ADD COLUMN IF NOT EXISTS "streak_freezes" integer NOT NULL DEFAULT 0;
ALTER TABLE "cognify_v2"."users"
  ADD COLUMN IF NOT EXISTS "last_pressure_archetype_id" "cognify_v2"."pressure_archetype";
ALTER TABLE "cognify_v2"."users"
  ADD COLUMN IF NOT EXISTS "last_session_weakest_dimension" "cognify_v2"."dimension";
ALTER TABLE "cognify_v2"."users"
  ADD COLUMN IF NOT EXISTS "completed_reps_count" integer NOT NULL DEFAULT 0;

-- ----- practice_sessions: session_type + focus_dimension (WS-6) --------
ALTER TABLE "cognify_v2"."practice_sessions"
  ADD COLUMN IF NOT EXISTS "session_type" "cognify_v2"."session_type";
ALTER TABLE "cognify_v2"."practice_sessions"
  ADD COLUMN IF NOT EXISTS "focus_dimension" "cognify_v2"."dimension";

-- ----- reps: pressure_archetype_id (WS-3) ------------------------------
ALTER TABLE "cognify_v2"."reps"
  ADD COLUMN IF NOT EXISTS "pressure_archetype_id" "cognify_v2"."pressure_archetype";
CREATE INDEX IF NOT EXISTS "reps_pressure_archetype_idx"
  ON "cognify_v2"."reps" USING btree ("pressure_archetype_id");

-- ----- personal_bests ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "cognify_v2"."personal_bests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "dimension" "cognify_v2"."dimension" NOT NULL,
  "score" real NOT NULL,
  "rep_id" uuid NOT NULL,
  "achieved_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "cognify_v2"."personal_bests"
    ADD CONSTRAINT "personal_bests_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "cognify_v2"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "personal_bests_user_dim_idx"
  ON "cognify_v2"."personal_bests" USING btree ("user_id", "dimension");

-- ----- weekly_reports ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "cognify_v2"."weekly_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "week_start_iso" text NOT NULL,
  "narrative" jsonb NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "cognify_v2"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "cognify_v2"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "weekly_reports_user_week_idx"
  ON "cognify_v2"."weekly_reports" USING btree ("user_id", "week_start_iso");
