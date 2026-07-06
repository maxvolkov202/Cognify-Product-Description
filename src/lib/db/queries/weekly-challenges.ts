// PRD v3 Phase 6 — Weekly + Team Challenge persistence (PRD §10.10/§10.11).
//
// Mirrors daily-quests.ts but week-keyed and counter-based. All writes
// are best-effort from saveRep's perspective — a challenge failure never
// loses the rep.

import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  memberships,
  teamWeeklyChallenges,
  weeklyChallenges,
  users,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import {
  applyChallengeEvent,
  pickChallengesForWeek,
  teamChallengeTarget,
  weekStartYmd,
  TEAM_CHALLENGE,
  type WeeklyChallengeEvent,
} from "@/lib/engagement/weekly-challenges";

export type WeeklyChallengesRow = {
  weekStart: string;
  challenges: {
    id: string;
    title: string;
    description: string;
    target: number;
    bonusXp: number;
  }[];
  progress: Record<string, number>;
  completedIds: string[];
  xpEarned: number;
};

export async function getOrCreateThisWeekChallenges(
  userId: string,
  now: Date = new Date(),
): Promise<WeeklyChallengesRow | null> {
  const weekStart = weekStartYmd(now);
  return safeDb<WeeklyChallengesRow | null>(async () => {
    const [existing] = await db
      .select()
      .from(weeklyChallenges)
      .where(
        and(
          eq(weeklyChallenges.userId, userId),
          eq(weeklyChallenges.weekStart, weekStart),
        ),
      )
      .limit(1);
    if (existing) {
      return {
        weekStart,
        challenges: existing.challenges,
        progress: existing.progress,
        completedIds: existing.completion.completedIds ?? [],
        xpEarned: existing.completion.xpEarned ?? 0,
      };
    }
    const picked = pickChallengesForWeek(userId, weekStart).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      target: c.target,
      bonusXp: c.bonusXp,
    }));
    await db
      .insert(weeklyChallenges)
      .values({ userId, weekStart, challenges: picked })
      .onConflictDoNothing();
    return {
      weekStart,
      challenges: picked,
      progress: {},
      completedIds: [],
      xpEarned: 0,
    };
  }, null);
}

/** Fold one rep event into this week's challenges. Returns newly
 *  completed challenge ids + bonus XP (caller credits users.xp). */
export async function recordWeeklyChallengeEvent(
  userId: string,
  event: WeeklyChallengeEvent,
  now: Date = new Date(),
): Promise<{ newlyCompletedIds: string[]; bonusXp: number } | null> {
  const row = await getOrCreateThisWeekChallenges(userId, now);
  if (!row) return null;
  const result = applyChallengeEvent({
    challenges: row.challenges,
    progress: row.progress,
    alreadyCompletedIds: new Set(row.completedIds),
    event,
  });
  const changed =
    JSON.stringify(result.progress) !== JSON.stringify(row.progress) ||
    result.newlyCompletedIds.length > 0;
  if (!changed) return { newlyCompletedIds: [], bonusXp: 0 };
  return safeDb(async () => {
    const completedIds = [...row.completedIds, ...result.newlyCompletedIds];
    const xpEarned = result.newlyCompletedIds.length > 0 ? result.bonusXp : 0;
    await db
      .update(weeklyChallenges)
      .set({
        progress: result.progress,
        completion: { completedIds, xpEarned: row.xpEarned + xpEarned },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(weeklyChallenges.userId, userId),
          eq(weeklyChallenges.weekStart, row.weekStart),
        ),
      );
    if (xpEarned > 0) {
      await db
        .update(users)
        .set({ xp: sql`${users.xp} + ${xpEarned}` })
        .where(eq(users.id, userId));
    }
    return {
      newlyCompletedIds: result.newlyCompletedIds,
      bonusXp: xpEarned,
    };
  }, null);
}

/** Increment every team the user belongs to. Creates this week's team
 *  challenge on first member activity (target scaled by team size). */
export async function incrementTeamChallenges(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const weekStart = weekStartYmd(now);
  await safeDb<void>(async () => {
    const teams = await db
      .select({ teamId: memberships.teamId })
      .from(memberships)
      .where(eq(memberships.userId, userId));
    for (const { teamId } of teams) {
      const [countRow] = await db
        .select({ c: count() })
        .from(memberships)
        .where(eq(memberships.teamId, teamId));
      const target = teamChallengeTarget(Number(countRow?.c ?? 1));
      await db
        .insert(teamWeeklyChallenges)
        .values({
          teamId,
          weekStart,
          challenge: {
            id: TEAM_CHALLENGE.id,
            title: TEAM_CHALLENGE.title,
            target,
          },
          progress: 1,
        })
        .onConflictDoUpdate({
          target: [teamWeeklyChallenges.teamId, teamWeeklyChallenges.weekStart],
          set: {
            progress: sql`${teamWeeklyChallenges.progress} + 1`,
            completedAt: sql`CASE
              WHEN ${teamWeeklyChallenges.completedAt} IS NOT NULL THEN ${teamWeeklyChallenges.completedAt}
              WHEN ${teamWeeklyChallenges.progress} + 1 >= (${teamWeeklyChallenges.challenge}->>'target')::int THEN now()
              ELSE NULL
            END`,
            updatedAt: new Date(),
          },
        });
    }
  }, undefined);
}

export async function getTeamChallenges(
  userId: string,
  now: Date = new Date(),
): Promise<
  {
    teamId: string;
    teamName: string;
    title: string;
    target: number;
    progress: number;
    completed: boolean;
  }[]
> {
  const weekStart = weekStartYmd(now);
  return safeDb(async () => {
    const rows = await db
      .select({
        teamId: teamWeeklyChallenges.teamId,
        challenge: teamWeeklyChallenges.challenge,
        progress: teamWeeklyChallenges.progress,
        completedAt: teamWeeklyChallenges.completedAt,
        teamName: sql<string>`(SELECT name FROM cognify_v2.teams t WHERE t.id = ${teamWeeklyChallenges.teamId})`,
      })
      .from(teamWeeklyChallenges)
      .innerJoin(
        memberships,
        and(
          eq(memberships.teamId, teamWeeklyChallenges.teamId),
          eq(memberships.userId, userId),
        ),
      )
      .where(eq(teamWeeklyChallenges.weekStart, weekStart));
    return rows.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName ?? "Your team",
      title: r.challenge.title,
      target: r.challenge.target,
      progress: r.progress,
      completed: r.completedAt != null,
    }));
  }, []);
}
