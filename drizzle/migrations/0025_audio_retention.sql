-- Audio + transcript retention. Voice is biometric PII under GDPR/CCPA;
-- without a retention sweep, rep audio sits in Supabase storage forever.
-- Column is nullable: NULL = "keep forever" (user opt-out), positive integer
-- = days to retain. Default 90 — long enough for the user to revisit a
-- recent rep, short enough to limit blast radius if storage leaks.
ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS audio_retention_days integer DEFAULT 90;
