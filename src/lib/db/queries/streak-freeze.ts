import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, reps } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import {
  DEFAULT_COMMITTED_DAYS,
  isDateCommitted,
} from "@/lib/onboarding/committed-days";
import { todayYmdInTz, ymdToUtcMidnight } from "@/lib/time/user-day";

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
    const [user] = await db
      .select({
        freezes: users.streakFreezes,
        committedDays: users.committedDays,
        tz: users.tz,
      })
      .from(users)
      .where(eq(users.id, userId));
    const freezes = user?.freezes ?? 0;
    // Phase C — committed-days streak. Only days the user signed up to
    // train count as "expected" rep days. Missing a non-committed day
    // (their rest day) doesn't break the streak — the point of the
    // habit is to honor what you committed to, not perfect daily reps.
    const committedDays = user?.committedDays ?? DEFAULT_COMMITTED_DAYS;
    // CTO review B-4 — bucket reps by user-local date and pull "today"
    // from the same TZ. Server defaults to UTC; users.tz is populated
    // by TimezoneDetector on first authenticated visit. Pre-detect
    // users stay on UTC (no behavior change).
    const tz = user?.tz ?? "UTC";

    // GROUP/ORDER BY select position, NOT a repeated expression: each
    // `${tz}` interpolation binds as its OWN parameter ($1, $2, $3), and
    // Postgres can't prove `AT TIME ZONE $2` equals the selected
    // `AT TIME ZONE $1` — the query 42803-failed on EVERY call and
    // safeDb quietly returned the zero-streak fallback (Phase 12 F-3).
    const rows = await db
      .select({
        date: sql<string>`to_char(${reps.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      })
      .from(reps)
      .where(eq(reps.userId, userId))
      .groupBy(sql`1`)
      .orderBy(sql`1 DESC`);

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
    const repSet = new Set(dates);
    const today = todayYmdInTz(tz);
    const activeToday = repSet.has(today);

    // Helper: walk back from `startDate`, counting consecutive committed
    // days that have a rep. Rest days (non-committed) are skipped
    // without consuming the streak. Returns { streakDays, freezesUsed,
    // appliedFreezeDate }.
    function walkBack(
      startDate: string,
      maxFreezes: number,
    ): { streakDays: number; freezesUsed: number; appliedFreezeDate: string | null } {
      const start = ymdToUtcMidnight(startDate);
      let streak = 0;
      let freezesUsed = 0;
      let appliedFreezeDate: string | null = null;
      // Cap the walk at 365 days to avoid pathological inputs.
      for (let d = 0; d < 365; d++) {
        const dt = new Date(start.getTime() - d * 86_400_000);
        const iso = dt.toISOString().slice(0, 10);
        const isCommitted = isDateCommitted(committedDays, dt, tz);
        const hasRep = repSet.has(iso);
        if (!isCommitted) continue; // rest day — neither counts nor breaks
        if (hasRep) {
          streak++;
          continue;
        }
        // Committed day with no rep — try a freeze, otherwise break.
        if (freezesUsed < maxFreezes && !appliedFreezeDate) {
          freezesUsed++;
          appliedFreezeDate = iso;
          streak++; // freeze covers this committed day
          continue;
        }
        break;
      }
      return { streakDays: streak, freezesUsed, appliedFreezeDate };
    }

    // Anchor the walk at today if rep today, else the most-recent rep
    // date (only if it's "still alive" — last committed day was at most
    // today). If the user missed any committed day between the last rep
    // and today, the streak is broken (the walkBack from today will hit
    // a no-rep committed day before reaching any reps).
    const anchor = activeToday ? today : dates[0]!;
    const isAnchorAlive = (() => {
      const a = ymdToUtcMidnight(anchor);
      const t = ymdToUtcMidnight(today);
      // Walk forward from anchor to today; if any intermediate day is
      // committed-but-not-repped, anchor is dead.
      for (
        let dt = new Date(a.getTime() + 86_400_000);
        dt <= t;
        dt = new Date(dt.getTime() + 86_400_000)
      ) {
        const iso = dt.toISOString().slice(0, 10);
        if (isDateCommitted(committedDays, dt, tz) && !repSet.has(iso)) {
          return false;
        }
      }
      return true;
    })();

    if (!isAnchorAlive) {
      return {
        streakDays: 0,
        rawStreakDays: 0,
        freezesAvailable: freezes,
        activeToday,
        appliedFreezeDate: null,
      };
    }

    const withFreeze = walkBack(today, freezes);
    const raw = walkBack(today, 0);

    return {
      streakDays: withFreeze.streakDays,
      rawStreakDays: raw.streakDays,
      freezesAvailable: freezes - withFreeze.freezesUsed,
      activeToday,
      appliedFreezeDate: withFreeze.appliedFreezeDate,
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
