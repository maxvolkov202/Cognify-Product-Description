-- 0008_user_progression.sql
-- DNA Ch.7 — Levels 1-100 + XP system on top of the existing streak
-- infrastructure (streak_freezes already on users from earlier work).
--
-- Schema:
--   level             : current level, 1-100. Default 1 for new users.
--   xp                : lifetime XP accumulated. Strictly monotonic.
--                       Backfill script replays awardXp over historical
--                       reps in chronological order.
--   lifetime_reps     : count of reps the user has completed. Used for
--                       achievements (Ch.9) and the dashboard.
--   last_level_up_at  : nullable timestamptz. Anti-grinding: at most
--                       one level-up per UTC day (XP still accrues for
--                       tomorrow when capped).
--
-- All defaults are safe for existing rows — no backfill required at the
-- migration level. The backfill SCRIPT (scripts/backfill-progression.mjs)
-- is run separately to populate level + xp + lifetime_reps from
-- historical reps.

ALTER TABLE "cognify_v2"."users"
  ADD COLUMN IF NOT EXISTS "level" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "xp" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_reps" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_level_up_at" timestamptz;

-- Index for level-based leaderboard cohorts (Ch.9 leagues).
CREATE INDEX IF NOT EXISTS "users_level_xp_idx"
  ON "cognify_v2"."users" ("level" DESC, "xp" DESC);
