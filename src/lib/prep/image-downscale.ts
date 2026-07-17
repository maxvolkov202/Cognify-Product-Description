// Phase 4 (Edit #1) — client-side photo shrink before upload.
//
// Modern phone photos (4-12MB, 12-48MP) blow past the 4MB upload cap
// and cost maximum vision tokens for what is a text-transcription task.
// A printed page or slide survives 1600px JPEG easily. Bonus: Safari
// can decode HEIC via createImageBitmap, so re-encoding to JPEG here
// also rescues iPhone photos picked through the Files app on iOS.
// Any failure returns the original file — the server stays the
// authority on what it can parse.

import { VISION_IMAGE_MIMES } from "./parse-constants";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
/** Below this size an already-vision-friendly image goes up untouched. */
const PASSTHROUGH_BYTES = 1_500_000;

export async function downscaleImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const visionFriendly = (VISION_IMAGE_MIMES as readonly string[]).includes(
    file.type,
  );
  if (visionFriendly && file.size <= PASSTHROUGH_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size === 0) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
