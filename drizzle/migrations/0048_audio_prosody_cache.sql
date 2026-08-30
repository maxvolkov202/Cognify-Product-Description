-- 0048_audio_prosody_cache.sql
-- Grading plan WS8 — prosody worker triggered at upload time.
--
-- /api/upload warms the Praat worker right after the object lands (via
-- next/server after()) and stores the feature bundle here, keyed by the
-- storage path. /api/score reads the cache before calling the worker, so a
-- cold worker start (observed 5 s timeouts → Tone silently on text) is
-- absorbed while the client is still transcribing instead of on the
-- scoring path. Rows are small and short-lived; the audio-retention cron
-- may sweep by created_at.
CREATE TABLE IF NOT EXISTS "cognify_v2"."audio_prosody_cache" (
  "path" text PRIMARY KEY,
  "features" jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audio_prosody_cache_created_idx" ON "cognify_v2"."audio_prosody_cache" ("created_at");
COMMENT ON TABLE "cognify_v2"."audio_prosody_cache" IS 'Worker prosody features per rep audio object, warmed at upload; status pending|ready|failed.';
