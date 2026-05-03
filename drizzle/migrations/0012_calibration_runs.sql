-- 0012_calibration_runs.sql
-- DNA Ch.15b — nightly calibration drift history.
--
-- One row per (cron_run, reference_rep). The nightly drift cron
-- (/api/cron/calibration-drift) iterates the reference-reps bank,
-- scores each via /api/score, and persists the per-dim + composite
-- delta from the hand-authored expected values. Operators read the
-- history on /ops/calibration to spot drift early.
--
-- Idempotent — safe to re-apply via `node scripts/apply-migration.mjs`.
-- All names use IF NOT EXISTS so partial runs don't fail.

CREATE TABLE IF NOT EXISTS "cognify_v2"."calibration_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ran_at" timestamptz NOT NULL DEFAULT now(),
  -- Group rows from the same nightly run (one cron invocation = one
  -- run_id; ~13 rows per run, one per reference rep). Lets the /ops
  -- page show "tonight's run" vs "last night's run" trend deltas.
  "run_id" uuid NOT NULL,
  -- Reference rep id from scripts/calibration/reference-reps.json.
  -- Not a foreign key — the reference bank lives in source, not the DB.
  "ref_rep_id" text NOT NULL,
  -- Hand-authored expected composite from the reference bank.
  "expected_composite" integer,
  -- Composite the scoring path actually returned for this run.
  "actual_composite" integer,
  -- actual - expected. Positive = scoring drifted UP (more lenient);
  -- negative = drifted DOWN (more strict).
  "delta_composite" integer,
  -- Per-dim expected / actual / delta as jsonb (≤6 keys each).
  -- Object shape: { clarity: 75, structure: 78, ... }
  "expected_per_dim" jsonb,
  "actual_per_dim" jsonb,
  "delta_per_dim" jsonb,
  -- The rubricVersion the scoring path emitted. Lets us correlate
  -- drift spikes with rubric version bumps.
  "rubric_version" text,
  -- The modelVersion the scoring path emitted. "mock-fallback-v1" on
  -- this row means the cron hit the fallback (likely no Anthropic
  -- credits) — the /ops page surfaces this as a separate state.
  "model_version" text,
  -- Free-form notes. Today: "fallback" / "drift" / "ok" classification
  -- so the /ops summary tile can show counts at a glance.
  "status" text
);

CREATE INDEX IF NOT EXISTS "calibration_runs_ran_at_idx"
  ON "cognify_v2"."calibration_runs" ("ran_at" DESC);

CREATE INDEX IF NOT EXISTS "calibration_runs_run_id_idx"
  ON "cognify_v2"."calibration_runs" ("run_id");

CREATE INDEX IF NOT EXISTS "calibration_runs_ref_rep_idx"
  ON "cognify_v2"."calibration_runs" ("ref_rep_id", "ran_at" DESC);
