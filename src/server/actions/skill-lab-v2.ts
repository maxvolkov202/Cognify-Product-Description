"use server";

// PRD v3 Phase 4 — Skill Lab v2 session lifecycle (PRD §6).
//
// The user chooses the APPLICATION and the session length; Cognify
// chooses everything else (which exercises, which hidden skills, which
// prompts). Exercises come from cognify_v2.exercises rows with
// `application` set; the whole scoring pipeline (exercise XML, scoring
// lens, prompt banks, picker) works on them unchanged.

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  communicationProfile,
  exercises,
  practiceSessions,
  reps,
} from "@/lib/db/schema";
import { buildCommunicationSnapshot } from "@/lib/profile/snapshot";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { log } from "@/lib/log";
import { selectLabExercises } from "@/server/lib/skill-lab/selection";
import {
  isApplicationId,
  type ApplicationId,
} from "@/types/application-skills";
import { isSkillLabAppsEnabled } from "@/lib/flags";

export type AppExercise = {
  exerciseId: string;
  slug: string;
  name: string;
  /** Primary Core Skill (exercises.dimension). */
  dimension: string;
  rule: string;
  why: string | null;
  objective: string | null;
  responseWindow: { minSec: number; maxSec: number } | null;
  applicationSkills: string[] | null;
  /** Phase 11.D2 — Lab Engine V1 Coach's Insight (null pre-enrichment). */
  coachInsight: string | null;
  /** The hidden Application Skill this slot intends to train (weakest
   *  estimated skill the exercise targets) — internal, PRD §8.4.5. */
  targetSkill: string | null;
};

export type StartSkillLabSessionResult =
  | {
      ok: true;
      sessionId: string;
      applicationId: ApplicationId;
      exercises: AppExercise[];
    }
  | { ok: false; reason: "invalid_input" | "no_user" | "no_catalog" | "db_error" | "flag_off" };

const SESSION_LENGTHS = new Set([3, 5, 10]);
/** Exercises used in the user's Skill Lab reps within this window are
 *  deprioritized (PRD §6.6: recently completed exercises deprioritized). */
const APP_DEDUPE_DAYS = 7;

export async function startSkillLabSessionV2(input: {
  applicationId: string;
  count: number;
}): Promise<StartSkillLabSessionResult> {
  if (!isSkillLabAppsEnabled()) return { ok: false, reason: "flag_off" };
  if (!isApplicationId(input.applicationId) || !SESSION_LENGTHS.has(input.count)) {
    return { ok: false, reason: "invalid_input" };
  }
  const user = await currentUser();
  if (!user) return { ok: false, reason: "no_user" };
  const applicationId = input.applicationId;

  return safeDb<StartSkillLabSessionResult>(async () => {
    const rows = await db
      .select({
        id: exercises.id,
        slug: exercises.slug,
        name: exercises.name,
        dimension: exercises.dimension,
        description: exercises.description,
        instructions: exercises.instructions,
        objective: exercises.objective,
        responseWindow: exercises.responseWindow,
        applicationSkills: exercises.applicationSkills,
        coachInsight: exercises.coachInsight,
      })
      .from(exercises)
      .where(
        and(
          eq(exercises.application, applicationId),
          eq(exercises.isActive, true),
        ),
      );
    if (rows.length === 0) return { ok: false as const, reason: "no_catalog" as const };

    // Recently-used exercises in this application (any attempt) get
    // deprioritized so back-to-back sessions feel fresh.
    const cutoff = new Date(Date.now() - APP_DEDUPE_DAYS * 86_400_000);
    const recentRows = await db
      .select({ exerciseId: reps.exerciseId })
      .from(reps)
      .where(
        and(
          eq(reps.userId, user.id),
          gte(reps.createdAt, cutoff),
          inArray(
            reps.exerciseId,
            rows.map((r) => r.id),
          ),
        ),
      )
      .orderBy(desc(reps.createdAt))
      .limit(50);
    const recentIds = new Set(
      recentRows.map((r) => r.exerciseId).filter((id): id is string => !!id),
    );

    // Lab Personalization Engine (PRD §8.4.5): the profile's hidden
    // Application Skill estimates drive which exercises this session
    // trains. Read through the Communication Snapshot (§8.3.11: "Every
    // intelligent system within Cognify begins here") rather than a
    // direct profile query. No snapshot / no estimates yet → balanced
    // baseline mix.
    const snapshot = await buildCommunicationSnapshot(user.id);
    const skillEstimates =
      snapshot?.profile.applications?.[applicationId]?.skills ?? {};

    const seed = `${user.id}:${applicationId}:${new Date().toISOString().slice(0, 10)}`;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const picks = selectLabExercises({
      candidates: rows.map((r) => ({
        id: r.id,
        applicationSkills: r.applicationSkills ?? null,
      })),
      skillEstimates,
      recentExerciseIds: recentIds,
      count: input.count,
      seed,
    });
    const picked = picks.map((p) => ({
      row: byId.get(p.id)!,
      targetSkill: p.targetSkill,
    }));

    const [session] = await db
      .insert(practiceSessions)
      .values({
        userId: user.id,
        mode: "skill_lab",
        sessionType: "focus",
        startedAt: new Date(),
      })
      .returning({ id: practiceSessions.id });
    if (!session) return { ok: false as const, reason: "db_error" as const };

    log.info({
      event: "skill_lab_v2.session_started",
      userId: user.id,
      applicationId,
      count: input.count,
      exerciseSlugs: picked.map((p) => p.row.slug),
      targetSkills: picked.map((p) => p.targetSkill),
    });

    return {
      ok: true as const,
      sessionId: session.id,
      applicationId,
      exercises: picked.map(({ row: r, targetSkill }) => ({
        exerciseId: r.id,
        slug: r.slug,
        name: r.name,
        dimension: r.dimension as string,
        rule: r.description,
        why: r.instructions,
        objective: r.objective ?? null,
        responseWindow: r.responseWindow ?? null,
        applicationSkills: r.applicationSkills ?? null,
        coachInsight: r.coachInsight ?? null,
        targetSkill,
      })),
    };
  }, { ok: false as const, reason: "db_error" as const });
}

