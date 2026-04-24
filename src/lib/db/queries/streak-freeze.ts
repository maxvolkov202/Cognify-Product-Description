import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, reps } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

/**
 * Streak-freeze mechanics (habit engine, WS-10).
 *
 * Users earn +1 freeze every 7 consecutive days of reps. Cap at 3 banked.
 * When the raw streak would have broken because of a single missed day,
 * we consume one freeze and treat the missed day as attended for the
 * purpose of continuity.
 *
 * Rules:
 *   - Earn: triggered when raw streak hits a multiple of 7 (7, 14, 21…).
 *     Awarded only once per threshold — tracked via `streak_freezes` cap.
 *   - Spend: auto-applied in `getStreakDaysWithFreeze` when exactly one
 *     day is missing between today/yesterday and the prior rep day.
 *   - Cap: 3 banked freezes at a time. Any additional earnings are
 *     discarded (no "credits" accumulate for super-long streaks).
 */

const FREEZE_CAP = 3;

export type StreakStatus = {
  /** Streak in days, with freezes applied as attended days. */
  streakDays: number;
  /** Raw streak (no freezes) — for auditing. */
  rawStreakDays: number;
  /** Banked freezes available to the user right now. */
  freezesAvailable: number;
  /** True if today OR yesterday had a rep (common grace window). */
  activeToday: boolean;
  /** If a freeze was auto-applied to preserve continuity, this records
   *  the date it covered (YYYY-MM-DD). Null otherwise. */
  appliedFreezeDate: string | null;
};

export async function getStreakStatus(userId: string): Promise<StreakStatus> {
  return safeDb(async () => {
    const rows = await db
      .select({
        date: sql<string>`to_char(${reps.createdAt}, 'YYYY-MM-DD')`,
      })
      .from(reps)
      .where(eq(reps.userId, userId))
      .groupBy(sql`to_char(${reps.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${reps.createdAt}, 'YYYY-MM-DD') DESC`);

    const [user] = await db
      .select({ freezes: users.streakFreezes })
      .from(users)
      .where(eq(users.id, userId));
    const freezes = user?.freezes ?? 0;

    if (rows.length === 0) {
      return {
        streakDays: 0,
        rawStreakDays: 0,
        freezesAvailable: freezes,
        activeToday: false,
        appliedFreezeDate: null,
      };
    }

    const dates = rows.map((r) => r.date);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const activeToday = dates[0] === today;

    // Break-out path — streak only counts if we have a rep today or yesterday.
    if (dates[0] !== today && dates[0] !== yesterday) {
      return {
        streakDays: 0,
        rawStreakDays: 0,
        freezesAvailable: freezes,
        activeToday: false,
        appliedFreezeDate: null,
      };
    }

    let streak = 1;
    let appliedFreezeDate: string | null = null;
    let freezesLeft = freezes;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]!);
      const curr = new Date(dates[i]!);
      const diff = (prev.getTime() - curr.getTime()) / 86_400_000;
      if (diff === 1) {
        streak++;
      } else if (diff === 2 && freezesLeft > 0 && !appliedFreezeDate) {
        // Use ONE freeze to bridge a single-day gap. Only honor the first
        // such gap per streak — stacking freezes would defeat the point.
        freezesLeft--;
        appliedFreezeDate = new Date(prev.getTime() - 86_400_000)
          .toISOString()
          .slice(0, 10);
        streak += 2;
      } else {
        break;
      }
    }

    // Raw streak (no freezes applied) — useful for the UI delta display.
    let rawStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]!);
      const curr = new Date(dates[i]!);
      const diff = (prev.getTime() - curr.getTime()) / 86_400_000;
      if (diff === 1) rawStreak++;
      else break;
    }

    return {
      streakDays: streak,
      rawStreakDays: rawStreak,
      freezesAvailable: freezesLeft,
      activeToday,
      appliedFreezeDate,
    };
  }, {
    streakDays: 0,
    rawStreakDays: 0,
    freezesAvailable: 0,
    activeToday: false,
    appliedFreezeDate: null,
  });
}

/**
 * Award a streak freeze to the user — capped at FREEZE_CAP. Returns the
 * new freeze count. No-ops (returns current count) if the user already
 * has the max.
 */
export async function awardStreakFreeze(userId: string): Promise<number> {
  return safeDb(async () => {
    const [user] = await db
      .select({ freezes: users.streakFreezes })
      .from(users)
      .where(eq(users.id, userId));
    const current = user?.freezes ?? 0;
    if (current >= FREEZE_CAP) return current;
    const next = current + 1;
    await db
      .update(users)
      .set({ streakFreezes: next })
      .where(eq(users.id, userId));
    return next;
  }, 0);
}

/**
 * Consume one freeze. Used when a freeze has been applied to preserve a
 * streak. Returns remaining count.
 */
export async function consumeStreakFreeze(userId: string): Promise<number> {
  return safeDb(async () => {
    const res = await db
      .update(users)
      .set({
        streakFreezes: sql`GREATEST(${users.streakFreezes} - 1, 0)`,
      })
      .where(and(eq(users.id, userId), sql`${users.streakFreezes} > 0`))
      .returning({ freezes: users.streakFreezes });
    return res[0]?.freezes ?? 0;
  }, 0);
}

export const STREAK_FREEZE_CAP = FREEZE_CAP;
