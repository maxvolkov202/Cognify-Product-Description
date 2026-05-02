-- 0009_achievements.sql
-- DNA Ch.9c — earnable achievements ("badges").
--
-- Definitions are static (in code, src/lib/engagement/achievements.ts) so
-- ID changes are tracked in git. Per-user unlocks live here. We don't
-- denormalize the achievement metadata — just the id + earn timestamp.
-- A single user can hold each achievement at most once (unique on
-- (user_id, achievement_id)).

CREATE TABLE IF NOT EXISTS "cognify_v2"."user_achievements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "achievement_id" text NOT NULL,
  "earned_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_achievements_user_achievement_unique"
    UNIQUE ("user_id", "achievement_id")
);

CREATE INDEX IF NOT EXISTS "user_achievements_user_id_idx"
  ON "cognify_v2"."user_achievements" ("user_id");

CREATE INDEX IF NOT EXISTS "user_achievements_earned_at_idx"
  ON "cognify_v2"."user_achievements" ("earned_at" DESC);
