-- Email case-insensitivity. Audit PR-20: users.email + crew_invites.email
-- were stored as `text` with a case-sensitive UNIQUE. Lookups in
-- src/lib/db/queries/friends.ts (and current-user.ts pre-refactor)
-- already lowercased input — so a row inserted from Supabase Auth as
-- "Jane@Example.com" stayed permanently dark to a lowercase lookup,
-- and case-twiddled duplicates could slip past the UNIQUE.
--
-- Switching to citext fixes both: case-insensitive comparison AND a
-- case-insensitive UNIQUE. Storage keeps the original case.
--
-- WARNING — STAGE IN PREVIEW FIRST. Reasons:
--   * Touches the schema for the table Supabase Auth callbacks write to.
--   * If any historical row has a case-variant duplicate (e.g. both
--     "max@x.com" and "Max@x.com"), the UNIQUE constraint recreate will
--     fail. Detect via:
--       SELECT lower(email), COUNT(*) FROM cognify_v2.users
--       GROUP BY 1 HAVING COUNT(*) > 1;
--     before running this migration; merge any dupes manually.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

-- ─── users.email ─────────────────────────────────────────────────────

-- Drop the old unique constraint. Default constraint name follows the
-- pgN pattern `<table>_<column>_key`.
ALTER TABLE cognify_v2.users
  DROP CONSTRAINT IF EXISTS users_email_key;

-- citext compares case-insensitively but preserves original case in
-- storage. We DON'T lowercase on the conversion — preserving the case
-- the user typed at signup is the right product behavior.
ALTER TABLE cognify_v2.users
  ALTER COLUMN email TYPE citext USING email::citext;

ALTER TABLE cognify_v2.users
  ADD CONSTRAINT users_email_key UNIQUE (email);

-- ─── crew_invites.email ──────────────────────────────────────────────

-- crew_invites.email isn't UNIQUE today but it does have an index.
-- Drop + recreate so the index covers the citext type.
DROP INDEX IF EXISTS cognify_v2.crew_invites_email_idx;

ALTER TABLE cognify_v2.crew_invites
  ALTER COLUMN email TYPE citext USING email::citext;

CREATE INDEX crew_invites_email_idx ON cognify_v2.crew_invites (email);

COMMIT;
