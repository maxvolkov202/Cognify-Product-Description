-- Phase 4 (Edit #3) — per-moment speaking notes/structure for Build a Rep.
-- Jsonb {sections: [{header, bullets[]}]} — the TalkingPoints shape the
-- legacy BaR sidebar used; AI-generated once, then user-edited in place.
ALTER TABLE cognify_v2.critical_moments
  ADD COLUMN IF NOT EXISTS notes jsonb;
