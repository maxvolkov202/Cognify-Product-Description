import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";
import { promoteRepToExemplar } from "@/lib/db/queries/exemplar-bank";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 30;

const promoteSchema = z.object({
  repId: z.string().uuid(),
  notes: z.string().max(1000).optional().nullable(),
  band: z.string().max(40).optional(),
});

/** POST /api/ops/exemplar-bank
 *
 *  Promote a real production rep into cognify_v2.reference_reps so it
 *  participates in Stage 2 few-shot exemplar retrieval. Embeds the
 *  rep's transcript via OpenAI text-embedding-3-small and inserts a
 *  row with ref_id="promo-<repId>". Idempotent: re-promotion updates
 *  the existing row in place.
 *
 *  Operator-only. Rate-limited 30/min/operator (cheap embedding cost,
 *  not a DoS vector, but a high enough cap to keep accidents bounded). */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many promotions. Wait a moment." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = promoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  try {
    const result = await promoteRepToExemplar({
      repId: parsed.data.repId,
      promotedBy: me.id,
      notes: parsed.data.notes ?? null,
      band: parsed.data.band,
    });
    return NextResponse.json({
      ok: true,
      refId: result.refId,
      created: result.created,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "promotion_failed";
    log.error({
      event: "ops.exemplar_bank.promote_failed",
      err: serializeErr(err),
    });
    return NextResponse.json(
      { error: "promotion_failed", message: msg.slice(0, 500) },
      { status: 500 },
    );
  }
}
