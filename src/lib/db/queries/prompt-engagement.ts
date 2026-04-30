import { desc, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { promptEngagement } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

export type PromptEngagementRow = {
  promptId: string;
  shownCount: number;
  pickedCount: number;
  refreshedPastCount: number;
  firstSeenAt: Date;
  lastEventAt: Date;
};

export type PromptQualityScore = PromptEngagementRow & {
  /** picked / shown — 0..1. Higher is better. */
  pickRate: number;
  /** refreshed_past / shown — 0..1. Higher is worse. */
  refreshRate: number;
  /** Combined quality. Pick rate is the headline; refresh rate
   *  subtracts. Range roughly -1 .. 1. Above 0 is engaging; below -0.2
   *  is a candidate for replacement. */
  quality: number;
};

const MIN_SHOWN_FOR_RANKING = 10;

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

/** Score one engagement row. Pure function — no DB call. */
export function computeQualityScore(
  row: PromptEngagementRow,
): PromptQualityScore {
  const shown = row.shownCount;
  const pickRate = shown > 0 ? row.pickedCount / shown : 0;
  const refreshRate = shown > 0 ? row.refreshedPastCount / shown : 0;
  // Pick rate carries; refresh rate is a multiplier on the negative
  // side so two rejections weigh the same as one pick. Empirical tune
  // when real data lands.
  const quality = pickRate - refreshRate;
  return { ...row, pickRate, refreshRate, quality };
}

/**
 * All prompts with at least MIN_SHOWN_FOR_RANKING shown events,
 * ordered by quality score. Powers the operator-facing prompt-quality
 * view. Floor on shown count keeps the list useful — a prompt seen
 * once and refreshed-past once shouldn't dominate the worst-quality
 * pile when the signal is N=1.
 */
export async function getRankedPromptEngagement(
  opts: { limit?: number } = {},
): Promise<PromptQualityScore[]> {
  const limit = opts.limit ?? 200;
  return safeDb<PromptQualityScore[]>(async () => {
    const rows = await db
      .select({
        promptId: promptEngagement.promptId,
        shownCount: promptEngagement.shownCount,
        pickedCount: promptEngagement.pickedCount,
        refreshedPastCount: promptEngagement.refreshedPastCount,
        firstSeenAt: promptEngagement.firstSeenAt,
        lastEventAt: promptEngagement.lastEventAt,
      })
      .from(promptEngagement)
      .where(gt(promptEngagement.shownCount, MIN_SHOWN_FOR_RANKING - 1))
      .orderBy(desc(promptEngagement.shownCount))
      .limit(limit);
    return rows
      .map(computeQualityScore)
      .sort((a, b) => a.quality - b.quality);
  }, []);
}

/** Aggregate counts across the whole bank — for the dashboard summary. */
export async function getEngagementSummary(): Promise<{
  totalPrompts: number;
  totalShown: number;
  totalPicked: number;
  totalRefreshedPast: number;
}> {
  return safeDb(
    async () => {
      const rows = await db
        .select({
          totalPrompts: sql<number>`count(*)::int`,
          totalShown: sql<number>`coalesce(sum(${promptEngagement.shownCount}), 0)::int`,
          totalPicked: sql<number>`coalesce(sum(${promptEngagement.pickedCount}), 0)::int`,
          totalRefreshedPast: sql<number>`coalesce(sum(${promptEngagement.refreshedPastCount}), 0)::int`,
        })
        .from(promptEngagement);
      return (
        rows[0] ?? {
          totalPrompts: 0,
          totalShown: 0,
          totalPicked: 0,
          totalRefreshedPast: 0,
        }
      );
    },
    {
      totalPrompts: 0,
      totalShown: 0,
      totalPicked: 0,
      totalRefreshedPast: 0,
    },
  );
}
