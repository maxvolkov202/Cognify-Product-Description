-- PRD v3 Phase 5 — Build a Rep: event preparation (PRD §7, §8.4.6).
--
-- prep_events: one row per real-world communication event the user is
-- preparing for ("SDR Interview at Salesforce"). Cognify infers the
-- event type, recommends a practice mode + duration, and keeps the
-- latest readiness estimate (PRD §8.3.8 event-readiness memory).
--
-- critical_moments: the editable Preparation Plan (PRD §7.7) — Cognify
-- generates, the user adds/removes/renames/reorders. Per-moment practice
-- state is denormalized here for the plan screen.
--
-- prep_context_uploads: optional context docs (resume, JD, deck notes —
-- PRD §7.4). Raw file in Supabase Storage; parsed text capped + stored
-- for generation injection.
--
-- readiness_reviews: the Readiness Review record (PRD §7.9), one per
-- completed guided session or full simulation.
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

CREATE TABLE IF NOT EXISTS cognify_v2.prep_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'other',
  recommended_mode TEXT NOT NULL DEFAULT 'guided',
  recommended_duration_sec INTEGER,
  context_summary TEXT,
  readiness_score REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cognify_v2.prep_events IS
  'PRD §7 Build a Rep — one row per real-world communication event being prepared for. event_type: interview | presentation | pitch | toast | demo | meeting | speech | other. recommended_mode: guided | simulation.';

CREATE INDEX IF NOT EXISTS prep_events_user_idx
  ON cognify_v2.prep_events (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS cognify_v2.critical_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cognify_v2.prep_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  objective TEXT,
  recommended_seconds INTEGER NOT NULL DEFAULT 90,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'generated',
  best_composite REAL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cognify_v2.critical_moments IS
  'PRD §7.7 Preparation Plan — the moments most likely to determine success. source: generated | user. Practice state denormalized for the plan screen.';

CREATE INDEX IF NOT EXISTS critical_moments_event_idx
  ON cognify_v2.critical_moments (event_id, sort_order);

CREATE TABLE IF NOT EXISTS cognify_v2.prep_context_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cognify_v2.prep_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  parsed_chars INTEGER,
  parsed_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cognify_v2.prep_context_uploads IS
  'PRD §7.4 context uploads (resume/JD/deck notes). parse_status: pending | parsed | failed | unsupported. parsed_text capped at ~50k chars for generation injection.';

CREATE INDEX IF NOT EXISTS prep_context_uploads_event_idx
  ON cognify_v2.prep_context_uploads (event_id);

CREATE TABLE IF NOT EXISTS cognify_v2.readiness_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cognify_v2.prep_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  overall_score REAL,
  core_skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  coach_feedback TEXT,
  readiness_summary TEXT,
  rep_id UUID REFERENCES cognify_v2.reps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cognify_v2.readiness_reviews IS
  'PRD §7.9 Readiness Review — one per completed guided session or full simulation. mode: guided | simulation. core_skills: { [dim]: { score, why, well, improve } }. coach_feedback = the single highest-impact focus.';

CREATE INDEX IF NOT EXISTS readiness_reviews_event_idx
  ON cognify_v2.readiness_reviews (event_id, created_at DESC);
