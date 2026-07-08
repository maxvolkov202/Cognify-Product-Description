"use server";

// PRD v3 Phase 6 — unified completion-celebration data (PRD §10.8).
//
// One action every completion surface calls: current Rank + progress,
// streak, achievements earned today, and this week's challenge state.
// Returns null when FF_RANK_SYSTEM is off so client hosts can mount the
// strip unconditionally and render nothing on legacy.

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  communicationProfile,
  userAchievements,
  users,
} from "@/lib/db/schema";
import { SKILL_DIMENSIONS } from "@/types/domain";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { isRankSystemEnabled } from "@/lib/flags";
import { rankFromXp, type RankInfo } from "@/lib/progression/rank";
import { ACHIEVEMENTS } from "@/lib/engagement/achievements";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";
import { getOrCreateThisWeekChallenges } from "@/lib/db/queries/weekly-challenges";
import { todayYmdInTz } from "@/lib/time/user-day";

export type ProgressionSummary = {
  rank: RankInfo;
  /** Phase 15 R-3 — server-truth: this read crossed a rank boundary the
   *  user hasn't been celebrated for yet (marker already advanced). */
  rankUp: boolean;
  streakDays: number;
  /** §10.7.1 — banked Streak Freezes remaining (after any the current
   *  streak is virtually spending). */
  freezesAvailable: number;
  /** True when a freeze is holding the streak together right now (the
   *  most recent covered date falls within the last 2 days) — drives the
   *  "🧊 Streak Freeze used" chip on completion surfaces. */
  freezeJustUsed: boolean;
  lifetimeReps: number;
  /** PRD §10.8 — "Updated Communication Score" + current Core Skill
   *  estimates, shown on every completion surface. Null until ≥3 skills
   *  measured / no profile yet. */
  overallScore: number | null;
  coreSkills: { dimension: string; score: number }[];
  /** Achievements earned today (UTC), name + description for chips. */
  achievementsToday: { id: string; name: string; description: string }[];
  weeklyChallenges: {
    id: string;
    title: string;
    target: number;
    progress: number;
    completed: boolean;
  }[];
};

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export async function getProgressionSummary(): Promise<ProgressionSummary | null> {
  if (!isRankSystemEnabled()) return null;
  const user = await currentUser();
  if (!user) return null;

  return safeDb<ProgressionSummary | null>(async () => {
    const [row] = await db
      .select({
        xp: users.xp,
        lifetimeReps: users.lifetimeReps,
        lastCelebratedRankIndex: users.lastCelebratedRankIndex,
        tz: users.tz,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!row) return null;

    // Phase 15 R-3 — server-truth rank-up detection (§10.8.1). Rank is a
    // pure function of lifetime XP; the celebration fires when the
    // current rank index exceeds the last CELEBRATED index, then the
    // marker advances. NULL primes silently (no retroactive fanfare) —
    // the old localStorage-only detection missed cross-device rank-ups
    // and always swallowed the first one per browser.
    const rank = rankFromXp(row.xp);
    let rankUp = false;
    if (row.lastCelebratedRankIndex == null) {
      await db
        .update(users)
        .set({ lastCelebratedRankIndex: rank.rankIndex })
        .where(eq(users.id, user.id));
    } else if (rank.rankIndex > row.lastCelebratedRankIndex) {
      rankUp = true;
      await db
        .update(users)
        .set({ lastCelebratedRankIndex: rank.rankIndex })
        .where(eq(users.id, user.id));
    }

    // Phase 15 S-4 — "today" in the USER's day, not UTC: late-evening
    // users west of UTC were seeing yesterday's chips (or missing
    // today's). Day-grain approximation: user-local YMD anchored to UTC
    // midnight matches how reps/achievements bucket elsewhere.
    const tz = row.tz ?? "UTC";
    const todayStart = new Date(`${todayYmdInTz(tz)}T00:00:00.000Z`);
    const earnedToday = await db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, user.id),
          gte(userAchievements.earnedAt, todayStart),
        ),
      );

    // One call gets streak + freeze state (getStreakDays is a thin
    // delegate over the same computation — Phase 15 R-1).
    const streakStatus = await getStreakStatus(user.id);
    const streakDays = streakStatus.streakDays;
    // "Just used" = the most recent freeze-covered date is within the
    // last 2 days (user-local YMD vs today's UTC YMD — day-grain, so TZ
    // skew is at most the ±1 day the 2-day window already absorbs).
    let freezeJustUsed = false;
    if (streakDays > 0 && streakStatus.appliedFreezeDate) {
      const todayYmd = todayYmdInTz(tz);
      const diffDays = Math.round(
        (Date.parse(`${todayYmd}T00:00:00Z`) -
          Date.parse(`${streakStatus.appliedFreezeDate}T00:00:00Z`)) /
          86_400_000,
      );
      freezeJustUsed = diffDays >= 0 && diffDays <= 2;
    }
    const week = await getOrCreateThisWeekChallenges(user.id);

    const [profileRow] = await db
      .select({
        overallScore: communicationProfile.overallScore,
        coreSkills: communicationProfile.coreSkills,
      })
      .from(communicationProfile)
      .where(eq(communicationProfile.userId, user.id))
      .limit(1);
    const coreSkills: { dimension: string; score: number }[] = [];
    for (const dim of SKILL_DIMENSIONS) {
      const est = (
        profileRow?.coreSkills as
          | Record<string, { score: number } | undefined>
          | undefined
      )?.[dim];
      if (est) coreSkills.push({ dimension: dim, score: Math.round(est.score) });
    }

    return {
      rank,
      rankUp,
      streakDays,
      freezesAvailable: streakStatus.freezesAvailable,
      freezeJustUsed,
      lifetimeReps: row.lifetimeReps,
      overallScore: profileRow?.overallScore ?? null,
      coreSkills,
      achievementsToday: earnedToday
        .map((e) => ACHIEVEMENT_BY_ID.get(e.achievementId))
        .filter((a): a is NonNullable<typeof a> => a != null)
        .map((a) => ({ id: a.id, name: a.name, description: a.description })),
      weeklyChallenges: (week?.challenges ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        target: c.target,
        progress: Math.min(c.target, week?.progress[c.id] ?? 0),
        completed: (week?.completedIds ?? []).includes(c.id),
      })),
    };
  }, null);
}
