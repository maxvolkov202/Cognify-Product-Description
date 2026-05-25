import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { weeklyReports, reps } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import {
  WeeklyNarrativeSchema,
  type WeeklyNarrative,
} from "@/lib/ai/weekly-summary";

/**
 * Cross-session cache for the Claude-generated weekly coaching narrative.
 * Uniqueness is (userId, weekStartIso). Writes happen from the nightly
 * cron OR lazily on first /api/weekly-narrative call within the week.
 */

export async function getWeeklyReportForWeek(
  userId: string,
  weekStartIso: string,
): Promise<{ narrative: WeeklyNarrative; generatedAt: Date } | null> {
  return safeDb(async () => {
    const rows = await db
      .select({
        narrative: weeklyReports.narrative,
        generatedAt: weeklyReports.generatedAt,
      })
      .from(weeklyReports)
      .where(
        and(
          eq(weeklyReports.userId, userId),
          eq(weeklyReports.weekStartIso, weekStartIso),
        ),
      )
      .orderBy(desc(weeklyReports.generatedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const parsed = WeeklyNarrativeSchema.safeParse(row.narrative);
    if (!parsed.success) {
      console.warn(
        JSON.stringify({
          event: "weekly_reports.narrative_invalid",
          userId,
          weekStartIso,
          issues: parsed.error.issues.map((i) => i.message),
        }),
      );
      return null;
    }
    return { narrative: parsed.data, generatedAt: row.generatedAt };
  }, null);
}

/**
 * Upsert a weekly narrative. Same (userId, weekStartIso) pair just bumps
 * the narrative + generatedAt. Idempotent.
 */
export async function upsertWeeklyReport(opts: {
  userId: string;
  weekStartIso: string;
  narrative: WeeklyNarrative;
}): Promise<void> {
  await safeDb(async () => {
    const existing = await db
      .select({ id: weeklyReports.id })
      .from(weeklyReports)
      .where(
        and(
          eq(weeklyReports.userId, opts.userId),
          eq(weeklyReports.weekStartIso, opts.weekStartIso),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(weeklyReports)
        .set({ narrative: opts.narrative, generatedAt: new Date() })
        .where(eq(weeklyReports.id, existing[0].id));
    } else {
      await db.insert(weeklyReports).values({
        userId: opts.userId,
        weekStartIso: opts.weekStartIso,
        narrative: opts.narrative,
      });
    }
    return null;
  }, null);
}

/**
 * Active-user universe for the weekly cron — anyone who has completed
 * at least one rep in the last 14 days. Narrow window keeps the cron's
 * Claude spend bounded and avoids writing reports for dormant accounts
 * who'll never see them.
 */
export async function getActiveUserIdsForWeeklyReport(): Promise<string[]> {
  return safeDb(async () => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await db
      .selectDistinct({ userId: reps.userId })
      .from(reps)
      .where(gte(reps.createdAt, since))
      .limit(5000);
    return rows.map((r) => r.userId);
  }, []);
}

/**
 * Helper — returns the Monday ISO date (YYYY-MM-DD) for the week
 * containing `now`. Used as the `weekStartIso` key for cache rows.
 */
export function currentWeekStartIso(now: Date = new Date()): string {
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
  return monday.toISOString().slice(0, 10);
}

// Silence unused-var warning for sql import — we may need it for
// subsequent queries; keeping the import local prevents churn later.
void sql;
