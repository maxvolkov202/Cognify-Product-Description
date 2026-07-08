// PATCH /api/me/tz
//
// First-launch (and best-effort thereafter) IANA timezone capture for
// the authenticated user. The muscle-group day-rollover cron reads
// users.tz to compute each user's local-midnight boundary; without
// this endpoint every user defaults to UTC and the cron misfires day
// boundaries for non-UTC users by up to ~24h.
//
// Auth: required (auth or guest). Anonymous callers get 401.
// Idempotent: same value → no-op. Different value → updated.

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hasDatabase } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { isValidIana } from "@/lib/timezones/iana";

export const runtime = "nodejs";

const bodySchema = z.object({
  tz: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidIana, { message: "Not a valid IANA timezone." }),
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

  const [existing] = await db
    .select({ tz: users.tz })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (existing?.tz === parsed.tz) {
    return NextResponse.json({ ok: true, persisted: false, tz: parsed.tz });
  }

  await db.update(users).set({ tz: parsed.tz }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true, persisted: true, tz: parsed.tz });
}
