import { and, desc, eq, gte, sql, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  communicationProfile,
  reps,
  users,
  memberships,
  teams,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

/**
 * Leaderboard domain — real data sourced from the reps / users / teams
 * tables. Three scopes backed by the same shape so the client just
 * toggles between pre-computed entry arrays:
 *
 *  - `global`:    top users by avg composite across the last 30 days of
 *                 reps. 30-day window keeps the board fresh — a user
 *                 who trained hard a year ago and stopped shouldn't
 *                 anchor the #1 slot forever.
 *  - `this_week`: avg composite across the current ISO week only. The
 *                 "climb" feature lives here — weekly leaders rotate.
 *  - `team`:      same as `global` but filtered to the current user's
 *                 team(s). If the user isn't in a team, the caller
 *                 renders an empty-state CTA instead of this array.
 *
 * A user with zero reps in the scope is excluded.
 */

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  team: string;
  composite: number;
  reps: number;
  streak: number;
  delta: number;
};

export type LeaderboardBoard = {
  entries: LeaderboardEntry[];
  topStreak: { name: string; streak: number } | null;
  biggestClimb: { name: string; delta: number } | null;
  /** Entry for the authenticated user, if any — used to surface the
   *  user's rank even if they fell off the top-15. Null when the user
   *  has no reps in the scope. */
  selfEntry: LeaderboardEntry | null;
};

export type LeaderboardScope = "global" | "this_week" | "team";

/** PRD v3 Phase 6 (§10.9) — ranking metric.
 *  - "composite": avg composite in window (legacy default)
 *  - "improvement": weekly improvement (delta vs last week) — the PRD's
 *    default, "rewards communication growth rather than natural ability"
 *  - "communication_score": Overall Communication Score (profile EMA) */
export type LeaderboardMetric =
  | "composite"
  | "improvement"
  | "communication_score";

/** Limit — deliberately ~match the mock leaderboard the page previously
 *  rendered so the UI doesn't shrink when the real query lands. */
const DEFAULT_LIMIT = 15;

function isoWeekStart(now: Date = new Date()): Date {
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
  return monday;
}

function lastWeekRange(): { start: Date; end: Date } {
  const start = isoWeekStart();
  const end = new Date(start);
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  return { start: prevStart, end };
}

/**
 * Resolve the authenticated user's team memberships — used by the
 * `team` scope. Returns the team ids (plural: a user may be in
 * multiple teams), or empty array when unaffiliated.
 */
async function getTeamIdsForUser(userId: string): Promise<string[]> {
  return safeDb(async () => {
    const rows = await db
      .select({ teamId: memberships.teamId })
      .from(memberships)
      .where(eq(memberships.userId, userId));
    return rows.map((r) => r.teamId);
  }, []);
}

/**
 * Resolve team members for a set of team ids. Returns distinct userIds.
 */
async function getUserIdsOnTeams(teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return [];
  return safeDb(async () => {
    const rows = await db
      .selectDistinct({ userId: memberships.userId })
      .from(memberships)
      .where(inArray(memberships.teamId, teamIds));
    return rows.map((r) => r.userId);
  }, []);
}

/**
 * Compute the ISO-week streak for a user — count of distinct days with
 * a rep up to today, walking back as long as consecutive. Simpler than
 * the full streak-freeze logic so we can batch for many users.
 */
async function computeSimpleStreaks(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  return safeDb(async () => {
    // Pull last 60 days of rep dates for all users in a single query.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        userId: reps.userId,
        date: sql<string>`to_char(${reps.createdAt}, 'YYYY-MM-DD')`,
      })
      .from(reps)
      .where(and(inArray(reps.userId, userIds), gte(reps.createdAt, since)))
      .groupBy(
        reps.userId,
        sql`to_char(${reps.createdAt}, 'YYYY-MM-DD')`,
      );

    const byUser = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = byUser.get(r.userId) ?? new Set<string>();
      set.add(r.date);
      byUser.set(r.userId, set);
    }

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);

    const out = new Map<string, number>();
    for (const [uid, dates] of byUser.entries()) {
      if (!dates.has(today) && !dates.has(yesterday)) {
        out.set(uid, 0);
        continue;
      }
      let streak = 0;
      const cursor = dates.has(today)
        ? new Date(today + "T00:00:00Z")
        : new Date(yesterday + "T00:00:00Z");
      while (true) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!dates.has(iso)) break;
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      out.set(uid, streak);
    }
    return out;
  }, new Map());
}

