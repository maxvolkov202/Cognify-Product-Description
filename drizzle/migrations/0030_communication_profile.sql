-- PRD v3 Phase 3 — Communication Profile (PRD §8.3) + Communication
-- Stage (PRD §8.2).
--
-- communication_profile: one row per user; Cognify's slowly-evolving
-- estimate of how they communicate (count-scaled EMA over rep evidence).
-- users.communication_stage: career-stage context for personalization
-- (never affects scoring).
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

CREATE TABLE IF NOT EXISTS cognify_v2.communication_profile (
  user_id UUID PRIMARY KEY REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  overall_score REAL,
  core_skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  hidden_skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_reps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cognify_v2.communication_profile IS
  'PRD §8.3 — per-user Communication Profile: slow-EMA estimate of core skills + hidden skills + Overall Communication Score. Rep scores are evidence; this is the estimate.';

ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS communication_stage TEXT;

COMMENT ON COLUMN cognify_v2.users.communication_stage IS
  'PRD §8.2 — student | early_career | individual_contributor | manager | senior_leader | executive. Personalization context only.';
