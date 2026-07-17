-- Grading v3 (System Change v2 Phase 3, D22) — persist the doc-shaped
-- feedback document on reps.
--
-- The unified scoring pass emits the PRD §4.5-4.6 feedback shape
-- (headline, single Coach's Focus, per-skill feedback, Stronger
-- Version, nextRepHint, implementationReview). Before this column the
-- rich fields lived ONLY in the live /api/score response: async-path
-- reps and the /progress/rep/[id] page reconstructed a lossy RepScore
-- from composite + dimension_scores + callouts. reps.feedback stores
-- the render-shaped document so read-back is lossless.
--
-- Shape (jsonb, versioned): {
--   version, headline?, headlineTone?, strongerVersion?, nextRepHint?,
--   skillFeedback?: { [dimension]: { feedback, subSkill? } },
--   implementationReview?
-- }
--
-- Idempotent: IF NOT EXISTS.

ALTER TABLE cognify_v2.reps ADD COLUMN IF NOT EXISTS feedback jsonb;
