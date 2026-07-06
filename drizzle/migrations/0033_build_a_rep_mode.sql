-- PRD v3 Phase 5 — Build a Rep v2 gets its own mode value so prep reps
-- are distinguishable from legacy scenario_training reps (analytics,
-- quests, XP). Append-only per enum convention.

ALTER TYPE cognify_v2.mode ADD VALUE IF NOT EXISTS 'build_a_rep';
