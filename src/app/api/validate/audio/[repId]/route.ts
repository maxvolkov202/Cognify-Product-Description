import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reps } from "@/lib/db/schema";
import { hasDatabase } from "@/lib/db/safe";
import { getAudioSignedUrl } from "@/lib/audio/upload";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repId: string }> },
) {
  const { repId } = await params;
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "Database not configured." },
      { status: 503 },
    );
  }
  try {
    const rep = await db.query.reps.findFirst({
      where: eq(reps.id, repId),
    });
    if (!rep?.audioUrl) {
      return NextResponse.json(
        { error: "not_found", message: "Rep audio not available." },
        { status: 404 },
      );
    }
    // reps.audioUrl stores the Supabase Storage path. Generate a fresh
    // signed URL on each request (short-lived, safer than persisting one).
    const signedUrl = await getAudioSignedUrl(rep.audioUrl);
    if (!signedUrl) {
      return NextResponse.json(
        { error: "sign_failed", message: "Could not sign audio URL." },
        { status: 500 },
      );
    }
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio lookup failed.";
    return NextResponse.json({ error: "lookup_failed", message }, { status: 500 });
  }
}
