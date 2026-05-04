import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import {
  loadReferenceBank,
  uploadReferenceRepAudio,
  getReferenceRepAudioStatus,
} from "@/lib/calibration/reference-bank";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

async function requireOperator() {
  const me = await currentUser();
  if (!me) return null;
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) return null;
  return me;
}

function findRep(id: string) {
  const bank = loadReferenceBank();
  return bank.reps.find((r) => r.id === id) ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const op = await requireOperator();
  if (!op) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rep = findRep(id);
  if (!rep) {
    return NextResponse.json({ error: "rep_not_found", id }, { status: 404 });
  }
  const status = await getReferenceRepAudioStatus(id);
  return NextResponse.json({ id, status });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const op = await requireOperator();
  if (!op) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Defense in depth: even though operator-gated, a compromised op
  // account shouldn't be able to flood Supabase storage. 30 uploads
  // per minute is well above intended use.
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many uploads. Wait a moment." },
      { status: 429 },
    );
  }
  const rep = findRep(id);
  if (!rep) {
    return NextResponse.json({ error: "rep_not_found", id }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "bad_form", message: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

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
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "Audio must be under 25MB." },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const status = await uploadReferenceRepAudio({
      repId: id,
      audio: buffer,
      mimeType: file.type || "audio/webm",
    });
    return NextResponse.json({ id, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json(
      { error: "upload_failed", message },
      { status: 500 },
    );
  }
}
