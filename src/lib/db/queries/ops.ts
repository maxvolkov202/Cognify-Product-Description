import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, reps } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

/**
 * Queries powering the internal /ops dashboard. All time windows are
 * relative to `now`. Returns 0s when the DB is unavailable — the ops page
 * stays readable in degraded mode.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type SignupMetrics = {
  total: number;
  last7d: number;
  last30d: number;
  /** One bar per day for the last 30 days, oldest first. */
  daily: Array<{ date: string; count: number }>;
};

export async function getSignupMetrics(): Promise<SignupMetrics> {
  return safeDb(async () => {
    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);

    const [totalRow] = await db
      .select({ c: count() })
      .from(users)
      .where(eq(users.isGuest, false));
    const [last7Row] = await db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.isGuest, false), gte(users.createdAt, since7)));
    const [last30Row] = await db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.isGuest, false), gte(users.createdAt, since30)));

    const dailyRows = await db
      .select({
        day: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`,
        c: count(),
      })
      .from(users)
      .where(and(eq(users.isGuest, false), gte(users.createdAt, since30)))
      .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`);

    const byDay = new Map(dailyRows.map((r) => [r.day, Number(r.c)]));
    const daily: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      const key = d.toISOString().slice(0, 10);
      daily.push({ date: key, count: byDay.get(key) ?? 0 });
    }

    return {
      total: Number(totalRow?.c ?? 0),
      last7d: Number(last7Row?.c ?? 0),
      last30d: Number(last30Row?.c ?? 0),
      daily,
    };
  }, { total: 0, last7d: 0, last30d: 0, daily: [] });
}

export type ActivityMetrics = {
  dau: number;
  wau: number;
  mau: number;
  repsLast7d: number;
  repsLast30d: number;
  repsTotal: number;
};

export async function getActivityMetrics(): Promise<ActivityMetrics> {
  return safeDb(async () => {
    const now = new Date();
    const since1 = new Date(now.getTime() - 1 * DAY_MS);
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);

    const dauRows = await db
      .selectDistinct({ userId: reps.userId })
      .from(reps)
      .where(gte(reps.createdAt, since1));
    const wauRows = await db
      .selectDistinct({ userId: reps.userId })
      .from(reps)
      .where(gte(reps.createdAt, since7));
    const mauRows = await db
      .selectDistinct({ userId: reps.userId })
      .from(reps)
      .where(gte(reps.createdAt, since30));

    const [rep7Row] = await db
      .select({ c: count() })
      .from(reps)
      .where(gte(reps.createdAt, since7));
    const [rep30Row] = await db
      .select({ c: count() })
      .from(reps)
      .where(gte(reps.createdAt, since30));
    const [repTotalRow] = await db.select({ c: count() }).from(reps);

    return {
      dau: dauRows.length,
      wau: wauRows.length,
      mau: mauRows.length,
      repsLast7d: Number(rep7Row?.c ?? 0),
      repsLast30d: Number(rep30Row?.c ?? 0),
      repsTotal: Number(repTotalRow?.c ?? 0),
    };
  }, { dau: 0, wau: 0, mau: 0, repsLast7d: 0, repsLast30d: 0, repsTotal: 0 });
}

export type FunnelMetrics = {
  signedUp: number;
  pickedVertical: number;
  pickedPersonas: number;
  pickedGoals: number;
  sawTutorial: number;
  ranFirstRep: number;
};

export async function getFunnelMetrics(): Promise<FunnelMetrics> {
  return safeDb(async () => {
    const [signedUp] = await db
      .select({ c: count() })
      .from(users)
      .where(eq(users.isGuest, false));

    const [pickedVertical] = await db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.isGuest, false), sql`${users.vertical} IS NOT NULL`));

    const [pickedPersonas] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.isGuest, false),
          sql`jsonb_array_length(${users.personas}) > 0`,
        ),
      );

    const [pickedGoals] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.isGuest, false),
          sql`jsonb_array_length(${users.improvementGoals}) > 0`,
        ),
      );

    const [sawTutorial] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.isGuest, false),
          sql`${users.tutorialSeenAt} IS NOT NULL`,
        ),
      );

    const firstRepRows = await db
      .selectDistinct({ userId: reps.userId })
      .from(reps)
      .innerJoin(users, eq(users.id, reps.userId))
      .where(eq(users.isGuest, false));

    return {
      signedUp: Number(signedUp?.c ?? 0),
      pickedVertical: Number(pickedVertical?.c ?? 0),
      pickedPersonas: Number(pickedPersonas?.c ?? 0),
      pickedGoals: Number(pickedGoals?.c ?? 0),
      sawTutorial: Number(sawTutorial?.c ?? 0),
      ranFirstRep: firstRepRows.length,
    };
  }, {
    signedUp: 0,
    pickedVertical: 0,
    pickedPersonas: 0,
    pickedGoals: 0,
    sawTutorial: 0,
    ranFirstRep: 0,
  });
}

export type RecentSignup = {
  id: string;
  emailDomain: string;
  vertical: string | null;
  createdAt: Date;
  onboardedAt: Date | null;
  tutorialSeenAt: Date | null;
  hasRepped: boolean;
};

export async function getRecentSignups(limit = 20): Promise<RecentSignup[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        vertical: users.vertical,
        createdAt: users.createdAt,
        onboardedAt: users.onboardedAt,
        tutorialSeenAt: users.tutorialSeenAt,
      })
      .from(users)
      .where(eq(users.isGuest, false))
      .orderBy(desc(users.createdAt))
      .limit(limit);

    const result: RecentSignup[] = [];
    for (const r of rows) {
      const [hasRepRow] = await db
        .select({ c: count() })
        .from(reps)
        .where(eq(reps.userId, r.id))
        .limit(1);
      result.push({
        id: r.id,
        emailDomain: extractDomain(r.email),
        vertical: r.vertical,
        createdAt: r.createdAt,
        onboardedAt: r.onboardedAt ?? null,
        tutorialSeenAt: r.tutorialSeenAt ?? null,
        hasRepped: Number(hasRepRow?.c ?? 0) > 0,
      });
    }
    return result;
  }, []);
}

export type VerticalCount = { vertical: string; count: number };

export async function getTopVerticals(): Promise<VerticalCount[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        vertical: users.vertical,
        c: count(),
      })
      .from(users)
      .where(and(eq(users.isGuest, false), sql`${users.vertical} IS NOT NULL`))
      .groupBy(users.vertical)
      .orderBy(desc(count()));

    return rows
      .filter((r) => r.vertical !== null)
      .map((r) => ({
        vertical: r.vertical as string,
        count: Number(r.c),
      }));
  }, []);
}

function extractDomain(email: string | null): string {
  if (!email) return "—";
  const at = email.lastIndexOf("@");
  if (at < 0) return "—";
  return email.slice(at + 1);
}
