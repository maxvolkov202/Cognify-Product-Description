"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/session/current-user";
import { db } from "@/lib/db/client";
import {
  crewInvites,
  friendships,
  friendChallenges,
  reps,
  users,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { findUserByEmail } from "@/lib/db/queries/friends";
import { emitActivityEvent } from "@/lib/db/queries/activity";
import { sendCrewInviteEmail } from "@/lib/email/send";

export type FriendsActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | {
      ok: false;
      error:
        | "no_user"
        | "not_found"
        | "already_friends"
        | "request_exists"
        | "self_request"
        | "invalid_input"
        | "db_unavailable"
        | "invite_exists";
    };

export type SendCrewRequestData =
  | { kind: "friend_request_sent" }
  | { kind: "invite_sent"; email: string; inviteUrl: string };

/**
 * Send a crew request by email. If the email belongs to an existing
 * Cognify user, creates a pending friendships row. If not, creates a
 * pending crew_invites row, emails an invite link, and returns the
 * shareable URL so the form can show "Send them this link" UX. The
 * pending invite converts to a friendship the moment that email signs up.
 */
export async function sendFriendRequestAction(
  email: string,
): Promise<FriendsActionResult<SendCrewRequestData>> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "no_user" };

  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "invalid_input" };
  }
  if (me.email && me.email.toLowerCase() === normalized) {
    return { ok: false, error: "self_request" };
  }

  const target = await findUserByEmail(normalized);

  if (target) {
    const existing = await safeDb(
      async () =>
        db.query.friendships.findFirst({
          where: or(
            and(
              eq(friendships.requesterId, me.id),
              eq(friendships.recipientId, target.id),
            ),
            and(
              eq(friendships.requesterId, target.id),
              eq(friendships.recipientId, me.id),
            ),
          ),
        }),
      null,
    );

    if (existing) {
      if (existing.status === "accepted") {
        return { ok: false, error: "already_friends" };
      }
      return { ok: false, error: "request_exists" };
    }

    const inserted = await safeDb(async () => {
      await db.insert(friendships).values({
        requesterId: me.id,
        recipientId: target.id,
        status: "pending",
      });
      return true;
    }, false);

    if (!inserted) return { ok: false, error: "db_unavailable" };

    revalidatePath("/friends");
    return { ok: true, data: { kind: "friend_request_sent" } };
  }

  const existingInvite = await safeDb(
    async () =>
      db.query.crewInvites.findFirst({
        where: and(
          eq(crewInvites.inviterId, me.id),
          eq(crewInvites.email, normalized),
          eq(crewInvites.status, "pending"),
        ),
      }),
    null,
  );

  const token = existingInvite?.token ?? randomUUID().replace(/-/g, "");
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cognifygym.com";
  const inviteUrl = `${baseUrl}/signin?invite=${token}`;

  if (!existingInvite) {
    const inserted = await safeDb(async () => {
      await db.insert(crewInvites).values({
        inviterId: me.id,
        email: normalized,
        token,
        status: "pending",
      });
      return true;
    }, false);
    if (!inserted) return { ok: false, error: "db_unavailable" };
  }

  await sendCrewInviteEmail({
    to: normalized,
    inviterName: me.name,
    inviteUrl,
  });

  revalidatePath("/friends");
  return {
    ok: true,
    data: { kind: "invite_sent", email: normalized, inviteUrl },
  };
}


export async function acceptFriendRequestAction(
  friendshipId: string,
): Promise<FriendsActionResult> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "no_user" };

  const ok = await safeDb(async () => {
    const row = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });
    if (!row) return false;
    if (row.recipientId !== me.id) return false;
    if (row.status !== "pending") return false;
    await db
      .update(friendships)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(friendships.id, friendshipId));
    return true;
  }, false);

  if (!ok) return { ok: false, error: "not_found" };
  revalidatePath("/friends");
  return { ok: true };
}

export async function declineFriendRequestAction(
  friendshipId: string,
): Promise<FriendsActionResult> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "no_user" };

  const ok = await safeDb(async () => {
    const row = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });
    if (!row) return false;
    if (row.recipientId !== me.id) return false;
    if (row.status !== "pending") return false;
    await db
      .update(friendships)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(friendships.id, friendshipId));
    return true;
  }, false);

  if (!ok) return { ok: false, error: "not_found" };
  revalidatePath("/friends");
  return { ok: true };
}