/**
 * Per-user delta between this week's and last week's avg composite.
 * Batched so the leaderboard stays to a fixed number of queries
 * regardless of entry count.
 */
async function computeDeltas(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  return safeDb(async () => {
    const thisStart = isoWeekStart();
    const { start: prevStart, end: prevEnd } = lastWeekRange();

    const thisRows = await db
      .select({
        userId: reps.userId,
        avg: sql<number>`avg(${reps.compositeScore})::float`,
      })
      .from(reps)
      .where(
        and(
          inArray(reps.userId, userIds),
          gte(reps.createdAt, thisStart),
        ),
      )
      .groupBy(reps.userId);

    const prevRows = await db
      .select({
        userId: reps.userId,
        avg: sql<number>`avg(${reps.compositeScore})::float`,
      })
      .from(reps)
      .where(
        and(
          inArray(reps.userId, userIds),
          gte(reps.createdAt, prevStart),
          lt(reps.createdAt, prevEnd),
        ),
      )
      .groupBy(reps.userId);

    const thisMap = new Map(thisRows.map((r) => [r.userId, r.avg ?? 0]));
    const prevMap = new Map(prevRows.map((r) => [r.userId, r.avg ?? 0]));
    const out = new Map<string, number>();
    for (const uid of new Set([...thisMap.keys(), ...prevMap.keys()])) {
      const now = thisMap.get(uid) ?? 0;
      const prev = prevMap.get(uid) ?? 0;
      if (prev === 0) {
        out.set(uid, 0); // No prior baseline → hide the delta.
      } else {
        out.set(uid, Math.round(now - prev));
      }
    }
    return out;
  }, new Map());
}

/**
 * Lookup: userId → canonical team name for display. If the user is on
 * multiple teams we pick the first one — leaderboard rows only show one
 * team label.
 */
async function resolveTeamLabels(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  return safeDb(async () => {
    const rows = await db
      .select({
        userId: memberships.userId,
        teamName: teams.name,
      })
      .from(memberships)
      .innerJoin(teams, eq(teams.id, memberships.teamId))
      .where(inArray(memberships.userId, userIds));
    const out = new Map<string, string>();
    for (const r of rows) {
      if (!out.has(r.userId)) out.set(r.userId, r.teamName);
    }
    return out;
  }, new Map());
}

