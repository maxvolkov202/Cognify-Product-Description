#!/usr/bin/env node
// Idempotently provision the Supabase Storage bucket used for bug-report
// screenshots. Safe to re-run.
//
//   Usage: node scripts/ensure-bug-screenshots-bucket.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const BUCKET = "bug-screenshots";
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const list = await admin.storage.listBuckets();
  if (list.error) {
    console.error("[storage] listBuckets failed:", list.error.message);
    process.exit(1);
  }
  const existing = list.data?.find((b) => b.name === BUCKET);

  if (!existing) {
    console.log(`[storage] creating bucket "${BUCKET}"…`);
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ALLOWED_MIME,
      fileSizeLimit: MAX_BYTES,
    });
    if (error) {
      console.error("[storage] createBucket failed:", error.message);
      process.exit(1);
    }
    console.log(`[storage] ✓ created "${BUCKET}" (private, ${MAX_BYTES} byte limit)`);
  } else {
    console.log(`[storage] bucket "${BUCKET}" exists — updating constraints…`);
    const { error } = await admin.storage.updateBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ALLOWED_MIME,
      fileSizeLimit: MAX_BYTES,
    });
    if (error) {
      console.error("[storage] updateBucket failed:", error.message);
      process.exit(1);
    }
    console.log(`[storage] ✓ updated "${BUCKET}" (private, ${MAX_BYTES} byte limit)`);
  }

  console.log("[storage] done. Bug-report uploads should now succeed.");
}

main().catch((err) => {
  console.error("[storage] unexpected:", err);
  process.exit(1);
});
