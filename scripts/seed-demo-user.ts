/**
 * Phase 11.C — demo-user seeder.
 *
 * Creates `demo@cognify.test` with ~3 weeks of plausible, deterministic
 * history so every surface renders POPULATED during eyes-on testing:
 * daily-workout days + reps with dimension scores AND hidden-skill
 * signals, retry lineage + coaching ledger (mixed verdicts), two Skill
 * Lab sessions (application + skill folds), one Build a Rep event with
 * practiced moments + a readiness review, achievements, weekly-challenge
 * progress, XP/rank (~Silver), and a live streak on committed days.
 *
 * The Communication Profile is produced by replaying the SAME
 * applyRepToProfile fold production uses — no hand-rolled numbers.
 *
 *   npx tsx scripts/seed-demo-user.ts            # create/refresh
 *   npx tsx scripts/seed-demo-user.ts --reset    # wipe + reseed
 *
 * Dev-only: refuses to run when DATABASE_URL looks like production.
 * Login: demo@cognify.test / cognify-demo-7h2p9w!D
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEMO_EMAIL = "demo@cognify.test";
const DEMO_PASSWORD = "cognify-demo-7h2p9w!D";
const DAYS = 21;

// ── Demo-guard interlock (prod runbook risk #4) ─────────────────────────
// The /prod/i regex below likely never matches a real Supabase prod
// hostname (they look like db.<ref>.supabase.co / aws-0-<region>
// poolers). The ACTUAL hole: dotenv never overrides pre-set vars, so a
// shell-exported prod DATABASE_URL — exactly the state the prod-seeding
// procedure leaves behind — silently wins over .env.local. Interlock:
// the effective DATABASE_URL host must MATCH the host in .env.local.

function dbHostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host ? host.toLowerCase() : null;
  } catch {
    // Unencoded credentials can break WHATWG parsing — fall back to a
    // last-@ host grab.
    const m = url.match(/@\[?([^/@\s:\]?]+)[^@]*$/);
    return m?.[1]?.toLowerCase() ?? null;
  }
}

function envLocalDatabaseUrl(envLocalPath: string): string | null {
  if (!existsSync(envLocalPath)) return null;
  for (const line of readFileSync(envLocalPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v || null;
  }
  return null;
}

function assertDbHostMatchesEnvLocal(
  effectiveUrl: string,
  envLocalPath: string,
): void {
  const fileUrl = envLocalDatabaseUrl(envLocalPath);
  if (!fileUrl) {
    console.warn(
      `[guard] no DATABASE_URL found in ${envLocalPath} — host interlock skipped (regex guard still applies).`,
    );
    return;
  }
  const fileHost = dbHostOf(fileUrl);
  const envHost = dbHostOf(effectiveUrl);
  if (!fileHost || !envHost) {
    throw new Error(
      "Refusing to run: could not parse a host out of DATABASE_URL (env and/or .env.local) — fix the URL(s) before seeding.",
    );
  }
  if (fileHost !== envHost) {
    throw new Error(
      `Refusing to run: process.env.DATABASE_URL points at host "${envHost}" but .env.local points at "${fileHost}". ` +
        `A shell-exported DATABASE_URL is overriding .env.local (dotenv never overrides pre-set vars) — ` +
        `likely left over from a prod procedure. Unset it or update .env.local, then re-run.`,
    );
  }
}

// Deterministic PRNG (mulberry32) — same seed, same demo user.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  if (/prod/i.test(dbUrl) && !/dev|local|staging/i.test(dbUrl)) {
    throw new Error("Refusing to seed a production-looking DATABASE_URL");
  }
  // Second layer (see the interlock docs above): the effective
  // DATABASE_URL host must match .env.local's, or a shell export is
  // steering this seeder at a different (possibly prod) database.
  assertDbHostMatchesEnvLocal(dbUrl, resolve(process.cwd(), ".env.local"));

  const { createClient } = await import("@supabase/supabase-js");
  const { db } = await import("../src/lib/db/client");
  const schema = await import("../src/lib/db/schema");
  const { eq, and, asc } = await import("drizzle-orm");
  const { encodeDimensionSignals } = await import(
    "../src/lib/scoring/signals"
  );
  const { applyRepToProfile, emptyProfile } = await import(
    "../src/lib/profile/communication-profile"
  );
  const { SUB_SKILLS } = await import("../src/types/sub-skills");
  const { SKILL_DIMENSIONS } = await import("../src/types/domain");
  const { muscleGroupToSkillDim } = await import(
    "../src/lib/scoring/dimension-aliases"
  );

  const rand = rng(20260706);
  const reset = process.argv.includes("--reset");

  // ── 1. Auth user + app user ───────────────────────────────────────────
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "Demo Volkov" },
  });
  let authId = created.data.user?.id ?? null;
  if (!authId) {
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    authId =
      list.data.users.find((u) => u.email === DEMO_EMAIL)?.id ?? null;
  }
  if (!authId) throw new Error("Could not create/find the demo auth user");

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, DEMO_EMAIL),
  });
  let userId: string;
  if (existing) {
    userId = existing.id;
    if (reset) {
      console.log("[seed-demo] --reset: wiping demo history…");
      // Order respects FKs; most cascade from reps/session/event deletes.
      await db.delete(schema.coachingEvents).where(eq(schema.coachingEvents.userId, userId));
      await db.delete(schema.reps).where(eq(schema.reps.userId, userId));
      await db.delete(schema.practiceSessions).where(eq(schema.practiceSessions.userId, userId));
      await db.delete(schema.muscleGroupDays).where(eq(schema.muscleGroupDays.userId, userId));
      await db.delete(schema.prepEvents).where(eq(schema.prepEvents.userId, userId));
      await db.delete(schema.userAchievements).where(eq(schema.userAchievements.userId, userId));
      await db.delete(schema.weeklyChallenges).where(eq(schema.weeklyChallenges.userId, userId));
      await db.delete(schema.progressSnapshots).where(eq(schema.progressSnapshots.userId, userId));
      await db.delete(schema.communicationProfile).where(eq(schema.communicationProfile.userId, userId));
    } else {
      const repCount = await db
        .select({ id: schema.reps.id })
        .from(schema.reps)
        .where(eq(schema.reps.userId, userId))
        .limit(1);
      if (repCount.length > 0) {
        console.log(
          "[seed-demo] demo user already has history — pass --reset to reseed.",
        );
        console.log(`[seed-demo] login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
        process.exit(0);
      }
    }
  } else {
    const [row] = await db
      .insert(schema.users)
      .values({
        email: DEMO_EMAIL,
        name: "Demo Volkov",
        authUserId: authId,
        vertical: "sales",
        personas: ["prospects", "executives"],
        improvementGoals: ["think_on_feet", "executive_presence"],
        committedDays: 31, // Mon-Fri
        tz: "America/New_York",
        communicationStage: "manager",
        onboardedAt: new Date(),
        tutorialSeenAt: new Date(),
      })
      .returning({ id: schema.users.id });
    userId = row!.id;
  }
  console.log(`[seed-demo] user ${userId}`);

  // ── 2. Catalog lookups ────────────────────────────────────────────────
  const catalog = await db
    .select({
      id: schema.exercises.id,
      dimension: schema.exercises.dimension,
      application: schema.exercises.application,
      applicationSkills: schema.exercises.applicationSkills,
      name: schema.exercises.name,
    })
    .from(schema.exercises)
    .where(eq(schema.exercises.isActive, true));
  const coreByDim = new Map<string, typeof catalog>();
  for (const ex of catalog) {
    if (ex.application) continue;
    const list = coreByDim.get(ex.dimension as string) ?? [];
    list.push(ex);
    coreByDim.set(ex.dimension as string, list);
  }
  const storyExercises = catalog.filter(
    (e) => e.application === "storytelling",
  );

  const MG_DIMS = ["clarity", "structure", "conciseness", "thinking_quality", "pacing", "tone"];
  const PROMPTS = [
    "Explain your product to a skeptical CFO in under a minute.",
    "Walk your team through the plan for next quarter.",
    "Describe the hardest deal you closed this year.",
    "Give a colleague feedback on a missed deadline.",
    "Pitch a process change to your VP.",
    "Explain a technical concept to a new hire.",
  ];

  // ── 3. Synthesize 21 days of history ─────────────────────────────────
  type Evidence = Parameters<typeof applyRepToProfile>[1];
  const evidenceLog: Evidence[] = [];
  let repTotal = 0;

  const now = new Date();
  for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
    const day = new Date(now.getTime() - daysAgo * 86_400_000);
    const dow = day.getDay(); // 0 Sun
    if (dow === 0 || dow === 6) continue; // committed Mon-Fri
    if (rand() < 0.15) continue; // occasional miss (freeze territory)

    const mgDim = MG_DIMS[(DAYS - daysAgo) % 6]!;
    const skillDim = muscleGroupToSkillDim(mgDim) ?? "clarity";
    const dayBase = 55 + Math.round(((DAYS - daysAgo) / DAYS) * 18); // 55→73 arc
    const dayDate = day.toISOString().slice(0, 10);

    const exList = coreByDim.get(mgDim) ?? coreByDim.get(skillDim) ?? [];
    const pick = () => exList[Math.floor(rand() * exList.length)] ?? null;
    const planned = [pick(), pick(), pick()].filter(Boolean);

    const [session] = await db
      .insert(schema.practiceSessions)
      .values({
        userId,
        mode: "daily_workout",
        sessionType: "focus",
        startedAt: new Date(day.getTime() + 18 * 3_600_000),
        endedAt: new Date(day.getTime() + 18.4 * 3_600_000),
        compositeScore: dayBase,
      })
      .returning({ id: schema.practiceSessions.id });

    const [mgDay] = await db
      .insert(schema.muscleGroupDays)
      .values({
        userId,
        dayDate,
        dimension: mgDim as never,
        status: "complete",
        completedReps: 3,
        plannedExerciseIds: planned.map((e) => e!.id),
        compositeAtClose: dayBase,
        completedAt: new Date(day.getTime() + 19 * 3_600_000),
      })
      .onConflictDoNothing()
      .returning({ id: schema.muscleGroupDays.id });

    // 3 exercises × (first + retry)
    for (let ex = 0; ex < 3; ex++) {
      const exercise = planned[ex] ?? null;
      let parentId: string | null = null;
      let firstComposite = 0;
      for (const attempt of ["first", "retry"] as const) {
        const lift = attempt === "retry" ? 4 + Math.round(rand() * 6) : 0;
        const composite = Math.max(
          35,
          Math.min(92, dayBase + Math.round(rand() * 10 - 5) + lift),
        );
        if (attempt === "first") firstComposite = composite;
        const at = new Date(
          day.getTime() + (18 + ex * 0.12 + (attempt === "retry" ? 0.06 : 0)) * 3_600_000,
        );
        const dims = SKILL_DIMENSIONS.map((d) => ({
          dimension: d,
          score: Math.max(
            30,
            Math.min(
              95,
              composite +
                Math.round(rand() * 14 - 7) +
                (d === skillDim ? 3 : 0),
            ),
          ),
        }));
        // Annotated: parentRepId inside .values() reads parentId, which
        // is assigned from rep.id below — tsc flags the cycle otherwise.
        const [rep]: { id: string }[] = await db
          .insert(schema.reps)
          .values({
            userId,
            sessionId: session!.id,
            promptText: PROMPTS[Math.floor(rand() * PROMPTS.length)]!,
            topic: exercise?.name ?? "Daily rep",
            durationMs: 45_000 + Math.round(rand() * 30_000),
            transcript: { text: "(seeded demo rep)" },
            compositeScore: composite,
            modelVersion: "seed-demo-v1",
            rubricVersion: "v3.3.0",
            status: "completed",
            exerciseId: exercise?.id ?? null,
            muscleGroupDayId: mgDay?.id ?? null,
            attemptKind: attempt,
            parentRepId: attempt === "retry" ? parentId : null,
            createdAt: at,
          })
          .returning({ id: schema.reps.id });
        if (attempt === "first") parentId = rep!.id;
        repTotal++;

        // Hidden-skill signals: 3 of the dim's sub-skills per rep.
        const subSkillScores: Record<string, number> = {};
        const skills = SUB_SKILLS[skillDim] ?? [];
        for (let i = 0; i < Math.min(3, skills.length); i++) {
          const sk = skills[Math.floor(rand() * skills.length)]!;
          subSkillScores[sk] = Math.max(
            30,
            Math.min(95, composite + Math.round(rand() * 12 - 6)),
          );
        }
        for (const d of dims) {
          await db.insert(schema.dimensionScores).values({
            repId: rep!.id,
            dimension: d.dimension as never,
            score: d.score,
            signals:
              d.dimension === skillDim
                ? (encodeDimensionSignals([], subSkillScores) as never)
                : null,
          });
          await db.insert(schema.progressSnapshots).values({
            userId,
            dimension: d.dimension as never,
            score: d.score,
            takenAt: at,
          });
        }
        evidenceLog.push({
          dimensions: dims,
          subSkillScores,
          at: at.toISOString(),
        });

        // Coaching ledger: one focus per first attempt; retry back-fills.
        if (attempt === "first") {
          const weakest = [...dims].sort((a, b) => a.score - b.score)[0]!;
          await db.insert(schema.coachingEvents).values({
            userId,
            repId: rep!.id,
            dimension: weakest.dimension as never,
            focusText: `Tighten your ${weakest.dimension.replace("_", " ")} — one idea per sentence.`,
            implementedVerdict:
              rand() < 0.55 ? "nailed" : rand() < 0.6 ? "partial" : "missed",
            createdAt: at,
          });
        }
      }
    }
  }

  // ── 4. Two Skill Lab sessions (storytelling) ─────────────────────────
  for (let s = 0; s < 2; s++) {
    const day = new Date(now.getTime() - (6 - s * 3) * 86_400_000);
    const [session] = await db
      .insert(schema.practiceSessions)
      .values({
        userId,
        mode: "skill_lab",
        sessionType: "focus",
        startedAt: day,
        endedAt: new Date(day.getTime() + 20 * 60_000),
        compositeScore: 68 + s * 5,
      })
      .returning({ id: schema.practiceSessions.id });
    for (let i = 0; i < 3; i++) {
      const exercise =
        storyExercises[Math.floor(rand() * storyExercises.length)] ?? null;
      if (!exercise) continue;
      const composite = 62 + s * 5 + Math.round(rand() * 10);
      const dims = SKILL_DIMENSIONS.map((d) => ({
        dimension: d,
        score: Math.max(35, Math.min(92, composite + Math.round(rand() * 10 - 5))),
      }));
      const at = new Date(day.getTime() + i * 6 * 60_000);
      await db.insert(schema.reps).values({
        userId,
        sessionId: session!.id,
        promptText: "Tell the story of a project that changed direction midway.",
        topic: exercise.name,
        durationMs: 70_000,
        transcript: { text: "(seeded demo lab rep)" },
        compositeScore: composite,
        modelVersion: "seed-demo-v1",
        rubricVersion: "v3.3.0",
        status: "completed",
        exerciseId: exercise.id,
        createdAt: at,
      });
      repTotal++;
      evidenceLog.push({
        dimensions: dims,
        applicationId: "storytelling",
        applicationSkills: exercise.applicationSkills ?? [],
        composite,
        at: at.toISOString(),
      });
    }
  }

  // ── 5. Build a Rep event with history ─────────────────────────────────
  const [event] = await db
    .insert(schema.prepEvents)
    .values({
      userId,
      title: "Quarterly business review with the exec team",
      description: "QBR presentation to our VP and CRO next Thursday",
      eventType: "presentation",
      recommendedMode: "guided",
      recommendedDurationSec: 540,
      readinessScore: 71,
    })
    .returning({ id: schema.prepEvents.id });
  const momentTitles: [string, string, number][] = [
    ["Opening", "Earn attention in 30 seconds and preview the arc.", 60],
    ["Pipeline story", "The quarter's numbers as a narrative, not a table.", 120],
    ["The miss", "Own the shortfall plainly, with the fix attached.", 90],
    ["Next quarter's plan", "Three bets, each with an owner and a date.", 120],
    ["The ask", "One clear request of the room.", 60],
  ];
  for (let i = 0; i < momentTitles.length; i++) {
    const [t, obj, sec] = momentTitles[i]!;
    await db.insert(schema.criticalMoments).values({
      eventId: event!.id,
      userId,
      title: t,
      objective: obj,
      recommendedSeconds: sec,
      sortOrder: i,
      source: "generated",
      attempts: i < 2 ? 2 : 0,
      bestComposite: i === 0 ? 74 : i === 1 ? 69 : null,
      lastPracticedAt: i < 2 ? new Date(now.getTime() - 2 * 86_400_000) : null,
    });
  }
  await db.insert(schema.readinessReviews).values({
    eventId: event!.id,
    userId,
    mode: "guided",
    overallScore: 71,
    coreSkills: {
      clarity: { score: 74, why: "Openings landed cleanly.", well: "Direct first sentences.", improve: "Keep the same directness under Q&A." },
      structure: { score: 68, why: "The middle sections wandered.", well: "Strong signposting up top.", improve: "Bridge each section with one linking line." },
    },
    coachFeedback:
      "Before the QBR, run 'The miss' twice more — owning the shortfall without hedging is your highest-impact move.",
    readinessSummary:
      "You're walking in at 71. Openings are your anchor; the ownership moment is the one thing to sharpen. Trust the reps.",
  });

  // ── 6. Profile replay (the REAL fold), XP/rank, achievements, week ───
  evidenceLog.sort((a, b) => (a.at < b.at ? -1 : 1));
  let profile = emptyProfile();
  for (const ev of evidenceLog) profile = applyRepToProfile(profile, ev);
  await db
    .insert(schema.communicationProfile)
    .values({
      userId,
      overallScore: profile.overallScore,
      coreSkills: profile.coreSkills as never,
      hiddenSkills: profile.hiddenSkills as never,
      applications: profile.applications as never,
      totalReps: profile.totalReps,
    })
    .onConflictDoUpdate({
      target: schema.communicationProfile.userId,
      set: {
        overallScore: profile.overallScore,
        coreSkills: profile.coreSkills as never,
        hiddenSkills: profile.hiddenSkills as never,
        applications: profile.applications as never,
        totalReps: profile.totalReps,
        updatedAt: new Date(),
      },
    });

  const xp = 3400; // ≈ Silver II — visible rank progress without endgame
  const { levelFromXp } = await import("../src/lib/progression/levels");
  await db
    .update(schema.users)
    .set({
      xp,
      level: levelFromXp(xp),
      lifetimeReps: repTotal,
      streakFreezes: 2,
    })
    .where(eq(schema.users.id, userId));

  for (const a of [
    "vol_first_rep",
    "vol_10_reps",
    "vol_50_reps",
    "mg_day_complete_first",
    "explore_focus_drill",
  ]) {
    await db
      .insert(schema.userAchievements)
      .values({ userId, achievementId: a })
      .onConflictDoNothing();
  }

  const { getOrCreateThisWeekChallenges, recordWeeklyChallengeEvent } =
    await import("../src/lib/db/queries/weekly-challenges");
  await getOrCreateThisWeekChallenges(userId);
  for (let i = 0; i < 6; i++) {
    await recordWeeklyChallengeEvent(userId, {
      mode: "daily_workout",
      composite: 78,
      implementedRetry: i % 2 === 0,
      newTrainingDay: i < 2,
      trainedOnCommittedDay: i < 2,
    });
  }

  // Keep the streak alive: getStreakDays walks consecutive days back
  // from today/yesterday — the 21-day weekday history covers it.
  const check = await db
    .select({ id: schema.reps.id })
    .from(schema.reps)
    .where(and(eq(schema.reps.userId, userId)))
    .orderBy(asc(schema.reps.createdAt))
    .limit(1);
  console.log(
    `[seed-demo] done — ${repTotal} reps, profile overall=${profile.overallScore}, first rep ${check[0]?.id?.slice(0, 8)}…`,
  );
  console.log(`[seed-demo] login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  const e = err as { message?: string };
  console.error("[seed-demo] failed:", e?.message ?? String(err));
  process.exit(1);
});
