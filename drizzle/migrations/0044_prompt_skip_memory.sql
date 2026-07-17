-- Phase 5 (§8.5 content memory) — persist which prompts the user was
-- shown and did NOT pick, so "recently skipped prompts" survive the
-- browser session and the picker can deprioritize them tomorrow.
ALTER TABLE cognify_v2.prompt_selection_events
  ADD COLUMN IF NOT EXISTS skipped_prompt_ids jsonb;
