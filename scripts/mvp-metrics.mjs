/**
 * PRD v3 Appendix A.6 — MVP success-criteria report.
 *
 * "Success will be measured by users who: complete Daily Workouts
 * consistently, engage with Skill Lab and Build a Rep, implement
 * coaching during Retries, improve their Communication Scores over
 * time, develop sustainable communication habits."
 *
 * This script turns each criterion into a number from the live DB.
 * Run ad hoc (ops) or wire into a weekly report later.
 *
 *   node scripts/mvp-metrics.mjs
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[mvp-metrics] DATABASE_URL not set");
    process.exit(1);
  }
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const [{ wau }] = await sql`
      SELECT COUNT(DISTINCT user_id)::int AS wau
      FROM cognify_v2.reps
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;

    // 1) Daily Workout consistency: active users with ≥3 distinct
    //    workout-mode training days in the last 7.
    const [{ consistent }] = await sql`
      SELECT COUNT(*)::int AS consistent FROM (
        SELECT r.user_id
        FROM cognify_v2.reps r
        JOIN cognify_v2.practice_sessions ps ON ps.id = r.session_id
        WHERE ps.mode = 'daily_workout'
          AND r.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY r.user_id
        HAVING COUNT(DISTINCT r.created_at::date) >= 3
      ) t
    `;

    // 2) Cross-mode engagement: users touching ≥2 modes in 28 days.
    const [{ multimode }] = await sql`
      SELECT COUNT(*)::int AS multimode FROM (
        SELECT r.user_id
        FROM cognify_v2.reps r
        JOIN cognify_v2.practice_sessions ps ON ps.id = r.session_id
        WHERE r.created_at >= NOW() - INTERVAL '28 days'
        GROUP BY r.user_id
        HAVING COUNT(DISTINCT ps.mode) >= 2
      ) t
    `;

    // 3) Retry implementation rate (28 days): retried focuses that were
    //    implemented (nailed or partial) / all retried focuses.
    const [impl] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE implemented_verdict IN ('nailed','partial'))::int AS implemented,
        COUNT(*) FILTER (WHERE implemented_verdict IS NOT NULL)::int AS retried,
        COUNT(*)::int AS coached
      FROM cognify_v2.coaching_events
      WHERE created_at >= NOW() - INTERVAL '28 days'
    `;

    // 4) Communication improvement: this-week vs prior-week avg composite
    //    for users active in both windows.
    const improvement = await sql`
      WITH weekly AS (
        SELECT user_id,
          AVG(composite_score) FILTER (
            WHERE created_at >= NOW() - INTERVAL '7 days') AS this_week,
          AVG(composite_score) FILTER (
            WHERE created_at >= NOW() - INTERVAL '14 days'
              AND created_at < NOW() - INTERVAL '7 days') AS prior_week
        FROM cognify_v2.reps
        WHERE created_at >= NOW() - INTERVAL '14 days'
          AND composite_score IS NOT NULL
        GROUP BY user_id
      )
      SELECT COUNT(*)::int AS users,
             COUNT(*) FILTER (WHERE this_week > prior_week)::int AS improved,
             ROUND(AVG(this_week - prior_week)::numeric, 1) AS avg_delta
      FROM weekly
      WHERE this_week IS NOT NULL AND prior_week IS NOT NULL
    `;

    // 5) Habit: distinct training days per active user, last 14 days.
    const habit = await sql`
      SELECT ROUND(AVG(days)::numeric, 1) AS avg_days,
             COUNT(*) FILTER (WHERE days >= 6)::int AS habitual
      FROM (
        SELECT user_id, COUNT(DISTINCT created_at::date)::int AS days
        FROM cognify_v2.reps
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY user_id
      ) t
    `;

    // 6) Communication Score coverage (profile EMA).
    const [profile] = await sql`
      SELECT COUNT(*)::int AS profiles,
             COUNT(*) FILTER (WHERE overall_score IS NOT NULL)::int AS with_overall,
             ROUND(AVG(overall_score)::numeric, 1) AS avg_overall
      FROM cognify_v2.communication_profile
    `;

    console.log("═══ Cognify MVP success metrics (A.6) ═══");
    console.log(`Weekly active users (rep in 7d):        ${wau}`);
    console.log(`  …completing ≥3 workout days/week:     ${consistent}`);
    console.log(`Users on ≥2 modes (28d):                ${multimode}`);
    console.log(
      `Retry implementation rate (28d):        ${
        impl.retried > 0
          ? `${Math.round((impl.implemented / impl.retried) * 100)}% (${impl.implemented}/${impl.retried} retried, ${impl.coached} coached)`
          : `n/a (0 retried, ${impl.coached} coached)`
      }`,
    );
    const imp = improvement[0];
    console.log(
      `Week-over-week improvement:             ${
        imp && imp.users > 0
          ? `${imp.improved}/${imp.users} users improved, avg ${imp.avg_delta} pts`
          : "n/a (needs 2 weeks of data)"
      }`,
    );
    const hab = habit[0];
    console.log(
      `Habit (14d):                            avg ${hab?.avg_days ?? "n/a"} training days; ${hab?.habitual ?? 0} users ≥6 days`,
    );
    console.log(
      `Communication Score coverage:           ${profile.with_overall}/${profile.profiles} profiles (avg ${profile.avg_overall ?? "n/a"})`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[mvp-metrics] failed:", err);
  process.exit(1);
});
