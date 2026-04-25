-- Cognify v2 additive migration — crew invites for non-Cognify users.
-- Allows /friends to invite an email that doesn't yet have an account; the
-- pending row is converted to a friendships row when that person signs up.
-- Idempotent.

CREATE TABLE IF NOT EXISTS "cognify_v2"."crew_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "inviter_id" uuid NOT NULL REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "accepted_at" timestamptz,
  "accepted_user_id" uuid REFERENCES "cognify_v2"."users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "crew_invites_email_idx" ON "cognify_v2"."crew_invites" ("email");
CREATE INDEX IF NOT EXISTS "crew_invites_inviter_idx" ON "cognify_v2"."crew_invites" ("inviter_id");
