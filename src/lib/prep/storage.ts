import { supabaseAdmin, hasSupabase } from "@/lib/supabase/admin";

// PRD v3 Phase 5 — raw context-upload storage (PRD §7.4). The parsed
// text lives in prep_context_uploads.parsed_text; the original file is
// kept here so re-parsing/inspection stays possible.

const BUCKET = "prep-context";

/** Upload a context document. Lazily creates the private bucket on the
 *  first-ever upload (mirrors ensure-bug-screenshots-bucket, but inline
 *  so no manual bootstrap step is required per environment). */
export async function uploadPrepContextFile(
  key: string,
  buf: Buffer,
  mimeType: string,
): Promise<{ path: string | null }> {
  if (!hasSupabase()) return { path: null };
  const admin = supabaseAdmin();
  let { error } = await admin.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: mimeType, upsert: false });
  if (error && /bucket.*not.*found/i.test(error.message)) {
    await admin.storage.createBucket(BUCKET, { public: false });
    ({ error } = await admin.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: mimeType, upsert: false }));
  }
  if (error) {
    throw new Error(`Context upload failed: ${error.message}`);
  }
  return { path: key };
}

export async function deletePrepContextFiles(paths: string[]): Promise<void> {
  if (!hasSupabase() || paths.length === 0) return;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn("[prep-context] cleanup failed:", error.message);
  }
}
