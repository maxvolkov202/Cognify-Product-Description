/**
 * XP grant logic — Cognify DNA Ch.7.
 *
 * Formula:
 *   xp = base_xp * band_multiplier(composite) * streak_multiplier(streak)
 *   base_xp = 10
 *   band_multiplier:
 *     0-40   → 1.0   ("show up" XP for any completed rep)
 *     40-60  → 1.2
 *     60-75  → 1.5
 *     75-85  → 2.0
 *     85-95  → 3.0
 *     95-100 → 4.0
 *   streak_multiplier:
 *     <3    → 1.0
 *     3-6   → 1.1
 *     7-13  → 1.25
 *     14-29 → 1.4
 *     30-89 → 1.6
 *     90-364→ 1.8
 *     365+  → 2.0
 *
 * Anti-grinding: at most one level-up per UTC day. XP STILL accrues; the
 * level just doesn't tick over a second time. Prevents farming low-quality
 * reps for level-ups; rewards consistent multi-day practice instead.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { levelFromXp, MAX_LEVEL } from "./levels";

export const BASE_XP = 10;

export function bandMultiplier(composite: number): number {
  if (composite < 40) return 1.0;
  if (composite < 60) return 1.2;
  if (composite < 75) return 1.5;
  if (composite < 85) return 2.0;
  if (composite < 95) return 3.0;
  return 4.0;
}

export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 365) return 2.0;
  if (streakDays >= 90) return 1.8;
  if (streakDays >= 30) return 1.6;
  if (streakDays >= 14) return 1.4;
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

export type AwardXpInput = {
  userId: string;
  composite: number;
  /** Current streak in days, computed by the caller (streak system already
   *  computes this on read; pass it in rather than re-querying). */
  streakDays: number;
  /** Optional: comeback bonus. When the user returned after a missed-day
   *  break, the first rep gets ×2 XP. Caller decides when this fires
   *  (Ch.9 streak surfaces own that detection). */
  comebackBonus?: boolean;
  /** Phase D — rest-day bonus. When the user trains on a day that ISN'T
   *  in their committed_days schedule (a "voluntary rep"), reward them
   *  with ×1.5 XP. Stacks multiplicatively with comebackBonus, so a
   *  rest-day comeback rep gets ×3 vs base. Caller computes by checking
   *  `isDateCommitted(committedDays, today) === false`. */
  restDayBonus?: boolean;
  /** Override the "now" timestamp for tests / backfill replays. Defaults
   *  to new Date(). */
  now?: Date;
};

export type AwardXpResult = {
  xpDelta: number;
  newXp: number;
  newLevel: number;
  /** True only on the rep that crossed a level threshold (and only when
   *  the daily anti-grinding cap allowed the level-up). */
  leveledUp: boolean;
  /** Previous level — useful for the celebration UI to show "X → Y." */
  previousLevel: number;
};

/**
 * Compute + apply an XP grant. Updates users.xp / users.level /
 * users.lifetime_reps / users.last_level_up_at in a single statement.
 *
 * Returns a structured result describing the grant; caller surfaces
 * `leveledUp` to fire the celebration.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const {
    userId,
    composite,
    streakDays,
    comebackBonus = false,
    restDayBonus = false,
    now = new Date(),
  } = input;

  const grant = Math.round(
    BASE_XP *
      bandMultiplier(composite) *
      streakMultiplier(streakDays) *
      (comebackBonus ? 2 : 1) *
      (restDayBonus ? 1.5 : 1),
  );

  const fallback: AwardXpResult = {
    xpDelta: grant,
    newXp: 0,
    newLevel: 1,
    leveledUp: false,
    previousLevel: 1,
  };

  return safeDb<AwardXpResult>(async () => {
    // Read the current state so we can compute the level transition
    // ourselves — Postgres expression-only level math is tricky to
    // express across the level curve, and this stays one round-trip
    // anyway via the wrapping transaction.
    const [current] = await db
      .select({
        xp: users.xp,
        level: users.level,
        lastLevelUpAt: users.lastLevelUpAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!current) return fallback;

    const previousLevel = current.level;
    const previousXp = current.xp;
    const newXp = previousXp + grant;
    const computedLevel = levelFromXp(newXp);

    // Anti-grinding: cap at one level-up per UTC day.
    const today = ymd(now);
    const lastUp = current.lastLevelUpAt ? ymd(current.lastLevelUpAt) : null;
    const alreadyLeveledToday = lastUp === today;
    const allowLevelUp = !alreadyLeveledToday;

    const newLevel = allowLevelUp
      ? Math.min(MAX_LEVEL, Math.max(previousLevel, computedLevel))
      : previousLevel;

    const leveledUp = newLevel > previousLevel;

    await db
      .update(users)
      .set({
        xp: newXp,
        level: newLevel,
        lifetimeReps: sql`${users.lifetimeReps} + 1`,
        ...(leveledUp ? { lastLevelUpAt: now } : {}),
      })
      .where(eq(users.id, userId));

    return {
      xpDelta: grant,
      newXp,
      newLevel,
      leveledUp,
      previousLevel,
    };
  }, fallback);
}

/** Pure function for tests — same math as awardXp without the DB roundtrip. */
export function computeXpGrant(opts: {
  composite: number;
  streakDays: number;
  comebackBonus?: boolean;
  restDayBonus?: boolean;
}): number {
  return Math.round(
    BASE_XP *
      bandMultiplier(opts.composite) *
      streakMultiplier(opts.streakDays) *
      (opts.comebackBonus ? 2 : 1) *
      (opts.restDayBonus ? 1.5 : 1),
  );
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
