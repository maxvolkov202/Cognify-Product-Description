-- Phase 15 I-8 — coaching-technique ledger (§8.3.9).
--
-- The coaching memory tells the model to "switch technique" when
-- coaching on a dimension keeps missing, but nothing recorded WHICH
-- technique a delivered Coach's Focus used — so per-technique
-- effectiveness could never be verified. This column records it:
--   'smaller_step' | 'transcript_example' | 'related_hidden_skill'
--   | 'reframe'
-- Plain TEXT (not an enum) so the taxonomy can grow without
-- migrations; NULL = untagged (all historical rows, and first-rep rows
-- until their retry classifies the coached change).
--
-- Written by saveRep: the ledger INSERT persists the technique carried
-- on the derived CoachFocus, and the retry's verdict backfill stamps
-- the parent row's technique alongside implemented_verdict.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

ALTER TABLE cognify_v2.coaching_events
  ADD COLUMN IF NOT EXISTS technique TEXT;

COMMENT ON COLUMN cognify_v2.coaching_events.technique IS
  'Phase 15 I-8 — CoachingTechnique of the delivered focus (smaller_step | transcript_example | related_hidden_skill | reframe); NULL = untagged.';
