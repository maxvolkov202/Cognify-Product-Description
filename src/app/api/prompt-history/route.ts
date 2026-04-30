import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session/current-user";
import {
  getSeenPromptIds,
  recordPromptSeen,
} from "@/lib/db/queries/prompt-history";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * GET /api/prompt-history
 *
 * Returns the user's full list of seen prompt ids. Called once on
 * workout-page mount; the client builds an exclusion set from this and
 * passes it to the picker.
 *
 * Returns `{ ids: [] }` for unauthenticated users — the picker treats an
 * empty exclusion set as "no filtering," which is the correct behavior
 * for guests with no history yet.
 */
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ids: [] });
  const ids = await getSeenPromptIds(user.id);
  return NextResponse.json({ ids });
}

const postSchema = z.object({
  promptId: z.string().min(1).max(120),
});

/**
 * POST /api/prompt-history { promptId }
 *
 * Records that the user picked this prompt for a rep. Idempotent —
 * repeat calls bump seen_count and last_seen_at via upsert.
 *
 * Fired client-side at the moment a rep starts (not at slate render),
 * so refresh-without-pick doesn't burn the bank.
 */
export async function POST(req: Request): Promise<Response> {
  const rl = await rateLimit(getRateLimitIdentifier(req), {
    count: 60,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests." },
      { status: 429 },
    );
  }

  const user = await currentUser();
  if (!user) {
    // No-op for unauthenticated callers. Returning 200 keeps the client
    // path simple — it can fire-and-forget without branching on auth.
    return NextResponse.json({ ok: true, recorded: false });
  }

  let promptId: string;
  try {
    const json = await req.json();
    const parsed = postSchema.parse(json);
    promptId = parsed.promptId;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_input", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "invalid_input", message: "Bad request body" },
      { status: 400 },
    );
  }

  await recordPromptSeen(user.id, promptId);
  return NextResponse.json({ ok: true, recorded: true });
}
