import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { prepContextUploads, prepEvents } from "@/lib/db/schema";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import { isBuildARepV2Enabled } from "@/lib/flags";
import { getBuildARepEntitlement } from "@/lib/entitlements";
import {
  parseContextFile,
  PREP_UPLOAD_MAX_BYTES,
} from "@/lib/prep/parse";
import {
  uploadPrepContextFile,
  deletePrepContextFiles,
} from "@/lib/prep/storage";

// PRD v3 Phase 5 — Build a Rep context uploads (PRD §7.4).
// POST multipart { eventId, file } → store raw file + parsed text.
// DELETE ?id=<uploadId> → remove upload + storage object.
// Parsing is best-effort: an unparseable file is recorded as failed /
// unsupported and never blocks the flow.

export const runtime = "nodejs";
export const maxDuration = 120;

/** Cached concat of parsed uploads on the event row (mirrors
 *  prep-events.ts CONTEXT_SUMMARY_CAP). */
const CONTEXT_SUMMARY_CAP = 8000;

async function gate() {
  if (!isBuildARepV2Enabled()) {
    return {
      response: NextResponse.json({ error: "flag_off" }, { status: 404 }),
    };
  }
  const user = await currentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "auth_required" }, { status: 401 }),
    };
  }
  const ent = getBuildARepEntitlement(user.id);
  if (!ent.allowed) {
    return {
      response: NextResponse.json(
        { error: "premium_required" },
        { status: 403 },
      ),
    };
  }
  return { user };
}

async function refreshContextSummary(eventId: string): Promise<void> {
  const rows = await db
    .select({
      fileName: prepContextUploads.fileName,
      parsedText: prepContextUploads.parsedText,
    })
    .from(prepContextUploads)
    .where(
      and(
        eq(prepContextUploads.eventId, eventId),
        eq(prepContextUploads.parseStatus, "parsed"),
      ),
    )
    .orderBy(asc(prepContextUploads.createdAt));
  const combined = rows
    .filter((r) => r.parsedText)
    .map((r) => `=== ${r.fileName} ===\n${r.parsedText}`)
    .join("\n\n");
  await db
    .update(prepEvents)
    .set({
      contextSummary:
        combined.length > 0 ? combined.slice(0, CONTEXT_SUMMARY_CAP) : null,
      updatedAt: new Date(),
    })
    .where(eq(prepEvents.id, eventId));
}

export async function POST(req: Request) {
  const g = await gate();
  if ("response" in g) return g.response;
  const user = g.user;

  const rl = await rateLimit(`user:${user.id}:prep-context`, {
    count: 20,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const eventId = formData.get("eventId");
    const file = formData.get("file");
    if (typeof eventId !== "string" || !(file instanceof File)) {
      return NextResponse.json(
        { error: "missing_fields", message: "Expected 'eventId' and 'file'." },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "empty_file" }, { status: 400 });
    }
    if (file.size > PREP_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: "file_too_large",
          message: `Files must be under ${Math.round(PREP_UPLOAD_MAX_BYTES / 1024 / 1024)}MB.`,
        },
        { status: 413 },
      );
    }

    // Ownership check — uploads only attach to the caller's events.
    const [event] = await db
      .select({ id: prepEvents.id })
      .from(prepEvents)
      .where(and(eq(prepEvents.id, eventId), eq(prepEvents.userId, user.id)))
      .limit(1);
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const parsed = await parseContextFile(buffer, file.type || null, safeName);

    let storagePath: string | null = null;
    try {
      const stored = await uploadPrepContextFile(
        `${user.id}/${eventId}/${randomUUID()}-${safeName}`,
        buffer,
        file.type || "application/octet-stream",
      );
      storagePath = stored.path;
    } catch {
      // Raw-file storage is best-effort; the parsed text is what the
      // generation pipeline actually uses.
    }

    const [row] = await db
      .insert(prepContextUploads)
      .values({
        eventId,
        userId: user.id,
        fileName: safeName,
        mimeType: file.type || null,
        sizeBytes: file.size,
        storagePath,
        parseStatus: parsed.status,
        parsedChars: parsed.text?.length ?? null,
        parsedText: parsed.text,
      })
      .returning({ id: prepContextUploads.id });

    if (parsed.status === "parsed") {
      await refreshContextSummary(eventId);
    }

    return NextResponse.json({
      id: row?.id,
      fileName: safeName,
      parseStatus: parsed.status,
      parsedChars: parsed.text?.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json(
      { error: "upload_failed", message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const g = await gate();
  if ("response" in g) return g.response;
  const user = g.user;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  try {
    const [row] = await db
      .select({
        id: prepContextUploads.id,
        eventId: prepContextUploads.eventId,
        storagePath: prepContextUploads.storagePath,
      })
      .from(prepContextUploads)
      .where(
        and(
          eq(prepContextUploads.id, id),
          eq(prepContextUploads.userId, user.id),
        ),
      )
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await db.delete(prepContextUploads).where(eq(prepContextUploads.id, row.id));
    if (row.storagePath) await deletePrepContextFiles([row.storagePath]);
    await refreshContextSummary(row.eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json(
      { error: "delete_failed", message },
      { status: 500 },
    );
  }
}
