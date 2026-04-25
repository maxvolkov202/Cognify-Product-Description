-- Cognify v2 additive migration — user bug reporting + operator triage queue.
-- Adds bug_status enum and bug_reports table. Idempotent.

DO $$ BEGIN
  CREATE TYPE "cognify_v2"."bug_status" AS ENUM (
    'open',
    'in_progress',
    'fixed',
    'wontfix',
    'duplicate'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "cognify_v2"."bug_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "cognify_v2"."users"("id") ON DELETE SET NULL,
  "description" text NOT NULL,
  "image_paths" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "user_agent" text,
  "route" text,
  "status" "cognify_v2"."bug_status" NOT NULL DEFAULT 'open',
  "resolution_note" text,
  "resolved_at" timestamptz,
  "resolved_by" uuid REFERENCES "cognify_v2"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bug_reports_status_created_idx"
  ON "cognify_v2"."bug_reports" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "bug_reports_user_idx"
  ON "cognify_v2"."bug_reports" ("user_id");
