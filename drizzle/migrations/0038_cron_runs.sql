-- P8 — cron run ledger (platform hardening).
--
-- Crons previously failed as unread log lines. This table gives every
-- cron invocation one queryable row (success or failure), written
-- best-effort by the wrappers in src/app/api/cron/*/route.ts.
-- Unauthorized probes (401/403) are not recorded.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

CREATE TABLE IF NOT EXISTS cognify_v2.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ok boolean NOT NULL,
  duration_ms integer NOT NULL,
  error text,
  ran_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cron_runs_name_ran_at_idx
  ON cognify_v2.cron_runs (name, ran_at DESC);
