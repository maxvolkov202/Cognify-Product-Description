import { and, desc, eq, or } from "drizzle-orm";
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

    // Pull profile + aggregate rep stats per friend.
    const results: FriendRow[] = [];
    for (const friendId of friendIds) {
      const profile = await db.query.users.findFirst({
        where: eq(users.id, friendId),
      });
      if (!profile) continue;

      const friendReps = await db
        .select({
          composite: reps.compositeScore,
          createdAt: reps.createdAt,
        })
        .from(reps)
        .where(eq(reps.userId, friendId));

      const totalReps = friendReps.length;
      const composite =
        totalReps > 0
          ? Math.round(
              friendReps.reduce((s, r) => s + (r.composite ?? 0), 0) /
                totalReps,
            )
          : null;
      const joinedAt =
        friendReps.length > 0
          ? friendReps.reduce(
              (min, r) => (r.createdAt < min ? r.createdAt : min),
              friendReps[0]!.createdAt,
            )
          : profile.createdAt;

      results.push({
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.image,
        joinedAt,
        totalReps,
        composite,
      });
    }
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

    const results: ChallengeRow[] = [];
    for (const c of rows) {
      const [challenger, opponent] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, c.challengerId) }),
        db.query.users.findFirst({ where: eq(users.id, c.opponentId) }),
      ]);
      const [challengerRep, opponentRep] = await Promise.all([
        c.challengerRepId
          ? db.query.reps.findFirst({ where: eq(reps.id, c.challengerRepId) })
          : Promise.resolve(null),
        c.opponentRepId
          ? db.query.reps.findFirst({ where: eq(reps.id, c.opponentRepId) })
          : Promise.resolve(null),
      ]);
      results.push({
        id: c.id,
        challengerId: c.challengerId,
        challengerName: challenger?.name ?? null,
        opponentId: c.opponentId,
        opponentName: opponent?.name ?? null,
        prompt: c.prompt,
        status: (c.status as ChallengeRow["status"]) ?? "pending",
        challengerScore: challengerRep?.compositeScore ?? null,
        opponentScore: opponentRep?.compositeScore ?? null,
        createdAt: c.createdAt,
        expiresAt: c.expiresAt,
      });
    }
    return results;
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
