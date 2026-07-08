-- PRD v3 Phase 11.D2/D3 — Lab Engine V1 prompt-pack fields (PRD "For each
-- generated prompt pack, identify: … Coach's Insight … Secondary Core
-- Skills … Common Failure Modes … Scoring Emphasis").
--
-- coach_insight: the exercise-specific Coach's Insight shown on the
-- pre-rep Insight screen (replaces the generic rule/why framing when set).
-- secondary_core_skills: Core Skill dimensions the exercise trains beyond
-- the primary `dimension` column.
-- common_failure_modes: the typical ways speakers fail this exercise —
-- fed to the scorer so feedback names the failure it actually saw.
-- scoring_emphasis: one line telling the evaluator where to weight its
-- attention for this exercise.
--
-- All nullable: pre-enrichment rows stay valid and the engine falls back
-- to rule/why + the generic lens.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS coach_insight TEXT;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS secondary_core_skills JSONB;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS common_failure_modes JSONB;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS scoring_emphasis TEXT;

COMMENT ON COLUMN cognify_v2.exercises.coach_insight IS
  'Lab Engine V1 Coach''s Insight — exercise-specific pre-rep coaching cue shown on the Insight screen.';
COMMENT ON COLUMN cognify_v2.exercises.secondary_core_skills IS
  'string[] of SkillDimension ids trained beyond the primary dimension column.';
COMMENT ON COLUMN cognify_v2.exercises.common_failure_modes IS
  'string[] — typical failure patterns for this exercise; injected into the scoring context.';
COMMENT ON COLUMN cognify_v2.exercises.scoring_emphasis IS
  'One-line evaluator emphasis for this exercise (Lab Engine V1 Scoring Emphasis).';