export async function submitChallengeRepAction(opts: {
  challengeId: string;
  repId: string;
}): Promise<FriendsActionResult<{ completed: boolean }>> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "no_user" };

  const result = await safeDb(async () => {
    const row = await db.query.friendChallenges.findFirst({
      where: eq(friendChallenges.id, opts.challengeId),
    });
    if (!row) return null;

    const isChallenger = row.challengerId === me.id;
    const isOpponent = row.opponentId === me.id;
    if (!isChallenger && !isOpponent) return null;

    const updates: Partial<typeof row> = {};
    if (isChallenger && !row.challengerRepId) {
      updates.challengerRepId = opts.repId;
      // Transition pending → active when challenger records first
      if (row.status === "pending") updates.status = "active";
    } else if (isOpponent && !row.opponentRepId) {
      updates.opponentRepId = opts.repId;
      if (row.status === "pending") updates.status = "active";
    } else {
      // Already recorded for this side — idempotent success.
      return { completed: row.status === "completed" };
    }

    // Compute completion in the same transaction so we don't flash "active"
    // if both sides are now covered.
    const challengerDone =
      updates.challengerRepId ?? row.challengerRepId;
    const opponentDone = updates.opponentRepId ?? row.opponentRepId;
    if (challengerDone && opponentDone) {
      updates.status = "completed";
      updates.completedAt = new Date();
    }

    await db
      .update(friendChallenges)
      .set(updates)
      .where(eq(friendChallenges.id, opts.challengeId));

    return { completed: updates.status === "completed" };
  }, null);

  if (!result) return { ok: false, error: "not_found" };

  // On completion, emit a challenge_win event to whoever scored higher.
  if (result.completed) {
    await safeDb(async () => {
      const full = await db.query.friendChallenges.findFirst({
        where: eq(friendChallenges.id, opts.challengeId),
      });
      if (!full?.challengerRepId || !full?.opponentRepId) return null;

      const [challengerRep, opponentRep] = await Promise.all([
        db.query.reps.findFirst({ where: eq(reps.id, full.challengerRepId) }),
        db.query.reps.findFirst({ where: eq(reps.id, full.opponentRepId) }),
      ]);
      const cScore = challengerRep?.compositeScore ?? 0;
      const oScore = opponentRep?.compositeScore ?? 0;
      if (cScore === oScore) return null;
      const winnerId = cScore > oScore ? full.challengerId : full.opponentId;
      const loserId = cScore > oScore ? full.opponentId : full.challengerId;
      const winningScore = Math.max(cScore, oScore);

      const loser = await db.query.users.findFirst({
        where: eq(users.id, loserId),
      });
      await emitActivityEvent(winnerId, {
        type: "challenge_win",
        opponentName: loser?.name ?? "a friend",
        score: winningScore,
      });
      return null;
    }, null);
  }

  revalidatePath("/friends");
  revalidatePath(`/friends/challenge/${opts.challengeId}`);
  return { ok: true, data: result };
}

export async function createChallengeAction(opts: {
  opponentId: string;
  prompt: string;
}): Promise<FriendsActionResult<{ id: string }>> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "no_user" };

  const prompt = opts.prompt.trim();
  if (!prompt || prompt.length < 5) {
    return { ok: false, error: "invalid_input" };
  }
  if (opts.opponentId === me.id) {
    return { ok: false, error: "self_request" };
  }

  const areFriends = await safeDb(async () => {
    const row = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.status, "accepted"),
        or(
          and(
            eq(friendships.requesterId, me.id),
            eq(friendships.recipientId, opts.opponentId),
          ),
          and(
            eq(friendships.requesterId, opts.opponentId),
            eq(friendships.recipientId, me.id),
          ),
        ),
      ),
    });
    return row !== undefined;
  }, false);
  if (!areFriends) return { ok: false, error: "not_found" };

  const created = await safeDb(async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(friendChallenges)
      .values({
        challengerId: me.id,
        opponentId: opts.opponentId,
        prompt,
        status: "pending",
        expiresAt,
      })
      .returning({ id: friendChallenges.id });
    return row ?? null;
  }, null);

  if (!created) return { ok: false, error: "db_unavailable" };

  revalidatePath("/friends");
  return { ok: true, data: { id: created.id } };
}
