import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/audio/transcribe";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";

export const runtime = "nodejs";
export const maxDuration = 60;

// Allowed mime prefixes. Deepgram accepts any audio/* but we want to reject
// non-audio uploads (e.g. a renamed .exe). Loose-prefix check — keep in sync
// with the codec list MediaRecorder produces on the client.
const ALLOWED_AUDIO_PREFIXES = ["audio/"];

export async function POST(req: Request) {
  // Auth: require a user (auth or guest cookie). Anonymous curl/script
  // callers without the middleware-issued guest cookie get 401. This
  // closes the open-internet Deepgram billing endpoint that previously
  // only rate-limited by IP.
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }

  // Rate-limit by user.id — far stricter than IP-keyed (NATs share IPs).
  const rl = await rateLimit(`user:${user.id}:transcribe`, {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many transcription requests. Wait a moment and try again.",
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
    if (!ALLOWED_AUDIO_PREFIXES.some((p) => mime.startsWith(p))) {
      return NextResponse.json(
        { error: "unsupported_mime", message: "Audio mime type required." },
        { status: 415 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await transcribeAudio(buffer, mime);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: "transcription_failed", message }, { status: 500 });
  }
}
