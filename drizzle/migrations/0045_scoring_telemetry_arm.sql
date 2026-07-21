-- 0045_scoring_telemetry_arm.sql
-- Grading Engine V2 — eval bench.
--
-- Attribute each scoring row to its A/B arm ("control" | "median-of-n" |
-- "all-llm" | future arms) so the bench + /ops can compare accuracy,
-- stability, latency, and cost per arm.
--
-- Plain text (NOT a pg enum) — mirrors the existing "source" /
-- "model_used" / "failure_reason" text columns and sidesteps the
-- append-only-enum rule. Nullable so all historical rows and the
-- mock-fallback path (no real arm) stay valid; NULL reads as control.

ALTER TABLE "cognify_v2"."scoring_telemetry"
  ADD COLUMN IF NOT EXISTS "arm" text;

CREATE INDEX IF NOT EXISTS "scoring_telemetry_arm_idx"
  ON "cognify_v2"."scoring_telemetry" ("arm", "created_at");
