import { put } from "@vercel/blob";
import { hasBlobStorage } from "@/lib/db/safe";

export type UploadResult = {
  url: string | null;
  provider: "vercel-blob" | "none";
};

export async function uploadAudio(
  key: string,
  audio: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  if (!hasBlobStorage()) {
    return { url: null, provider: "none" };
  }

  const blob = await put(key, audio, {
    access: "public",
    contentType: mimeType,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });

  return { url: blob.url, provider: "vercel-blob" };
}
