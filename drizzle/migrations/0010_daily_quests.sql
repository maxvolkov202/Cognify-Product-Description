-- 0010_daily_quests.sql
-- DNA Ch.9d — daily quests. Three quests per user per UTC day, generated
-- on first dashboard render of the day, evaluated after every rep
-- submission. Completed quests grant a small XP bonus on the spot.
--
-- Schema: one row per (user_id, quest_date). The quests for the day +
-- their completion state live as JSONB so we can iterate quest design
-- without schema migrations. Quest definitions live in code
-- (src/lib/engagement/quests.ts).

CREATE TABLE IF NOT EXISTS "cognify_v2"."daily_quests" (
  "user_id" uuid NOT NULL,
  "quest_date" date NOT NULL,
  "quests" jsonb NOT NULL,
  "completion" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "quest_date")
);

CREATE INDEX IF NOT EXISTS "daily_quests_user_date_idx"
  ON "cognify_v2"."daily_quests" ("user_id", "quest_date" DESC);
