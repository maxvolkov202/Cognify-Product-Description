-- Audio + transcript retention. Voice is biometric PII under GDPR/CCPA;
-- without a retention sweep, rep audio sits in Supabase storage forever.
-- Column is nullable: NULL = "keep forever" (user opt-out), positive integer
-- = days to retain. Default 180 days for soft launch — long enough that
-- the first nightly sweep on cognify-v2-neon doesn't surprise any of the
-- early users (oldest audio is ~35 days old as of the cutover); a future
-- tightening to 90 can land once retention behavior is understood.
ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS audio_retention_days integer DEFAULT 180;
