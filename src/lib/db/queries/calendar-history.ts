import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reps, users } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

export type CalendarDay = {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
  composite: number;
  hasPressure: boolean;
};

export type CalendarHistory = {
  signupDate: string; // YYYY-MM-DD
  signupAt: Date;
  todayDate: string; // YYYY-MM-DD
  daysSinceSignup: number; // 1-based; signup day = 1
  totalReps: number;
  activeDays: number;
  longestStreak: number;
  currentStreak: number;
  days: CalendarDay[]; // every signup→today date inclusive, even zero-rep days
};

/**
 * Aggregate per-day rep activity from signup to today, including pressure
 * presence per day for the small amber indicator dot.
 *
 * For 0-rep users: still returns a single day (today/signup) so the modal
 * can render with the signup-glow cell visible.
 */
export async function getCalendarHistory(
  userId: string,
): Promise<CalendarHistory | null> {
  return safeDb(async () => {
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!userRow) return null;
    const signupAt = userRow.createdAt ?? new Date();

    const rows = await db
      .select({
        date: sql<string>`to_char(${reps.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        composite: sql<number>`avg(${reps.compositeScore})::float`,
        pressureCount: sql<number>`count(*) filter (where ${reps.pressureArchetypeId} is not null)::int`,
      })
      .from(reps)
      .where(
        and(
          eq(reps.userId, userId),
          gte(reps.createdAt, signupAt),
        ),
      )
      .groupBy(sql`to_char(${reps.createdAt}, 'YYYY-MM-DD')`);

    const byDate = new Map<string, CalendarDay>();
    for (const r of rows) {
      byDate.set(r.date, {
        date: r.date,
        count: r.count,
        composite: r.composite ?? 0,
        hasPressure: (r.pressureCount ?? 0) > 0,
      });
    }

    // Fill every day from signup → today.
    const signupKey = isoDate(signupAt);
    const todayKey = isoDate(new Date());
    const days: CalendarDay[] = [];
    const cursor = new Date(`${signupKey}T00:00:00Z`);
    const end = new Date(`${todayKey}T00:00:00Z`);
    while (cursor.getTime() <= end.getTime()) {
      const key = isoDate(cursor);
      days.push(
        byDate.get(key) ?? {
          date: key,
          count: 0,
          composite: 0,
          hasPressure: false,
        },
      );
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const totalReps = days.reduce((s, d) => s + d.count, 0);
    const activeDays = days.filter((d) => d.count > 0).length;
    const { longestStreak, currentStreak } = computeStreaks(days);
    const daysSinceSignup = days.length;

    return {
      signupDate: signupKey,
      signupAt,
      todayDate: todayKey,
      daysSinceSignup,
      totalReps,
      activeDays,
      longestStreak,
      currentStreak,
      days,
    };
  }, null);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreaks(days: CalendarDay[]): {
  longestStreak: number;
  currentStreak: number;
} {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  // current streak = trailing run that includes today (or the day before)
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.count > 0) current += 1;
    else break;
  }
  return { longestStreak: longest, currentStreak: current };
}
