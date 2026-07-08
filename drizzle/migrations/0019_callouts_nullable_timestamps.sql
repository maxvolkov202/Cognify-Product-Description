-- 0019_callouts_nullable_timestamps.sql
-- Priority 5 (2026-05-21) — accept callouts without transcript anchors.
--
-- LLMs (especially gpt-4o on the OpenAI-fallback path) occasionally
-- omit transcript_start_ms / transcript_end_ms when they can't ground
-- the callout to a specific moment. The Zod schema previously rejected
-- such responses, sending the rep into mock_fallback (composite=70
-- default headline). After replay testing in 2026-05-21 showed this was
-- the dominant validation_failed cause, callouts were aligned with
-- bullets (which already accept null timestamps) and the DB columns are
-- relaxed to nullable to match.
--
-- The UI's jump-to-moment affordance reads `transcript_start_ms != null`
-- as the gate, so null timestamps render the callout without the
-- timestamp button — same behavior as the bullet anti-hallucination
-- sanitizer already produces when it strips invalid anchors.
--
-- Idempotent.

ALTER TABLE "cognify_v2"."callouts"
  ALTER COLUMN "transcript_start_ms" DROP NOT NULL,
  ALTER COLUMN "transcript_end_ms" DROP NOT NULL;
