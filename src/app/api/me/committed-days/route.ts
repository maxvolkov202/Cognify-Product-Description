// PATCH /api/me/committed-days
//
// Phase C — update the user's weekly training schedule. Stored as a
// 7-bit bitmask (Mon=0..Sun=6). The picker, streak math, and
// weakness-day scheduler all read this column.
//
// Auth: required. Anonymous → 401.
// Idempotent: same value → no-op.

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hasDatabase } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import {
  assertValidMask,
  committedDayCount,
  MIN_COMMITTED_DAYS,
} from "@/lib/onboarding/committed-days";

export const runtime = "nodejs";

const bodySchema = z.object({
  committedDays: z.number().int().min(0).max(127),
});

export async function PATCH(req: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_input", details: err.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Validate against the canon — at least MIN_COMMITTED_DAYS bits set.
  try {
    assertValidMask(parsed.committedDays);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_committed_days",
        message:
          err instanceof Error
            ? err.message
            : `Pick at least ${MIN_COMMITTED_DAYS} days.`,
      },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ committedDays: users.committedDays })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (existing?.committedDays === parsed.committedDays) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      committedDays: parsed.committedDays,
      count: committedDayCount(parsed.committedDays),
    });
  }

  await db
    .update(users)
    .set({ committedDays: parsed.committedDays })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    ok: true,
    persisted: true,
    committedDays: parsed.committedDays,
    count: committedDayCount(parsed.committedDays),
  });
}
