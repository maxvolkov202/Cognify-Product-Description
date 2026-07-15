-- System Change v2 Phase 1 (D20) — Hidden Skill Taxonomy v2 key migration.
--
-- Folds the 13 RENAMED pre-v2 sub-skill ids in
-- communication_profile.hidden_skills jsonb to their v2 successors
-- (plans/prd/taxonomy-migration-map.md; the other 21 old ids exist
-- verbatim in v2 and need no touch). Two of the renames cross dimension
-- (pitch_variation / volume_control move from tone to delivery) — the
-- jsonb is a flat map, dimension membership is derived from the id in
-- code, so the fold is the same shape.
--
-- Collision rule: if both keys somehow exist (e.g. new-code writes
-- landing before this migration runs), the entry with the higher
-- sampleCount wins — matching the "evidence-weight wins" intent of the
-- migration map.
--
-- Historical reps' dimension_scores.signals keep their old keys on
-- purpose: read paths canonicalize via LEGACY_SUB_SKILL_MAP
-- (src/types/hidden-skills.generated.ts), and the profile is the
-- estimate of record.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

DO $$
DECLARE
  renames CONSTANT jsonb := '{
    "word_choice": "vocabulary_precision",
    "audience_awareness": "audience_calibration",
    "precision": "lexical_specificity",
    "logical_sequencing": "listener_first_sequencing",
    "filler_elimination": "filler_reduction",
    "hedging_awareness": "hedging_control",
    "editing_in_real_time": "real_time_editing",
    "filler_word_control": "filler_to_pause_substitution",
    "pressure_management": "pressure_pacing",
    "pitch_variation": "prosodic_alignment",
    "volume_control": "emphasis_timing",
    "downward_inflection": "confidence",
    "vocal_presence": "gravitas"
  }';
  old_key text;
  new_key text;
BEGIN
  FOR old_key, new_key IN SELECT key, value FROM jsonb_each_text(renames) LOOP
    -- Move the entry when the target is absent or has less evidence.
    UPDATE cognify_v2.communication_profile
       SET hidden_skills = (hidden_skills - old_key)
                           || jsonb_build_object(new_key, hidden_skills -> old_key),
           updated_at = now()
     WHERE hidden_skills ? old_key
       AND (
         NOT hidden_skills ? new_key
         OR COALESCE((hidden_skills -> old_key ->> 'sampleCount')::numeric, 0)
            > COALESCE((hidden_skills -> new_key ->> 'sampleCount')::numeric, 0)
       );

    -- Collision where the existing target won: just drop the old key.
    UPDATE cognify_v2.communication_profile
       SET hidden_skills = hidden_skills - old_key,
           updated_at = now()
     WHERE hidden_skills ? old_key;
  END LOOP;
END $$;
