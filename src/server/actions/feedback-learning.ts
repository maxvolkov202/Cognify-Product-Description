"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  feedbackRatings,
  calloutCorrections,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";

export type RatingValue = "nailed_it" | "kinda_off" | "wrong";
export type CalloutVerdict = "wrong" | "not_relevant" | "agree";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Rate an entire rep's feedback. Upserts one rating per (user, rep).
 */
export async function rateFeedbackAction(opts: {
  repId: string;
  rating: RatingValue;
  note?: string;
}): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };

  const note = (opts.note ?? "").slice(0, 1000);

  const ok = await safeDb(async () => {
    // Upsert: delete any existing row first, then insert. Cheap since the
    // query is always against the composite key and the table is small.
    await db
      .delete(feedbackRatings)
      .where(
        and(
          eq(feedbackRatings.userId, user.id),
          eq(feedbackRatings.repId, opts.repId),
        ),
      );
    await db.insert(feedbackRatings).values({
      userId: user.id,
      repId: opts.repId,
      rating: opts.rating,
      note: note || null,
    });
    return true;
  }, false);

  if (!ok) return { ok: false, error: "db_unavailable" };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Flag or edit a specific callout. Upserts one correction per (user, callout).
 */
export async function correctCalloutAction(opts: {
  calloutId: string;
  verdict: CalloutVerdict;
  correctedQuote?: string;
  correctedRewrite?: string;
}): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };

  const quote = (opts.correctedQuote ?? "").slice(0, 500);
  const rewrite = (opts.correctedRewrite ?? "").slice(0, 500);

  const ok = await safeDb(async () => {
    await db
      .delete(calloutCorrections)
      .where(
        and(
          eq(calloutCorrections.userId, user.id),
          eq(calloutCorrections.calloutId, opts.calloutId),
        ),
      );
    await db.insert(calloutCorrections).values({
      userId: user.id,
      calloutId: opts.calloutId,
      verdict: opts.verdict,
      correctedQuote: quote || null,
      correctedRewrite: rewrite || null,
    });
    return true;
  }, false);

  if (!ok) return { ok: false, error: "db_unavailable" };
  return { ok: true };
}
