-- Cognify v2 additive migration — prompt-bank engagement telemetry.
-- Aggregates per-prompt shown / picked / refreshed-past counts. Powers
-- the prompt evolution loop: low pick-rate prompts get flagged for
-- replacement; high pick-rate prompts get promoted. No per-user dim —
-- per-user history lives in user_prompt_history (migration 0004).
-- Idempotent.

CREATE TABLE IF NOT EXISTS "cognify_v2"."prompt_engagement" (
  "prompt_id" text PRIMARY KEY,
  "shown_count" integer NOT NULL DEFAULT 0,
  "picked_count" integer NOT NULL DEFAULT 0,
  "refreshed_past_count" integer NOT NULL DEFAULT 0,
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_event_at" timestamptz NOT NULL DEFAULT now()
);

-- Pick-rate analysis: order by picked_count / shown_count to find the
-- engaging vs the duds. Index covers the common ordering use.
CREATE INDEX IF NOT EXISTS "prompt_engagement_picked_idx"
  ON "cognify_v2"."prompt_engagement" ("picked_count" DESC, "shown_count" DESC);

CREATE INDEX IF NOT EXISTS "prompt_engagement_refresh_idx"
  ON "cognify_v2"."prompt_engagement" ("refreshed_past_count" DESC);
