import { supabaseAdmin, hasSupabase } from "@/lib/supabase/admin";

const BUCKET = "rep-audio";
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

export type UploadResult = {
  /** Signed URL for immediate playback in the current session. Expires in 1 hour. */
  url: string | null;
  /** Storage path — persist this to reps.audioUrl; signed URL can always be
   *  regenerated from it. */
  path: string | null;
  provider: "supabase-storage" | "none";
};

export async function uploadAudio(
  key: string,
  audio: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  if (!hasSupabase()) {
    return { url: null, path: null, provider: "none" };
  }

  const admin = supabaseAdmin();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(key, audio, {
      contentType: mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (signError) {
    throw new Error(`Signed URL generation failed: ${signError.message}`);
  }

  return {
    url: signed?.signedUrl ?? null,
    path: key,
    provider: "supabase-storage",
  };
}

/**
 * Resolve a stored audio path to a fresh signed URL. Used for playback of
 * historical reps (path is what's persisted in reps.audioUrl).
 */
export async function getAudioSignedUrl(
  path: string,
  ttlSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!hasSupabase() || !path) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error) {
    console.error("[audio] signed URL generation failed:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
