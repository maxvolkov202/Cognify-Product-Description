-- PRD v3 Phase 2.2 — Exercise Framework enrichment (PRD §9.2).
--
-- Every exercise becomes a full Exercise Framework: communication
-- objective, targeted Hidden Skills, scoring lens (absorbed from the
-- code-side EXERCISE_RUBRIC_HINTS), retry objective, prompt-generation
-- rules, and ADR-001 response window + constraint taxonomy. All columns
-- nullable — pre-enrichment rows keep working; the engine falls back to
-- rule/why.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs, no journal).

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS objective TEXT;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS hidden_skills JSONB;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS scoring_lens TEXT;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS retry_objective TEXT;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS prompt_rules TEXT;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS response_window JSONB;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS constraint_types JSONB;

COMMENT ON COLUMN cognify_v2.exercises.objective IS
  'PRD §9.2 — the single communication objective this Exercise Framework trains.';
COMMENT ON COLUMN cognify_v2.exercises.hidden_skills IS
  'string[] of Hidden Skill ids (src/types/sub-skills.ts) this exercise targets.';
COMMENT ON COLUMN cognify_v2.exercises.scoring_lens IS
  'Operator-facing evaluation constraint injected into the scoring prompt (supersedes code-side EXERCISE_RUBRIC_HINTS).';
COMMENT ON COLUMN cognify_v2.exercises.retry_objective IS
  'What the required Retry should target when the exercise rule was broken.';
COMMENT ON COLUMN cognify_v2.exercises.prompt_rules IS
  'Rules for AI prompt generation from this framework (PRD engine specs; Phase 8).';
COMMENT ON COLUMN cognify_v2.exercises.response_window IS
  'ADR-001 response window: {"minSec": n, "maxSec": n}.';
COMMENT ON COLUMN cognify_v2.exercises.constraint_types IS
  'ADR-001 constraint taxonomy subset: time | structure | tone | complexity | none.';