export async function getLeaderboard(opts: {
  scope: LeaderboardScope;
  userId: string | null;
  limit?: number;
  metric?: LeaderboardMetric;
}): Promise<LeaderboardBoard> {
  const { scope, userId } = opts;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const metric = opts.metric ?? "composite";

  return safeDb(async () => {
    // 1. Scope → time window + optional team filter.
    let since: Date;
    if (scope === "this_week") {
      since = isoWeekStart();
    } else {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let teamFilterUserIds: string[] | null = null;
    if (scope === "team") {
      if (!userId) {
        return emptyBoard();
      }
      const teamIds = await getTeamIdsForUser(userId);
      if (teamIds.length === 0) {
        return emptyBoard();
      }
      teamFilterUserIds = await getUserIdsOnTeams(teamIds);
      if (teamFilterUserIds.length === 0) return emptyBoard();
    }

    // 2. Aggregate avg composite + count per user within the window.
    const whereClauses = [gte(reps.createdAt, since)];
    if (teamFilterUserIds) {
      whereClauses.push(inArray(reps.userId, teamFilterUserIds));
    }

    const aggregateRows = await db
      .select({
        userId: reps.userId,
        name: users.name,
        email: users.email,
        composite: sql<number>`avg(${reps.compositeScore})::float`,
        reps: sql<number>`count(*)::int`,
      })
      .from(reps)
      .innerJoin(users, eq(users.id, reps.userId))
      .where(and(...whereClauses))
      .groupBy(reps.userId, users.name, users.email)
      .having(sql`count(*) >= 1`)
      .orderBy(desc(sql`avg(${reps.compositeScore})`));

    if (aggregateRows.length === 0) return emptyBoard();

    // PRD v3 Phase 6 — metric re-ranking. The base aggregation (avg
    // composite + rep counts) is shared; the metric only changes the
    // sort key (and, for communication_score, the displayed number).
    let rankedRows = aggregateRows;
    let overallScores: Map<string, number> | null = null;
    if (metric === "improvement") {
      const deltaMap = await computeDeltas(aggregateRows.map((r) => r.userId));
      rankedRows = [...aggregateRows].sort(
        (a, b) => (deltaMap.get(b.userId) ?? 0) - (deltaMap.get(a.userId) ?? 0),
      );
    } else if (metric === "communication_score") {
      overallScores = await safeDb(async () => {
        const rows = await db
          .select({
            userId: communicationProfile.userId,
            overall: communicationProfile.overallScore,
          })
          .from(communicationProfile)
          .where(
            inArray(
              communicationProfile.userId,
              aggregateRows.map((r) => r.userId),
            ),
          );
        const m = new Map<string, number>();
        for (const r of rows) if (r.overall != null) m.set(r.userId, r.overall);
        return m;
      }, new Map<string, number>());
      rankedRows = [...aggregateRows]
        .filter((r) => overallScores!.has(r.userId))
        .sort(
          (a, b) =>
            (overallScores!.get(b.userId) ?? 0) -
            (overallScores!.get(a.userId) ?? 0),
        );
      if (rankedRows.length === 0) return emptyBoard();
    }

    const topSlice = rankedRows.slice(0, limit);
    const topUserIds = topSlice.map((r) => r.userId);

    // Ensure self appears even when outside top N — needed for the
    // "your rank" row at the bottom of the board.
    const userIdsForExtras = [...topUserIds];
    if (userId && !topUserIds.includes(userId)) {
      const selfRow = rankedRows.find((r) => r.userId === userId);
      if (selfRow) userIdsForExtras.push(userId);
    }

    // Compute streaks + deltas once over the FULL user set so the
    // top-N table and the global topStreak/biggestClimb callouts both
    // reuse the same maps (audit PR-9 — was recomputing each twice).
    const allUserIds = aggregateRows.map((r) => r.userId);
    const [streaks, deltas, teamLabels] = await Promise.all([
      computeSimpleStreaks(allUserIds),
      computeDeltas(allUserIds),
      resolveTeamLabels(userIdsForExtras),
    ]);

    const toEntry = (
      row: (typeof aggregateRows)[number],
      rank: number,
    ): LeaderboardEntry => ({
      rank,
      userId: row.userId,
      name:
        row.name && row.name.trim()
          ? row.name
          : row.email?.split("@")[0] ?? "Trainee",
      team: teamLabels.get(row.userId) ?? "Solo",
      composite: Math.round(
        overallScores?.get(row.userId) ?? row.composite ?? 0,
      ),
      reps: row.reps,
      streak: streaks.get(row.userId) ?? 0,
      delta: deltas.get(row.userId) ?? 0,
    });

    const entries = topSlice.map((r, i) => toEntry(r, i + 1));

    let selfEntry: LeaderboardEntry | null = null;
    if (userId) {
      const inTop = entries.find((e) => e.userId === userId) ?? null;
      if (inTop) {
        selfEntry = inTop;
      } else {
        const selfIdx = rankedRows.findIndex((r) => r.userId === userId);
        if (selfIdx !== -1) {
          selfEntry = toEntry(rankedRows[selfIdx]!, selfIdx + 1);
        }
      }
    }

    // Longest streak — across all users in scope (not just top N) so the
    // callout accurately reflects who's training most consistently.
    // Reuses `streaks` computed above; no second roundtrip.
    let topStreak: LeaderboardBoard["topStreak"] = null;
    for (const r of aggregateRows) {
      const s = streaks.get(r.userId) ?? 0;
      if (!topStreak || s > topStreak.streak) {
        if (s <= 0) continue;
        topStreak = {
          name:
            r.name && r.name.trim()
              ? r.name
              : r.email?.split("@")[0] ?? "Trainee",
          streak: s,
        };
      }
    }

    // Biggest climb — reuses `deltas` for the same reason.
    let biggestClimb: LeaderboardBoard["biggestClimb"] = null;
    for (const r of aggregateRows) {
      const d = deltas.get(r.userId) ?? 0;
      if (d <= 0) continue;
      if (!biggestClimb || d > biggestClimb.delta) {
        biggestClimb = {
          name:
            r.name && r.name.trim()
              ? r.name
              : r.email?.split("@")[0] ?? "Trainee",
          delta: d,
        };
      }
    }

    return { entries, topStreak, biggestClimb, selfEntry };
  }, emptyBoard());
}

function emptyBoard(): LeaderboardBoard {
  return {
    entries: [],
    topStreak: null,
    biggestClimb: null,
    selfEntry: null,
  };
}
