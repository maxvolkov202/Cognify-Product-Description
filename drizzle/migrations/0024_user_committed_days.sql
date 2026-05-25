-- Phase C — custom weekly training schedule.
--
-- `committed_days` is a 7-bit bitmask: bit 0 = Monday … bit 6 = Sunday.
-- Default 31 (binary 0011111) = Mon..Fri, the "5 days a week" trainer
-- recommendation. Users opt down to any non-empty subset via onboarding
-- or /settings.
--
-- Why bitmask, not text[]: compact (4 bytes), trivial set ops in SQL
-- (`(committed_days & (1 << EXTRACT(DOW))) > 0`), no JSON parsing on
-- read, indexable if we ever want "users who train on Wednesdays."
--
-- Backfill: every existing user gets the default (Mon..Fri). Users who
-- prefer a different schedule update later via /settings.

-- CTO review B-6 — IF NOT EXISTS makes the migration idempotent so
-- re-running (after a journal hiccup or hotfix rollforward) is a no-op
-- instead of an error. Postgres 11+ handles ADD COLUMN with a constant
-- DEFAULT as a metadata-only operation, so this is safe on large tables.
ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS committed_days INTEGER NOT NULL DEFAULT 31;

COMMENT ON COLUMN cognify_v2.users.committed_days IS
  'Bitmask of committed training days. Bit 0 = Mon, bit 6 = Sun. Default 31 = Mon-Fri.';
