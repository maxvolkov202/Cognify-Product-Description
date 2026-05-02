-- 0011_leagues.sql
-- DNA Ch.9b — leagues. Weekly cohorts of ~30 users compete on XP earned
-- that week. Top 30% promote, bottom 30% relegate at week reset (Sunday
-- 00:00 UTC).
--
-- Schema: one row per (user_id, week_start). Cohort id groups users
-- competing against each other for that week. Tier id is the user's
-- division (bronze, silver, gold, sapphire, ruby, diamond). Weekly_xp
-- accumulates within the week.

CREATE TABLE IF NOT EXISTS "cognify_v2"."league_membership" (
  "user_id" uuid NOT NULL,
  "week_start" date NOT NULL,
  "tier" text NOT NULL,
  "league_id" uuid NOT NULL,
  "weekly_xp" integer NOT NULL DEFAULT 0,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "promoted_to" text,
  "relegated_to" text,
  "settled_at" timestamptz,
  PRIMARY KEY ("user_id", "week_start")
);

CREATE INDEX IF NOT EXISTS "league_membership_league_idx"
  ON "cognify_v2"."league_membership" ("league_id", "weekly_xp" DESC);

CREATE INDEX IF NOT EXISTS "league_membership_week_tier_idx"
  ON "cognify_v2"."league_membership" ("week_start", "tier");
