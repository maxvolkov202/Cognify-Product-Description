import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityEvents,
  communicationProfile,
  friendships,
  reps,
  users,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { SKILL_DIMENSIONS, type SkillDimension } from "@/types/domain";

/**
 * Activity feed — emit + read. Events live in activity_events keyed by
 * userId. The /friends live feed queries events for the current user and
 * all their accepted friends.
 *
 * Event catalog:
 *   - workout_complete  { composite, repsCount, topDimension }
 *   - new_high          { dimension, score }
 *   - streak_milestone  { days }
 *   - challenge_win     { opponentName, score }
 *   - friend_joined     { name }
 */

// Canonical definitions live in src/types/db-payloads.ts so schema.ts can
// reference them without a circular import. Re-export for back-compat
// with downstream callers.
export type {
  ActivityEventType,
  ActivityPayload,
} from "@/types/db-payloads";
import type { ActivityPayload, ActivityEventType } from "@/types/db-payloads";

export type ActivityRow = {
  id: string;
  userId: string;
  userName: string | null;
  /**
   * The actor's real strongest Core Skill (highest-scoring dimension in their
   * communication_profile), sourced per-actor so the feed shows a genuine,
   * varying skill rather than a hardcoded one. Null when the actor has no
   * measured skills yet — the row drops the "strongest" line in that case.
   */
  topCoreSkill: SkillDimension | null;
  type: ActivityEventType;
  payload: ActivityPayload;
  createdAt: Date;
};

/** The local part of an email (before "@"), used as a friendly display-name
 *  fallback when a user never set a name. Null-safe. */
function emailLocalPart(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  return local.trim() || null;
}

/** Pick the actor's strongest Core Skill from their profile's coreSkills map:
 *  the valid dimension with the highest score that has at least one sample.
 *  Returns null when there's no measured skill yet. */
function topCoreSkillFromProfile(
  coreSkills: Record<
    string,
    { score: number; sampleCount: number; updatedAt: string }
  > | null,
): SkillDimension | null {
  if (!coreSkills) return null;
  let best: SkillDimension | null = null;
  let bestScore = -Infinity;
  for (const dim of SKILL_DIMENSIONS) {
    const entry = coreSkills[dim];
    if (!entry || entry.sampleCount <= 0) continue;
    if (entry.score > bestScore) {
      bestScore = entry.score;
      best = dim;
    }
  }
  return best;
}

/** Fire-and-forget event emit. Swallows errors so the caller's primary path
 *  is never blocked by activity bookkeeping. */
export async function emitActivityEvent(
  userId: string,
  payload: ActivityPayload,
): Promise<void> {
  await safeDb(async () => {
    await db.insert(activityEvents).values({
      userId,
      type: payload.type,
      payload,
    });
    return true;
  }, false);
}

/**
 * Feed for the current user: own events + events from all accepted friends,
 * most recent first. Keeps the last 30 days by default so the feed stays
 * fast as usage grows.
 */
export async function getActivityFeedForUser(
  userId: string,
  opts: { limit?: number; sinceDays?: number } = {},
): Promise<ActivityRow[]> {
  const limit = opts.limit ?? 30;
  const sinceDays = opts.sinceDays ?? 30;

  return safeDb(async () => {
    // Resolve the set of userIds whose events we want: me + accepted friends.
    const friendRows = await db
      .select({
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

    const userIds = new Set<string>([userId]);
    for (const r of friendRows) {
      userIds.add(r.requesterId === userId ? r.recipientId : r.requesterId);
    }

    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: activityEvents.id,
        userId: activityEvents.userId,
        type: activityEvents.type,
        payload: activityEvents.payload,
        createdAt: activityEvents.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(activityEvents)
      .innerJoin(users, eq(users.id, activityEvents.userId))
      .where(
        and(
          inArray(activityEvents.userId, Array.from(userIds)),
          gte(activityEvents.createdAt, since),
        ),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);

    // 4.3 — source each actor's real strongest Core Skill in one batched read
    // over the distinct actors present in this page of the feed.
    const actorIds = Array.from(new Set(rows.map((r) => r.userId)));
    const topSkillByUser = new Map<string, SkillDimension | null>();
    if (actorIds.length > 0) {
      const profiles = await db
        .select({
          userId: communicationProfile.userId,
          coreSkills: communicationProfile.coreSkills,
        })
        .from(communicationProfile)
        .where(inArray(communicationProfile.userId, actorIds));
      for (const p of profiles) {
        topSkillByUser.set(p.userId, topCoreSkillFromProfile(p.coreSkills));
      }
    }

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      // 4.2 — show the actor's registered name; fall back to their email's
      // local part so a nameless account isn't shown as "Someone". "Someone"
      // (rendered in the row) only when both are genuinely absent.
      userName: r.userName ?? emailLocalPart(r.userEmail),
      topCoreSkill: topSkillByUser.get(r.userId) ?? null,
      type: r.type as ActivityEventType,
      payload: r.payload as ActivityPayload,
      createdAt: r.createdAt,
    }));
  }, []);
}

/**
 * Detect a new-high event by comparing the incoming score against the
 * user's prior max composite. Returns the dimension + score if there's
 * a per-dimension new high worth announcing; null otherwise.
 */
export async function detectNewHigh(
  userId: string,
  newComposite: number,
): Promise<{ score: number } | null> {
  return safeDb(async () => {
    const [row] = await db
      .select({ max: sql<number | null>`MAX(${reps.compositeScore})` })
      .from(reps)
      .where(eq(reps.userId, userId));
    const priorMax = row?.max ?? 0;
    // Threshold: beat the prior max AND at least 70 (avoid celebrating low scores)
    if (newComposite > priorMax && newComposite >= 70) {
      return { score: newComposite };
    }
    return null;
  }, null);
}
