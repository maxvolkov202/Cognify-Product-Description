-- PRD v3 Phase 4 — Skill Lab applications (PRD §6, §8.3.6).
--
-- Application exercises reuse cognify_v2.exercises: `application` set to
-- storytelling | presenting | teaching | interviewing | persuasion and
-- `dimension` holding the exercise's PRIMARY Core Skill (so the entire
-- scoring pipeline works unchanged). Daily-workout catalog queries now
-- filter `application IS NULL`.
--
-- communication_profile.applications: per-application EMA performance
-- derived from that application's rep composites.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS application TEXT;

ALTER TABLE cognify_v2.exercises
  ADD COLUMN IF NOT EXISTS application_skills JSONB;

COMMENT ON COLUMN cognify_v2.exercises.application IS
  'NULL = Daily Workout core-skill exercise. Otherwise a Skill Lab ApplicationId; dimension holds the primary Core Skill.';
COMMENT ON COLUMN cognify_v2.exercises.application_skills IS
  'string[] of hidden Application Skill ids (src/types/application-skills.ts).';

CREATE INDEX IF NOT EXISTS exercises_application_idx
  ON cognify_v2.exercises (application, is_active);

ALTER TABLE cognify_v2.communication_profile
  ADD COLUMN IF NOT EXISTS applications JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN cognify_v2.communication_profile.applications IS
  'PRD §8.3.6 — { [applicationId]: { score, sampleCount, updatedAt } }, EMA over the application''s rep composites.';
