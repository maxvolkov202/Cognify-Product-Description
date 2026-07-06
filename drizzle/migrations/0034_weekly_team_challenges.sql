-- PRD v3 Phase 6 — Weekly Challenges (PRD §10.10), Team Challenges
-- (PRD §10.11), and committed-day reminder email state (task 6.8).
--
-- weekly_challenges mirrors daily_quests but is WEEK-keyed (Sunday UTC,
-- same week math as leagues) and counter-based: challenge targets span
-- many reps ("Complete twenty communication reps"), so progress is a
-- running count per challenge id, not a per-rep boolean.
--
-- team_weekly_challenges: one shared goal per team per week; progress
-- increments on any member's qualifying activity.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

CREATE TABLE IF NOT EXISTS cognify_v2.weekly_challenges (
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

COMMENT ON TABLE cognify_v2.weekly_challenges IS
  'PRD §10.10 — 3 challenges per user per week (seeded pick). challenges: [{id,target,bonusXp}]. progress: {id: count}. completion: {completedIds, xpEarned}.';

CREATE TABLE IF NOT EXISTS cognify_v2.team_weekly_challenges (
  team_id UUID NOT NULL REFERENCES cognify_v2.teams(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  challenge JSONB NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, week_start)
);

COMMENT ON TABLE cognify_v2.team_weekly_challenges IS
  'PRD §10.11 — one shared goal per team per week. challenge: {id,title,target}. Progress increments on member activity.';

ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS reminder_emails_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at DATE;

COMMENT ON COLUMN cognify_v2.users.reminder_emails_enabled IS
  'Phase 6.8 — committed-day/streak-at-risk reminder emails opt-out (Settings toggle).';
COMMENT ON COLUMN cognify_v2.users.last_reminder_sent_at IS
  'Phase 6.8 — dedupe: at most one reminder email per user-local day.';
