import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "@/lib/session/current-user";
import { db } from "@/lib/db/client";
import { bugReports } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/db/queries/user";
import { deleteBugScreenshots } from "@/lib/bug-reports/storage";

const PatchSchema = z.object({
  status: z
    .enum(["open", "in_progress", "fixed", "wontfix", "duplicate"])
    .optional(),
  resolutionNote: z.string().max(2000).optional(),
});

async function requireOperator() {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const profile = await getUserProfile(user.id);
  if (!profile?.isOperator) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, profile };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperator();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Partial<typeof bugReports.$inferInsert> = {};
  if (parsed.data.status) {
    updates.status = parsed.data.status;
    const isResolution =
      parsed.data.status === "fixed" ||
      parsed.data.status === "wontfix" ||
      parsed.data.status === "duplicate";
    updates.resolvedAt = isResolution ? new Date() : null;
    updates.resolvedBy = isResolution ? auth.user.id : null;
  }
  if (parsed.data.resolutionNote !== undefined) {
    updates.resolutionNote = parsed.data.resolutionNote || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await db.update(bugReports).set(updates).where(eq(bugReports.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperator();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const [row] = await db
    .select({ imagePaths: bugReports.imagePaths })
    .from(bugReports)
    .where(eq(bugReports.id, id))
    .limit(1);

  await db.delete(bugReports).where(eq(bugReports.id, id));

  if (row?.imagePaths && row.imagePaths.length > 0) {
    await deleteBugScreenshots(row.imagePaths).catch(() => {
      // Storage cleanup is best-effort — the row is gone either way.
    });
  }

  return NextResponse.json({ ok: true });
}
