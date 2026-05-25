import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { uploadAudio } from "@/lib/audio/upload";
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
    const mime = file.type || "audio/webm";
    if (!mime.startsWith("audio/")) {
      return NextResponse.json(
        { error: "unsupported_mime", message: "Audio mime type required." },
        { status: 415 },
      );
    }
    const extension =
      mime.includes("webm") ? "webm" :
      mime.includes("ogg") ? "ogg" :
      mime.includes("mp4") ? "mp4" :
      mime.includes("mpeg") ? "mp3" :
      mime.includes("wav") ? "wav" :
      "bin";
    // Namespace under the user id so blob-storage cleanup + per-user
    // accounting are tractable.
    const key = `reps/${user.id}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAudio(key, buffer, mime);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: "upload_failed", message }, { status: 500 });
  }
}
