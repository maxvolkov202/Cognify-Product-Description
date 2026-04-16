import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/audio/transcribe";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Rate limiting — Deepgram is metered, transcripts are ~$0.01/min
  const rl = await rateLimit(getRateLimitIdentifier(req), {
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await transcribeAudio(buffer, file.type || "audio/webm");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: "transcription_failed", message }, { status: 500 });
  }
}
