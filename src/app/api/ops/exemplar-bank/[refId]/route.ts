import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import {
  demoteExemplar,
  updateExemplarNotes,
} from "@/lib/db/queries/exemplar-bank";

export const runtime = "nodejs";

const patchSchema = z.object({
  notes: z.string().max(1000).nullable(),
});

/** DELETE /api/ops/exemplar-bank/[refId] — demote (hard-delete) an exemplar. */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ refId: string }> },
) {
  const { refId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 60,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 },
    );
  }

  await demoteExemplar(refId);
  return NextResponse.json({ ok: true, refId });
}

/** PATCH /api/ops/exemplar-bank/[refId] — update notes. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ refId: string }> },
) {
  const { refId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 120,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  await updateExemplarNotes(refId, parsed.data.notes);
  return NextResponse.json({ ok: true, refId });
}
