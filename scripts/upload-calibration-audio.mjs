#!/usr/bin/env node
/**
 * Upload the audio-tone calibration clips to the `rep-audio` bucket
 * under calibration-audio/ so server-side consumers (the calibration
 * drift cron) can mint signed URLs at runtime from the storagePath
 * recorded in reference-reps.json. Signed URLs are never persisted.
 *
 * Idempotent (upsert). Requires NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).
 *
 * Usage: node --env-file=.env.local scripts/upload-calibration-audio.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const BANK = resolve(__dirname, "calibration", "reference-reps.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — run with node --env-file=.env.local");
  process.exit(2);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const MIME = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".webm": "audio/webm" };

const bank = JSON.parse(readFileSync(BANK, "utf8"));
const audioReps = bank.reps.filter((r) => r.kind === "audio-tone" && r.storagePath);

let failed = 0;
for (const rep of audioReps) {
  const body = readFileSync(resolve(REPO_ROOT, rep.localAudioFile));
  const { error } = await admin.storage
    .from("rep-audio")
    .upload(rep.storagePath, body, {
      contentType: MIME[extname(rep.localAudioFile)] ?? "application/octet-stream",
      upsert: true,
    });
  if (error) {
    failed++;
    console.error(`✗ ${rep.storagePath}: ${error.message}`);
  } else {
    console.log(`✓ ${rep.storagePath} (${(body.length / 1024).toFixed(0)} KB)`);
  }
}
console.log(`${audioReps.length - failed}/${audioReps.length} uploaded`);
process.exit(failed ? 1 : 0);
