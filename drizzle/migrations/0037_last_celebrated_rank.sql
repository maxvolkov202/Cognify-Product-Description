-- Phase 15 R-3 — server-truth rank-up celebrations (§10.8.1).
--
-- Rank is a pure function of lifetime XP (no rank column). The rank-up
-- moment was detected per-browser via localStorage, which missed
-- cross-device promotions, private windows, and always swallowed the
-- first rank-up per browser. This column records the highest rank index
-- the user has been CELEBRATED for; the completion strip celebrates when
-- rankFromXp(xp).rankIndex exceeds it, then advances it.
--
-- NULL = never primed (first read primes silently, no retroactive
-- fanfare for long-time users).
--
-- Idempotent per repo convention (scripts/apply-migration.mjs).

ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS last_celebrated_rank_index INTEGER;

COMMENT ON COLUMN cognify_v2.users.last_celebrated_rank_index IS
  'Phase 15 R-3 — highest rankFromXp().rankIndex already celebrated; NULL = prime silently on next read.';
