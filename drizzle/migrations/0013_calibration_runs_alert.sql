-- 0013_calibration_runs_alert.sql
-- DNA Ch.C1 — drift alert tracking column.
--
-- Adds `alert_sent_at` to calibration_runs so the /ops/calibration page
-- can render a per-run "alerted at HH:MM UTC" badge, and the nightly
-- drift cron can avoid double-sending alerts for the same run when
-- triggered manually after an automated run.
--
-- One row per (run_id, ref_rep_id) gets the SAME alert_sent_at
-- timestamp when an alert fires for the run. Set on the FIRST insert
-- after the alert webhook returns 2xx; null on rows where no alert
-- was needed or webhook was unconfigured.
--
-- Idempotent — safe to re-apply via `node scripts/apply-migration.mjs`.

ALTER TABLE "cognify_v2"."calibration_runs"
  ADD COLUMN IF NOT EXISTS "alert_sent_at" timestamptz;
