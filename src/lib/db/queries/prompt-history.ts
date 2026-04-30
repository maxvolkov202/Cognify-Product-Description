import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userPromptHistory } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

/**
 * Per-user prompt history query helpers. The picker uses these to filter
 * already-seen prompts out of the candidate pool so daily users keep
 * seeing fresh material across sessions.
 *
 * "Seen" means the user actually started a rep on that prompt — not just
 * that it appeared in a slate. Refresh-without-pick should not burn the
 * bank; that's the contract.
 */

/**
 * All prompt ids this user has ever picked. Used by the picker to build
 * the exclusion set on workout-page mount.
 *
 * The list will grow unboundedly over a long-time user's lifecycle, but
 * the actual cap is the size of the prompt corpus (currently ~296,
 * post-expansion ~1500). At ~30 bytes per id, even a max-saturated user
 * is well under 50KB on the wire — fine for a one-shot fetch.
 */
export async function getSeenPromptIds(userId: string): Promise<string[]> {
  return safeDb<string[]>(async () => {
    const rows = await db
      .select({ promptId: userPromptHistory.promptId })
      .from(userPromptHistory)
      .where(eq(userPromptHistory.userId, userId));
    return rows.map((r) => r.promptId);
  }, []);
}

/**
 * Filter a list of candidate ids down to the subset this user has
 * already seen. Convenience for the picker when it has a working set
 * smaller than the user's full history (e.g. just the current rep
 * type's bank).
 */
export async function filterSeenIds(
  userId: string,
  candidateIds: readonly string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  return safeDb<Set<string>>(async () => {
    const rows = await db
      .select({ promptId: userPromptHistory.promptId })
      .from(userPromptHistory)
      .where(
        and(
          eq(userPromptHistory.userId, userId),
          inArray(userPromptHistory.promptId, [...candidateIds]),
        ),
      );
    return new Set(rows.map((r: { promptId: string }) => r.promptId));
  }, new Set());
}

/**
 * Record that a user picked this prompt for a rep. Upsert that bumps
 * `seen_count` and `last_seen_at` if the row already exists. No-op when
 * the database isn't configured (guest mode / dev without DATABASE_URL).
 */
export async function recordPromptSeen(
  userId: string,
  promptId: string,
): Promise<void> {
  await safeDb<void>(async () => {
    await db
      .insert(userPromptHistory)
      .values({ userId, promptId })
      .onConflictDoUpdate({
        target: [userPromptHistory.userId, userPromptHistory.promptId],
        set: {
          seenCount: sql`${userPromptHistory.seenCount} + 1`,
          lastSeenAt: sql`now()`,
        },
      });
  }, undefined);
}
