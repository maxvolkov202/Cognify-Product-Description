-- Skill Lab session resume (audit L3).
--
-- practice_sessions.session_state: client-persisted snapshot of an
-- in-flight Skill Lab session ({ applicationId, exercises, idx,
-- outcomes-lite }) so a mid-session refresh can resume instead of
-- orphaning the row with ended_at = NULL. NULL for every other mode
-- and nulled out when the session completes.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

ALTER TABLE cognify_v2.practice_sessions
  ADD COLUMN IF NOT EXISTS session_state JSONB;

COMMENT ON COLUMN cognify_v2.practice_sessions.session_state IS
  'Skill Lab resume snapshot { applicationId, exercises, idx, outcomes }; NULL for other modes and once the session ends.';
