-- 0018_callout_drift_reports.sql
-- Phase 7 — weekly drift detection from callout_corrections.
--
-- Cron writes one row per (week_start, dimension, sub_skill, verdict).
-- The ops UI reads recent rows to show per-dim wrong-rate trends and
-- flag dims that need rubric attention. Wrongness signal threshold:
-- wrongRate >= 0.25 AND totalForGroup >= 4 (the latter cuts noise from
-- low-sample dims).
--
-- Append-only; never UPDATEd. Re-running the cron for the same week
-- overwrites by week (cron deletes its own prior rows for the week
-- before inserting).
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS "cognify_v2"."callout_drift_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "week_start" date NOT NULL,
  "dimension" "cognify_v2"."dimension" NOT NULL,
  -- NULL when corrections didn't carry a sub_skill (legacy bullets).
  "sub_skill" text,
  -- wrong | not_relevant | agree — same enum as callout_corrections.
  "verdict" text NOT NULL,
  "count" integer NOT NULL,
  -- Total corrections in (week, dim, sub_skill) across all verdicts.
  -- Denominator for wrong_rate.
  "total_for_group" integer NOT NULL,
  "wrong_rate" real NOT NULL,
  -- True when wrongRate >= 0.25 AND totalForGroup >= 4.
  "flagged" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "callout_drift_week_dim_idx"
  ON "cognify_v2"."callout_drift_reports" ("week_start", "dimension");

CREATE INDEX IF NOT EXISTS "callout_drift_flagged_idx"
  ON "cognify_v2"."callout_drift_reports" ("flagged", "week_start");
