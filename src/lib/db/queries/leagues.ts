/**
 * Leagues data layer — DNA Ch.9b.
 *
 * Membership lifecycle:
 *   1. First rep of the week → getOrCreateThisWeekMembership() places
 *      the user in a tier (defaults to bronze) + an open cohort
 *   2. Each rep → tickWeeklyXp() adds XP to weekly_xp
 *   3. Cron at week reset (Sunday 00:00 UTC) → settleWeek() promotes
 *      top 30%, relegates bottom 30%, opens next week's cohorts
 *
 * Cohorts are ~30-user random groupings within a tier. We use a uuid
 * for league_id (the cohort) rather than computing it from the
 * (tier, week, group#) tuple so re-balancing across cohorts doesn't
 * require renaming.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leagueMembership } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import {
  weekStartUtc,
  type Tier,
  LEAGUE_COHORT_SIZE,
} from "@/lib/engagement/leagues";

export type LeagueMember = {
  userId: string;
  weekStart: string;
  tier: Tier;
  leagueId: string;
  weeklyXp: number;
};

/** Read this week's membership for the user. Returns null when the
 *  feature is disabled OR the user hasn't been placed yet. */
export async function getThisWeekMembership(
  userId: string,
  now: Date = new Date(),
): Promise<LeagueMember | null> {
  const week = weekStartUtc(now);
  return safeDb<LeagueMember | null>(async () => {
    const [row] = await db
      .select()
      .from(leagueMembership)
      .where(
        and(
          eq(leagueMembership.userId, userId),
          eq(leagueMembership.weekStart, week),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      userId: row.userId,
      weekStart: row.weekStart as string,
      tier: row.tier as Tier,
      leagueId: row.leagueId,
      weeklyXp: row.weeklyXp,
    };
  }, null);
}

/** Place the user in this week's leagues if they're not already in.
 *  Tier carries forward from last week (or defaults to bronze for new
 *  users). League id assignment is open: pick the most recently-created
 *  cohort in that tier with < LEAGUE_COHORT_SIZE members; otherwise
 *  create a new cohort uuid. */
export async function getOrCreateThisWeekMembership(
  userId: string,
  now: Date = new Date(),
): Promise<LeagueMember | null> {
  const existing = await getThisWeekMembership(userId, now);
  if (existing) return existing;

  const week = weekStartUtc(now);
  return safeDb<LeagueMember | null>(async () => {
    // Determine tier (carry forward from last settlement; default bronze).
    const [lastSettled] = await db
      .select({ tier: leagueMembership.tier, promotedTo: leagueMembership.promotedTo, relegatedTo: leagueMembership.relegatedTo })
      .from(leagueMembership)
      .where(eq(leagueMembership.userId, userId))
      .orderBy(sql`${leagueMembership.weekStart} DESC`)
      .limit(1);

    let tier: Tier = "bronze";
    if (lastSettled) {
      tier = (lastSettled.promotedTo ??
        lastSettled.relegatedTo ??
        lastSettled.tier) as Tier;
    }

    // Find an open cohort in this tier this week.
    const [openCohort] = await db.execute<{ league_id: string; count: number }>(sql`
      SELECT league_id, count(*)::int AS count
      FROM cognify_v2.league_membership
      WHERE week_start = ${week}::date AND tier = ${tier}
      GROUP BY league_id
      HAVING count(*) < ${LEAGUE_COHORT_SIZE}
      ORDER BY count(*) ASC
      LIMIT 1
    `) as unknown as Array<{ league_id: string; count: number }>;

    let leagueId: string;
    if (openCohort) {
      leagueId = openCohort.league_id;
    } else {
      const [newId] = await db.execute<{ id: string }>(
        sql`SELECT gen_random_uuid()::text AS id`,
      ) as unknown as Array<{ id: string }>;
      leagueId = newId!.id;
    }

    await db.insert(leagueMembership).values({
      userId,
      weekStart: week,
      tier,
      leagueId,
      weeklyXp: 0,
    });

    return {
      userId,
      weekStart: week,
      tier,
      leagueId,
      weeklyXp: 0,
    };
  }, null);
}

/** Add XP earned this rep to the user's weekly_xp. Idempotent-safe via
 *  pure UPDATE; auto-creates membership if missing. */
export async function tickWeeklyXp(
  userId: string,
  xpDelta: number,
  now: Date = new Date(),
): Promise<void> {
  if (xpDelta <= 0) return;
  const member = await getOrCreateThisWeekMembership(userId, now);
  if (!member) return;
  await safeDb<void>(async () => {
    await db
      .update(leagueMembership)
      .set({ weeklyXp: sql`${leagueMembership.weeklyXp} + ${xpDelta}` })
      .where(
        and(
          eq(leagueMembership.userId, userId),
          eq(leagueMembership.weekStart, member.weekStart),
        ),
      );
  }, undefined);
}

/** Read all members of the user's current cohort, sorted by weekly_xp
 *  descending. Used by LeagueBoard. */
export async function getCohortLeaderboard(
  leagueId: string,
): Promise<LeagueMember[]> {
  return safeDb<LeagueMember[]>(async () => {
    const rows = await db
      .select()
      .from(leagueMembership)
      .where(eq(leagueMembership.leagueId, leagueId))
      .orderBy(sql`${leagueMembership.weeklyXp} DESC`);
    return rows.map((r) => ({
      userId: r.userId,
      weekStart: r.weekStart as string,
      tier: r.tier as Tier,
      leagueId: r.leagueId,
      weeklyXp: r.weeklyXp,
    }));
  }, []);
}