/** PRD §6.8 Session Complete ingredients, read from the Communication
 *  Profile AFTER this session's reps folded in (saveRep folds per rep). */
export type SkillLabSessionSummary = {
  /** Post-session Application Score (profile EMA) — the §6.8 headline. */
  applicationScore: number | null;
  applicationSampleCount: number;
  /** Weakest MEASURED hidden Application Skill in this application. */
  weakestApplicationSkill: { id: string; score: number } | null;
  /** Weakest measured Core Skill in the whole profile (for the "return
   *  to Daily Workout" recommendation branch). */
  weakestCoreSkill: { dimension: string; score: number } | null;
  /** All-time rep count (C17 — completion screens show lifetime reps). */
  lifetimeReps: number;
};

/** Close out a Skill Lab v2 session (sets endedAt + session composite)
 *  and return the §6.8 summary. */
export async function completeSkillLabSessionV2(input: {
  sessionId: string;
  applicationId: string;
  compositeScore: number | null;
}): Promise<{ ok: boolean; summary: SkillLabSessionSummary | null }> {
  const user = await currentUser();
  if (!user || !isApplicationId(input.applicationId)) {
    return { ok: false, summary: null };
  }
  const applicationId = input.applicationId;
  return safeDb<{ ok: boolean; summary: SkillLabSessionSummary | null }>(
    async () => {
      await db
        .update(practiceSessions)
        .set({
          endedAt: new Date(),
          ...(input.compositeScore != null
            ? { compositeScore: input.compositeScore }
            : {}),
        })
        .where(
          and(
            eq(practiceSessions.id, input.sessionId),
            eq(practiceSessions.userId, user.id),
          ),
        );

      const [profileRow] = await db
        .select({
          applications: communicationProfile.applications,
          coreSkills: communicationProfile.coreSkills,
          totalReps: communicationProfile.totalReps,
        })
        .from(communicationProfile)
        .where(eq(communicationProfile.userId, user.id))
        .limit(1);

      const app = profileRow?.applications?.[applicationId];
      let weakestApplicationSkill: { id: string; score: number } | null = null;
      for (const [id, est] of Object.entries(app?.skills ?? {})) {
        if (!est) continue;
        if (!weakestApplicationSkill || est.score < weakestApplicationSkill.score) {
          weakestApplicationSkill = { id, score: est.score };
        }
      }
      let weakestCoreSkill: { dimension: string; score: number } | null = null;
      for (const [dim, est] of Object.entries(profileRow?.coreSkills ?? {})) {
        const e = est as { score: number } | undefined;
        if (!e) continue;
        if (!weakestCoreSkill || e.score < weakestCoreSkill.score) {
          weakestCoreSkill = { dimension: dim, score: e.score };
        }
      }

      return {
        ok: true,
        summary: {
          applicationScore: app?.score ?? null,
          applicationSampleCount: app?.sampleCount ?? 0,
          weakestApplicationSkill,
          weakestCoreSkill,
          lifetimeReps: profileRow?.totalReps ?? 0,
        },
      };
    },
    { ok: false, summary: null },
  );
}
