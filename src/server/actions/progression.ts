"use server";

// PRD v3 Phase 6 — unified completion-celebration data (PRD §10.8).
//
// One action every completion surface calls: current Rank + progress,
// streak, achievements earned today, and this week's challenge state.
// Returns null when FF_RANK_SYSTEM is off so client hosts can mount the
// strip unconditionally and render nothing on legacy.

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userAchievements, users } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { isRankSystemEnabled } from "@/lib/flags";
import { rankFromXp, type RankInfo } from "@/lib/progression/rank";
import { ACHIEVEMENTS } from "@/lib/engagement/achievements";
import { getStreakDays } from "@/lib/db/queries/progress";
import { getOrCreateThisWeekChallenges } from "@/lib/db/queries/weekly-challenges";

export type ProgressionSummary = {
  rank: RankInfo;
  streakDays: number;
  lifetimeReps: number;
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
      .select({ xp: users.xp, lifetimeReps: users.lifetimeReps })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!row) return null;

    const todayStart = new Date(
      `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const earnedToday = await db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, user.id),
          gte(userAchievements.earnedAt, todayStart),
        ),
      );

    const streakDays = await getStreakDays(user.id);
    const week = await getOrCreateThisWeekChallenges(user.id);

    return {
      rank: rankFromXp(row.xp),
      streakDays,
      lifetimeReps: row.lifetimeReps,
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
