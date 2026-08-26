import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { uploadAudio } from "@/lib/audio/upload";
import {
  ALLOWED_AUDIO_MIME_TYPES,
  audioExtensionFor,
  isAllowedAudioMime,
  normalizeAudioMime,
} from "@/lib/audio/mime";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Auth: require a user. Without the guest cookie this is 401 — closes
  // the open-internet blob-storage write that previously only IP-rate-
  // limited.
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }

  // Rate-limit by user.id — IP buckets are useless behind shared NATs.
  const rl = await rateLimit(`user:${user.id}:upload`, {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many uploads. Wait a moment and try again.",
      },
      { status: 429 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "missing_file", message: "Expected multipart field 'audio'." },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { error: "empty_file", message: "Audio file was empty." },
        { status: 400 },
      );
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "file_too_large", message: "Audio must be under 25MB." },
        { status: 413 },
      );
    }
    // MediaRecorder reports a PARAMETERIZED type (`audio/webm;codecs=opus`),
    // and Storage matches its allowlist against the full contentType
    // string — so the raw value never matches and the write 500s. Strip
    // parameters before both the check and the upload.
    const mime = normalizeAudioMime(file.type) || "audio/webm";
    if (!isAllowedAudioMime(mime)) {
      // LOG, don't just return. Callers treat upload as best-effort and
      // discard the status (audio is optional; a failure must never block
      // scoring), which is exactly how the original outage stayed invisible
      // for months. A server-side line is the only thing that surfaces the
      // next browser shipping a type this bucket rejects.
      console.error(
        `[upload] rejected unsupported audio type: raw="${file.type}" normalized="${mime}"`,
      );
      return NextResponse.json(
        {
          error: "unsupported_mime",
          message: `Unsupported audio type. Expected one of: ${ALLOWED_AUDIO_MIME_TYPES.join(", ")}.`,
        },
        { status: 415 },
      );
    }
    const extension = audioExtensionFor(mime);
    // Namespace under the user id so blob-storage cleanup + per-user
    // accounting are tractable.
    const key = `reps/${user.id}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAudio(key, buffer, mime);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    // Same reasoning as the 415 above — callers swallow this response, so
    // without a log a storage-side rejection is silent.
    console.error(`[upload] failed for user ${user.id}: ${message}`);
    return NextResponse.json({ error: "upload_failed", message }, { status: 500 });
  }
}
