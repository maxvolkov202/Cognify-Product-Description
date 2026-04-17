import { and, avg, count, desc, eq, inArray, min, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { friendships, friendChallenges, users, reps } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

export type FriendRow = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  /** Earliest rep createdAt for tenure; null if none yet. */
  joinedAt: Date;
  totalReps: number;
  /** Composite rolling over the user's reps — average; null if no reps. */
  composite: number | null;
};

export type PendingRequestRow = {
  friendshipId: string;
  requesterId: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
};

export type ChallengeRow = {
  id: string;
  challengerId: string;
  challengerName: string | null;
  opponentId: string;
  opponentName: string | null;
  prompt: string;
  status: "pending" | "active" | "completed";
  challengerScore: number | null;
  opponentScore: number | null;
  createdAt: Date;
  expiresAt: Date | null;
};

/**
 * Friends of a user — both sides of the `friendships` table where the
 * status is 'accepted'. Returns the other party of each accepted pair.
 */
export async function getFriendsForUser(userId: string): Promise<FriendRow[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        friendshipId: friendships.id,
        requesterId: friendships.requesterId,
        recipientId: friendships.recipientId,
      })
      .from(friendships)
      .where(
        and(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.recipientId, userId),
          ),
          eq(friendships.status, "accepted"),
        ),
      );

    const friendIds = rows.map((r) =>
      r.requesterId === userId ? r.recipientId : r.requesterId,
    );
    if (friendIds.length === 0) return [];

    const [profiles, repStats] = await Promise.all([
      db.select().from(users).where(inArray(users.id, friendIds)),
      db
        .select({
          userId: reps.userId,
          totalReps: count(),
          avgComposite: avg(reps.compositeScore),
          firstRep: min(reps.createdAt),
        })
        .from(reps)
        .where(inArray(reps.userId, friendIds))
        .groupBy(reps.userId),
    ]);

    const statsMap = new Map(repStats.map((s) => [s.userId, s]));
    const results: FriendRow[] = profiles.map((p) => {
      const stats = statsMap.get(p.id);
      return {
        userId: p.id,
        name: p.name,
        email: p.email,
        image: p.image,
        joinedAt: stats?.firstRep ?? p.createdAt,
        totalReps: Number(stats?.totalReps ?? 0),
        composite: stats?.avgComposite ? Math.round(Number(stats.avgComposite)) : null,
      };
    });
    return results.sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
  }, []);
}

export async function getPendingRequestsForUser(
  userId: string,
): Promise<PendingRequestRow[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        friendshipId: friendships.id,
        requesterId: friendships.requesterId,
        createdAt: friendships.createdAt,
        name: users.name,
        image: users.image,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.requesterId))
      .where(
        and(
          eq(friendships.recipientId, userId),
          eq(friendships.status, "pending"),
        ),
      )
      .orderBy(desc(friendships.createdAt));
    return rows;
  }, []);
}

export async function getChallengesForUser(
  userId: string,
): Promise<ChallengeRow[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: friendChallenges.id,
        challengerId: friendChallenges.challengerId,
        opponentId: friendChallenges.opponentId,
        prompt: friendChallenges.prompt,
        status: friendChallenges.status,
        challengerRepId: friendChallenges.challengerRepId,
        opponentRepId: friendChallenges.opponentRepId,
        createdAt: friendChallenges.createdAt,
        expiresAt: friendChallenges.expiresAt,
      })
      .from(friendChallenges)
      .where(
        or(
          eq(friendChallenges.challengerId, userId),
          eq(friendChallenges.opponentId, userId),
        ),
      )
      .orderBy(desc(friendChallenges.createdAt));

    const userIds = [...new Set(rows.flatMap((c) => [c.challengerId, c.opponentId]))];
    const repIds = [...new Set(rows.flatMap((c) => [c.challengerRepId, c.opponentRepId]).filter(Boolean))] as string[];

    const [userProfiles, challengeReps] = await Promise.all([
      userIds.length > 0
        ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds))
        : Promise.resolve([]),
      repIds.length > 0
        ? db.select({ id: reps.id, compositeScore: reps.compositeScore }).from(reps).where(inArray(reps.id, repIds))
        : Promise.resolve([]),
    ]);

    const nameMap = new Map(userProfiles.map((u) => [u.id, u.name]));
    const scoreMap = new Map(challengeReps.map((r) => [r.id, r.compositeScore]));

    return rows.map((c) => ({
      id: c.id,
      challengerId: c.challengerId,
      challengerName: nameMap.get(c.challengerId) ?? null,
      opponentId: c.opponentId,
      opponentName: nameMap.get(c.opponentId) ?? null,
      prompt: c.prompt,
      status: (c.status as ChallengeRow["status"]) ?? "pending",
      challengerScore: c.challengerRepId ? (scoreMap.get(c.challengerRepId) ?? null) : null,
      opponentScore: c.opponentRepId ? (scoreMap.get(c.opponentRepId) ?? null) : null,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
    }));
  }, []);
}

export async function findUserByEmail(email: string) {
  return safeDb(
    async () =>
      db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase().trim()),
      }),
    null,
  );
}
