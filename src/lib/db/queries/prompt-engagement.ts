import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { promptEngagement } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

/**
 * Aggregate engagement counters for the prompt-evolution loop.
 *
 * Why aggregate-only (no per-event log): the evolution analysis only
 * needs counts. An events-table costs ~10x more storage and offers
 * slicing we don't need yet (per-day pick rate, cohort cuts). YAGNI —
 * if a deeper question shows up, add the events table then; the
 * aggregate is forward-compatible with that addition.
 */

type Counter = "shownCount" | "pickedCount" | "refreshedPastCount";

const COLUMN_BY_COUNTER: Record<Counter, ReturnType<typeof sql>> = {
  shownCount: sql.raw("shown_count"),
  pickedCount: sql.raw("picked_count"),
  refreshedPastCount: sql.raw("refreshed_past_count"),
};

/**
 * Bulk increment one counter for a list of prompt ids. Used by:
 *   - shown:           on slate render
 *   - refreshed_past:  on Refresh click (the previously-shown ids)
 *   - picked:          on rep-start (called from recordPromptSeen)
 *
 * Single round-trip via `unnest(...)` so a slate of 5 doesn't fan out
 * into 5 separate inserts. Upsert semantics (`ON CONFLICT … DO UPDATE`)
 * so the row gets created on first encounter and bumped on every
 * subsequent one.
 */
export async function bumpEngagement(
  promptIds: readonly string[],
  counter: Counter,
): Promise<void> {
  if (promptIds.length === 0) return;
  const column = COLUMN_BY_COUNTER[counter];
  const idArray = sql`ARRAY[${sql.join(
    promptIds.map((id) => sql`${id}`),
    sql`, `,
  )}]::text[]`;
  await safeDb<void>(async () => {
    await db.execute(sql`
      INSERT INTO cognify_v2.prompt_engagement (prompt_id, ${column}, last_event_at)
      SELECT id, 1, now()
      FROM unnest(${idArray}) AS t(id)
      ON CONFLICT (prompt_id) DO UPDATE SET
        ${column} = cognify_v2.prompt_engagement.${column} + 1,
        last_event_at = now()
    `);
  }, undefined);
}

/** Convenience wrappers — clearer at the call site than passing a string. */
export async function recordPromptsShown(
  promptIds: readonly string[],
): Promise<void> {
  await bumpEngagement(promptIds, "shownCount");
}

export async function recordPromptsRefreshedPast(
  promptIds: readonly string[],
): Promise<void> {
  await bumpEngagement(promptIds, "refreshedPastCount");
}

export async function recordPromptPicked(promptId: string): Promise<void> {
  await bumpEngagement([promptId], "pickedCount");
}
