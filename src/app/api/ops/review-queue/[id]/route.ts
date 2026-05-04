import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { submitReview } from "@/lib/db/queries/review-queue";

export const runtime = "nodejs";

const submitSchema = z.object({
  verdict: z.enum([
    "confirmed_accurate",
    "should_be_lower",
    "should_be_higher",
    "skipped",
  ]),
  correctedComposite: z.number().int().min(0).max(100).optional().nullable(),
  correctedPerDim: z.record(z.string(), z.number().int().min(0).max(100)).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: repId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  const insertedId = await submitReview({
    repId,
    reviewerUserId: me.id,
    verdict: parsed.data.verdict,
    correctedComposite: parsed.data.correctedComposite ?? null,
    correctedPerDim: parsed.data.correctedPerDim ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (!insertedId) {
    return NextResponse.json(
      { error: "insert_failed", message: "Could not persist review (DB unavailable or duplicate)" },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: insertedId, repId });
}
