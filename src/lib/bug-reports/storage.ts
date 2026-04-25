import { supabaseAdmin, hasSupabase } from "@/lib/supabase/admin";

const BUCKET = "bug-screenshots";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export type BugScreenshotUpload = {
  path: string | null;
};

/**
 * Upload a single bug-report screenshot to Supabase Storage. Returns the
 * storage path; we persist the path (not a signed URL) since signed URLs
 * expire and we want admins to be able to view screenshots indefinitely.
 */
export async function uploadBugScreenshot(
  key: string,
  buf: Buffer,
  mimeType: string,
): Promise<BugScreenshotUpload> {
  if (!hasSupabase()) return { path: null };
  const admin = supabaseAdmin();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(`Bug screenshot upload failed: ${error.message}`);
  }
  return { path: key };
}

/** Resolve a stored screenshot path to a fresh signed URL for admin viewing. */
export async function getBugScreenshotSignedUrl(
  path: string,
  ttlSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!hasSupabase() || !path) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error) {
    console.error("[bug-reports] signed URL failed:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Hard-delete screenshots when an admin deletes the bug report. */
export async function deleteBugScreenshots(paths: string[]): Promise<void> {
  if (!hasSupabase() || paths.length === 0) return;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn("[bug-reports] cleanup failed:", error.message);
  }
}
