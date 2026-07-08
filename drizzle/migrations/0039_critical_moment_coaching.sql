-- L4 (PRD §7.7/§8.4.6) — Critical Moments carry a real Coach's Insight
-- (coach_cue: the behavioral cue shown on MomentInsight) and a scoring
-- lens (scoring_hint: one operator-facing line injected into the rep's
-- scoring eventContext). Additive + nullable: existing moments and
-- user-authored moments simply have neither.

ALTER TABLE cognify_v2.critical_moments
  ADD COLUMN IF NOT EXISTS coach_cue text,
  ADD COLUMN IF NOT EXISTS scoring_hint text;
