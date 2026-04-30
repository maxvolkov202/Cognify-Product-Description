-- Cognify v2 additive migration — per-user prompt history.
-- Adds user_prompt_history table so the prompt picker can avoid showing
-- the same prompt twice across sessions. Idempotent.

CREATE TABLE IF NOT EXISTS "cognify_v2"."user_prompt_history" (
  "user_id" uuid NOT NULL REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "prompt_id" text NOT NULL,
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "seen_count" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("user_id", "prompt_id")
);

-- Composite PK already covers (user_id, prompt_id) lookups. The user-only
-- index supports the bulk fetch the picker uses on workout-page mount.
CREATE INDEX IF NOT EXISTS "user_prompt_history_user_idx"
  ON "cognify_v2"."user_prompt_history" ("user_id");
