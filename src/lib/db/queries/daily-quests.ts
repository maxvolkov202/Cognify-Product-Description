/**
 * Daily quests data layer — DNA Ch.9d.
 *
 * Reads + upserts the user's per-day quest state. The actual quest
 * picking + check logic lives in `src/lib/engagement/quests.ts` —
 * this module is the storage seam.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyQuests } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import {
  pickQuestsForDay,
  type Quest,
} from "@/lib/engagement/quests";

export type TodaysQuestsState = {
  questDate: string;
  quests: Quest[];
  completedIds: Set<string>;
};

export function ymdUtc(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Read or create today's quests for the user. Idempotent — first call
 *  per day inserts; subsequent calls read the existing row. */
export async function getOrCreateTodayQuests(
  userId: string,
  now: Date = new Date(),
): Promise<TodaysQuestsState> {
  const date = ymdUtc(now);
  const fallback: TodaysQuestsState = {
    questDate: date,
    quests: pickQuestsForDay(userId, date),
    completedIds: new Set(),
  };

  return safeDb<TodaysQuestsState>(async () => {
    // Read first.
    const [existing] = await db
      .select({
        questDate: dailyQuests.questDate,
        quests: dailyQuests.quests,
        completion: dailyQuests.completion,
      })
      .from(dailyQuests)
      .where(
        and(eq(dailyQuests.userId, userId), eq(dailyQuests.questDate, date)),
      )
      .limit(1);

    if (existing) {
      const ids = (existing.quests as { id: string }[]).map((q) => q.id);
      // Hydrate Quest objects from ids — definitions live in code,
      // ids are the stable storage key.
      const quests = ids.map((id) => {
        const q = pickQuestsForDay(userId, date).find((qq) => qq.id === id);
        return q;
      }).filter((q): q is Quest => q != null);

      const completion = (existing.completion ?? {}) as {
        completedIds?: string[];
      };
      return {
        questDate: existing.questDate as string,
        quests,
        completedIds: new Set(completion.completedIds ?? []),
      };
    }

    // Insert today's set.
    const picks = pickQuestsForDay(userId, date);
    await db.insert(dailyQuests).values({
      userId,
      questDate: date,
      quests: picks.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        bonusXp: q.bonusXp,
      })),
      completion: {},
    });
    return {
      questDate: date,
      quests: picks,
      completedIds: new Set(),
    };
  }, fallback);
}

/** Mark quest ids as completed for today. Adds to the existing set;
 *  caller passes only NEWLY completed ids so we don't over-write the
 *  total. Also bumps updatedAt. */
export async function markQuestsCompleted(
  userId: string,
  date: string,
  newlyCompletedIds: readonly string[],
  bonusXp: number,
): Promise<void> {
  if (newlyCompletedIds.length === 0) return;
  await safeDb<void>(async () => {
    await db.execute(sql`
      UPDATE cognify_v2.daily_quests
      SET
        completion = COALESCE(completion, '{}'::jsonb) || jsonb_build_object(
          'completedIds',
            COALESCE(completion->'completedIds', '[]'::jsonb) ||
            ${sql`${JSON.stringify(newlyCompletedIds)}::jsonb`},
          'xpEarnedToday',
            COALESCE((completion->>'xpEarnedToday')::int, 0) + ${bonusXp}
        ),
        updated_at = now()
      WHERE user_id = ${userId}::uuid AND quest_date = ${date}::date
    `);
  }, undefined);
}
