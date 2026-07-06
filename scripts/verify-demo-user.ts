/**
 * Phase 11.C — sanity check the demo account after seeding.
 *
 * Reads back everything the app's surfaces render from, using the SAME
 * production reads (buildCommunicationSnapshot), so a green run means the
 * dashboard/progress/profile pages will be populated.
 *
 *   npx tsx scripts/verify-demo-user.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db/client");
  const schema = await import("../src/lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, "demo@cognify.test"),
  });
  if (!user) throw new Error("demo user missing — run seed-demo-user.ts first");
  const uid = user.id;

  const count = async (t: unknown) => {
    const table = t as typeof schema.reps; // only .userId is touched
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.userId, uid));
    return Number(rows[0]!.n);
  };

  const counts = {
    reps: await count(schema.reps),
    coachingEvents: await count(schema.coachingEvents),
    muscleGroupDays: await count(schema.muscleGroupDays),
    practiceSessions: await count(schema.practiceSessions),
    prepEvents: await count(schema.prepEvents),
    achievements: await count(schema.userAchievements),
    weeklyChallenges: await count(schema.weeklyChallenges),
  };
  console.log("[verify-demo] counts:", JSON.stringify(counts));
  console.log(
    `[verify-demo] xp=${user.xp} onboarded=${Boolean(user.onboardedAt)}`,
  );

  const profile = await db.query.communicationProfile.findFirst({
    where: eq(schema.communicationProfile.userId, uid),
  });
  const apps = (profile?.applications ?? {}) as Record<string, unknown>;
  console.log(
    `[verify-demo] profile overall=${profile?.overallScore} totalReps=${profile?.totalReps} apps=[${Object.keys(apps).join(", ")}]`,
  );

  const { buildCommunicationSnapshot } = await import(
    "../src/lib/profile/snapshot"
  );
  const snap = (await buildCommunicationSnapshot(uid)) as Record<
    string,
    unknown
  > | null;
  if (!snap) throw new Error("snapshot came back null");
  console.log(
    `[verify-demo] snapshot overall=${(snap.profile as { overallScore?: number } | undefined)?.overallScore} weakestCoreSkill=${JSON.stringify(snap.weakestCoreSkill)}`,
  );
  console.log(
    "[verify-demo] trends:",
    JSON.stringify(snap.improvementTrends ?? null)?.slice(0, 300),
  );
  console.log(
    "[verify-demo] coachingEffectiveness:",
    JSON.stringify(snap.coachingEffectiveness ?? null)?.slice(0, 300),
  );
  console.log(
    "[verify-demo] strongestApplication:",
    JSON.stringify(snap.strongestApplication ?? null),
  );

  const problems: string[] = [];
  if (counts.reps < 40) problems.push(`too few reps (${counts.reps})`);
  if (counts.coachingEvents < 10)
    problems.push(`too few coaching events (${counts.coachingEvents})`);
  if (counts.muscleGroupDays < 8)
    problems.push(`too few workout days (${counts.muscleGroupDays})`);
  if (counts.practiceSessions < 2)
    problems.push(`missing lab sessions (${counts.practiceSessions})`);
  if (counts.prepEvents < 1) problems.push("missing prep event");
  if (!profile || (profile.totalReps ?? 0) < 40)
    problems.push("profile not replayed");
  if (Object.keys(apps).length < 1) problems.push("no application coverage");
  if ((user.xp ?? 0) < 1000) problems.push(`xp too low (${user.xp})`);

  if (problems.length) {
    console.error("[verify-demo] FAIL:", problems.join("; "));
    process.exit(1);
  }
  console.log("[verify-demo] OK — all surfaces have data to render.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[verify-demo] failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
