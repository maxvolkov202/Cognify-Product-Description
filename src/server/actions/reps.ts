"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  callouts as calloutsTable,
  progressSnapshots,
  practiceSessions,
  users,
  coachingEvents,
  communicationProfile,
  exercises,
} from "@/lib/db/schema";
import {
  applyRepToProfile,
  emptyProfile,
  type CommunicationProfileState,
} from "@/lib/profile/communication-profile";
import { count, eq, and, asc, gte, isNull, sql } from "drizzle-orm";
import {
  deriveCoachFocus,
  deriveImplementationVerdict,
} from "@/lib/ai/coach-focus";
import { safeDb } from "@/lib/db/safe";
import {
  applyFeedbackDoc,
  buildFeedbackDoc,
} from "@/lib/scoring/feedback-doc";
import { currentUser } from "@/lib/session/current-user";
import { log } from "@/lib/log";
import { detectNewHigh, emitActivityEvent } from "@/lib/db/queries/activity";
import { getStreakDays } from "@/lib/db/queries/progress";
import { recordPersonalBests } from "@/lib/db/queries/personal-bests";
import { awardStreakFreeze } from "@/lib/db/queries/streak-freeze";
import { awardXp, type AwardXpResult } from "@/lib/progression/xp";
import {
  evaluateAchievements,
  getDimensionsEverScored,
  type AchievementId,
} from "@/lib/engagement/achievement-rules";
import {
  evaluateQuestProgress,
} from "@/lib/engagement/quests";
import {
  getOrCreateTodayQuests,
  markQuestsCompleted,
  ymdUtc,
} from "@/lib/db/queries/daily-quests";
import {
  incrementTeamChallenges,
  recordWeeklyChallengeEvent,
} from "@/lib/db/queries/weekly-challenges";
import { tickWeeklyXp } from "@/lib/db/queries/leagues";
import type { Framework, ModeId, RepScore, SkillDimension } from "@/types/domain";
import {
  encodeDimensionSignals,
  decodeDimensionSignals,
} from "@/lib/scoring/signals";

/** Guest users get 3 free reps to taste-before-signup. The 3rd save comes
 *  back with `gate: "signup_required"` — the UI shows the score, then
 *  replaces the "Next rep" CTA with a signup paywall. */
const GUEST_REP_LIMIT = 3;

/** Shape of communication_profile.applications (matches the schema $type,
 *  incl. nested Application Skill estimates — PRD §8.3.6/§8.4.5). */
type ApplicationsColumn = Record<
  string,
  {
    score: number;
    sampleCount: number;
    updatedAt: string;
    skills?: Record<string, { score: number; sampleCount: number }>;
  }
>;

/** Read users.lifetime_reps post-awardXp. Awarded inside awardXp; we
 *  need the post-increment value for achievement evaluation. Wrapped in
 *  safeDb so DB hiccups return null and achievements gracefully skip. */
async function readLifetimeReps(userId: string): Promise<number | null> {
  return safeDb<number | null>(async () => {
    const [row] = await db
      .select({ lifetimeReps: users.lifetimeReps })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.lifetimeReps ?? null;
  }, null);
}

export type SaveRepInput = {
  mode: ModeId;
  promptText: string;
  durationMs: number;
  transcript: string;
  audioUrl: string | null;
  score: RepScore;
  framework: Framework | null;
  topic: string | null;
  sessionId: string | null;
  /** Phase 8 — muscle-group exercise + day this rep belongs to. NULL
   *  for legacy Skill Lab / scenario reps; preserved end-to-end so
   *  scoring + telemetry can slice per-exercise. */
  exerciseId?: string | null;
  muscleGroupDayId?: string | null;
  /** Phase 8 — pressure graduation rep tag. */
  isGraduationRep?: boolean;
  /** Pressure archetype id when this rep ran under a pressure archetype
   *  (Skill Lab pressure slots, Build-a-Rep pressure mode). Only used to
   *  flag `isPressureRep` for achievements/quests — the scoring pipeline
   *  receives it separately via the /api/score body. */
  pressureArchetypeId?: string | null;
  /** PRD v3 Phase 4 — Skill Lab application this rep belongs to
   *  (exercises.application). Folds the composite into the profile's
   *  per-application estimate. Null for Daily Workout / legacy reps. */
  applicationId?: string | null;
  /** PRD v3 engine — where this rep sits in the exercise learning loop.
   *  Omitted/"first" for all legacy callers. */
  attemptKind?: "first" | "retry" | "again";
  /** PRD v3 engine — the First Rep this retry/again attempt improves on. */
  parentRepId?: string | null;
};

export type SaveRepResult = {
  repId: string;
  sessionId: string;
  persisted: boolean;
  /** Persisted callout ids, in the same order as `input.score.callouts`.
   *  Enables per-callout corrections in the feedback UI. Empty when the
   *  rep had no callouts or the DB was unavailable. */
  calloutIds: string[];
  /** When present, the user has hit a usage gate. The rep was still saved
   *  (so they see their score) but the next action should be a paywall,
   *  not another rep. */
  gate?: "signup_required";
  /** Number of reps this (guest) user has saved including this one.
   *  Undefined for authenticated users. */
  guestRepCount?: number;
  /** DNA Ch.7 — XP grant from this rep + level transition. Undefined for
   *  guests (no progression) and when DB is unavailable. UI fires the
   *  level-up celebration when `xp.leveledUp === true`. */
  xp?: AwardXpResult;
  /** DNA Ch.9c — achievements newly unlocked by this rep. Empty when none.
   *  Client iterates and fires earn-time toasts. */
  unlockedAchievements?: AchievementId[];
  /** PRD v3 Phase 6 (§10.10) — weekly challenges completed by this rep. */
  completedWeeklyChallenges?: { ids: string[]; bonusXp: number };
  /** DNA Ch.9d — daily quest ids completed by this rep + bonus XP. UI
   *  surfaces as a small "+X XP — quest complete" toast. */
  completedQuests?: { ids: string[]; bonusXp: number };
};

export type InsertPendingRepInput = {
  mode: ModeId;
  promptText: string;
  durationMs: number;
  transcript: string;
  audioPath: string | null;
  framework: Framework | null;
  topic: string | null;
  sessionId: string | null;
  timeBudgetMs?: number;
  words?: { word: string; startMs: number; endMs: number }[];
  /** Phase 8 — muscle-group context. Persisted to reps.exercise_id /
   *  reps.muscle_group_day_id so /api/score-internal can read them when
   *  hydrating the scoring input. */
  exerciseId?: string | null;
  muscleGroupDayId?: string | null;
  isGraduationRep?: boolean;
  /** WS-3 pressure tagging — persists to reps.pressure_archetype_id. */
  pressureArchetypeId?: string | null;
};

export type InsertPendingRepResult = {
  repId: string;
  sessionId: string;
};

/**
 * Async path — insert a rep with status='pending' and return its id.
 * The client then invokes the `process-rep` Edge Function which claims
 * the rep (optimistic lock → status='processing'), runs scoring, writes
 * results, and flips status to 'completed' (or 'failed').
 *
 * Separate from saveRep (sync path) to keep the async flow additive
 * during the transition. Guests keep using saveRep.
 */
export async function insertPendingRep(
  input: InsertPendingRepInput,
): Promise<InsertPendingRepResult | null> {
  const user = await currentUser();
  if (!user) return null;
  if (user.kind === "guest") return null; // Guests use sync saveRep
  const userId = user.id;

  return safeDb(async () => {
    let sessionId = input.sessionId;
    if (!sessionId) {
      const [session] = await db
        .insert(practiceSessions)
        .values({
          userId,
          mode: input.mode,
          startedAt: new Date(),
        })
        .returning({ id: practiceSessions.id });
      if (!session) return null;
      sessionId = session.id;
    }

    const [rep] = await db
      .insert(reps)
      .values({
        sessionId,
        userId,
        promptText: input.promptText,
        durationMs: input.durationMs,
        audioUrl: input.audioPath,
        transcript: { text: input.transcript },
        topic: input.topic ?? input.promptText,
        status: "pending",
        // Phase 8 — muscle-group context, threaded end-to-end. Nullable
        // FKs from migration 0020; legacy callers pass undefined and
        // these columns remain NULL.
        ...(input.exerciseId ? { exerciseId: input.exerciseId } : {}),
        ...(input.muscleGroupDayId
          ? { muscleGroupDayId: input.muscleGroupDayId }
          : {}),
        ...(input.isGraduationRep
          ? { isGraduationRep: true }
          : {}),
        ...(input.pressureArchetypeId
          ? { pressureArchetypeId: input.pressureArchetypeId as never }
          : {}),
        frameworkSnapshot: input.framework
          ? {
              id: input.framework.id,
              name: input.framework.name,
              description: input.framework.description,
              nodes: input.framework.nodes,
              timeBudgetMs: input.timeBudgetMs,
              words: input.words,
            }
          : input.words || input.timeBudgetMs
            ? {
                timeBudgetMs: input.timeBudgetMs,
                words: input.words,
              }
            : null,
      })
      .returning({ id: reps.id });
    if (!rep) return null;

    return { repId: rep.id, sessionId };
  }, null, { write: "rep_pending" });
}

export async function saveRep(input: SaveRepInput): Promise<SaveRepResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const isGuest = user?.kind === "guest";
  const fallback: SaveRepResult = {
    repId: randomUUID(),
    sessionId: input.sessionId ?? randomUUID(),
    persisted: false,
    calloutIds: [],
  };

  // PRD v3 engine — derive the Coach's Focus this rep carries forward.
  // Skipped on mock-fallback scores (their focus bullets are canned) so
  // the coaching-history ledger stays trustworthy.
  const isMockFallback = input.score.modelVersion === "mock-fallback-v1";
  const coachFocus = isMockFallback ? null : deriveCoachFocus(input.score);
  // Grading v3 — persist the doc-shaped feedback so async reads and the
  // progress rep page reconstruct the full RepScore (null for mock/
  // feedback-less scores → column stays absent).
  const feedbackDoc = buildFeedbackDoc(input.score);

  return safeDb(async () => {
    // Phase 15 P-2 — the CORE persistence is atomic. Pre-tx, a late
    // failure (e.g. dimension_scores) left the rep row committed while
    // the caller received persisted:false + a random repId — the retry
    // then chained onto a phantom parent (the F-4 replay, one write
    // deeper). Best-effort layers (ledger, personal bests, profile fold,
    // XP, quests) stay OUTSIDE the tx: they must never roll back a rep.
    const core = await db.transaction(async (tx) => {
    let sessionId = input.sessionId;
    if (!sessionId) {
      const [session] = await tx
        .insert(practiceSessions)
        .values({
          userId,
          mode: input.mode,
          startedAt: new Date(),
          endedAt: new Date(),
          compositeScore: input.score.composite,
        })
        .returning({ id: practiceSessions.id });
      if (!session) throw new Error("practice session insert returned no row");
      sessionId = session.id;
    }

    const [rep] = await tx
      .insert(reps)
      .values({
        sessionId,
        userId,
        promptText: input.promptText,
        durationMs: input.durationMs,
        audioUrl: input.audioUrl,
        transcript: { text: input.transcript },
        compositeScore: input.score.composite,
        modelVersion: input.score.modelVersion,
        rubricVersion: input.score.rubricVersion,
        topic: input.topic ?? input.promptText,
        // Phase 8 — muscle-group context, threaded end-to-end.
        ...(input.exerciseId ? { exerciseId: input.exerciseId } : {}),
        ...(input.muscleGroupDayId
          ? { muscleGroupDayId: input.muscleGroupDayId }
          : {}),
        ...(input.isGraduationRep
          ? { isGraduationRep: true }
          : {}),
        ...(input.pressureArchetypeId
          ? { pressureArchetypeId: input.pressureArchetypeId as never }
          : {}),
        // PRD v3 engine — attempt lineage (migration 0028). Legacy
        // callers omit these; column defaults keep them 'first'/NULL.
        ...(input.attemptKind && input.attemptKind !== "first"
          ? { attemptKind: input.attemptKind }
          : {}),
        ...(input.parentRepId ? { parentRepId: input.parentRepId } : {}),
        ...(coachFocus ? { coachFocus } : {}),
        ...(feedbackDoc ? { feedback: feedbackDoc } : {}),
        frameworkSnapshot: input.framework
          ? {
              name: input.framework.name,
              description: input.framework.description,
              nodes: input.framework.nodes,
            }
          : null,
      })
      .returning({ id: reps.id });
    if (!rep) throw new Error("rep insert returned no row");
    const repId = rep.id;

    if (input.score.dimensions.length > 0) {
      await tx.insert(dimensionScores).values(
        input.score.dimensions.map((d) => ({
          repId,
          dimension: d.dimension,
          score: d.score,
          signals: encodeDimensionSignals(
            d.signals,
            d.subSkillScores,
          ) as Record<string, unknown>,
        })),
      );
      if (!isMockFallback) {
        await tx.insert(progressSnapshots).values(
          input.score.dimensions.map((d) => ({
            userId,
            dimension: d.dimension,
            score: d.score,
            takenAt: new Date(),
          })),
        );
      }
    }

    let txCalloutIds: string[] = [];
    if (input.score.callouts.length > 0) {
      const inserted = await tx
        .insert(calloutsTable)
        .values(
          input.score.callouts.map((c) => ({
            repId,
            dimension: c.dimension,
            tone: c.tone,
            title: c.title,
            body: c.body,
            quote: c.quote ?? null,
            suggestedRewrite: c.suggestedRewrite ?? null,
            transcriptStartMs: c.transcriptStart,
            transcriptEndMs: c.transcriptEnd,
          })),
        )
        .returning({ id: calloutsTable.id });
      txCalloutIds = inserted.map((r) => r.id);
    }

    return { repId, sessionId, calloutIds: txCalloutIds };
    });

    const repId = core.repId;
    const sessionId = core.sessionId;

    // PRD v3 engine — coaching-history ledger (seed of PRD §8.3.9).
    // One row per delivered Coach's Focus; retry attempts back-fill the
    // parent rep's implemented_verdict. Best-effort: a ledger failure
    // must never lose the rep, so errors are logged and swallowed.
    if (userId !== "anonymous" && !isGuest) {
      try {
        if (coachFocus) {
          await db.insert(coachingEvents).values({
            userId,
            repId,
            dimension: coachFocus.dimension,
            subSkill: coachFocus.subSkill,
            focusText: coachFocus.text,
            // Phase 15 I-8 — technique tag carried by deriveCoachFocus
            // (from the retry's implementationReview; null on first
            // reps — their technique is classified by the retry's
            // verdict backfill below).
            technique: coachFocus.technique ?? null,
          });
        }
        if (
          (input.attemptKind === "retry" || input.attemptKind === "again") &&
          input.parentRepId &&
          !isMockFallback
        ) {
          let verdict = input.score.implementationReview?.verdict ?? null;
          if (!verdict) {
            // Deterministic fallback: score movement on the parent rep's
            // focus dimension (generous thresholds per Owen C10).
            const [parent] = await db
              .select({ coachFocus: reps.coachFocus })
              .from(reps)
              .where(eq(reps.id, input.parentRepId))
              .limit(1);
            const focusDimension = parent?.coachFocus?.dimension as
              | SkillDimension
              | undefined;
            if (focusDimension) {
              const parentDims = await db
                .select({
                  dimension: dimensionScores.dimension,
                  score: dimensionScores.score,
                })
                .from(dimensionScores)
                .where(eq(dimensionScores.repId, input.parentRepId));
              verdict = deriveImplementationVerdict({
                focusDimension,
                firstDimensions: parentDims.map((d) => ({
                  dimension: d.dimension as SkillDimension,
                  score: d.score,
                })),
                retryDimensions: input.score.dimensions.map((d) => ({
                  dimension: d.dimension as SkillDimension,
                  score: d.score,
                })),
              });
            }
          }
          if (verdict) {
            // Phase 15 I-8 — the retry classified which technique the
            // COACHED focus used (implementationReview.technique), so
            // stamp it on the parent row together with the verdict.
            // This is what makes per-(dimension, technique)
            // effectiveness computable: verdicts only ever land on
            // first-rep rows (parentRepId always points at the First
            // Rep), and first-rep focuses are untagged at insert time.
            // The isNull(implementedVerdict) guard means we never
            // overwrite an earlier classification.
            const technique =
              input.score.implementationReview?.technique ?? null;
            await db
              .update(coachingEvents)
              .set({
                implementedVerdict: verdict,
                ...(technique ? { technique } : {}),
              })
              .where(
                and(
                  eq(coachingEvents.repId, input.parentRepId),
                  isNull(coachingEvents.implementedVerdict),
                ),
              );
          }
        }
      } catch (err) {
        log.warn({
          event: "save_rep.coaching_events_failed",
          repId,
          msg: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    if (input.score.dimensions.length > 0) {
      // dims + progress snapshots persisted atomically in the core tx
      // above (P-2). Mock-fallback scores skip snapshots there (CTO-scan
      // H8: mock 70s must not pollute averages); dims still land for the
      // historical record.
      if (!isMockFallback) {
        // Personal bests are best-effort — a PB hiccup must never turn a
        // COMMITTED rep into persisted:false (the reverse lie).
        if (userId !== "anonymous") {
          try {
            await recordPersonalBests({
              userId,
              repId,
              dimensionScores: input.score.dimensions.map((d) => ({
                dimension: d.dimension,
                score: d.score,
              })),
            });
          } catch (err) {
            log.warn({
              event: "save_rep.personal_bests_failed",
              repId,
              msg: err instanceof Error ? err.message : "unknown",
            });
          }
        }
      } else {
        log.warn({
          event: "save_rep.mock_fallback",
          repId,
          msg: "progressSnapshots + personalBests skipped",
        });
      }

      // PRD v3 Phase 3 — fold this rep's evidence into the Communication
      // Profile (slow EMA; see src/lib/profile/communication-profile.ts).
      // Best-effort: a profile write failure never loses the rep.
      if (!isMockFallback && userId !== "anonymous" && !isGuest) {
        try {
          const [row] = await db
            .select({
              coreSkills: communicationProfile.coreSkills,
              hiddenSkills: communicationProfile.hiddenSkills,
              applications: communicationProfile.applications,
              overallScore: communicationProfile.overallScore,
              totalReps: communicationProfile.totalReps,
            })
            .from(communicationProfile)
            .where(eq(communicationProfile.userId, userId))
            .limit(1);
          const current: CommunicationProfileState = row
            ? {
                coreSkills: row.coreSkills as CommunicationProfileState["coreSkills"],
                hiddenSkills: row.hiddenSkills as CommunicationProfileState["hiddenSkills"],
                applications:
                  (row.applications as CommunicationProfileState["applications"]) ?? {},
                overallScore: row.overallScore,
                totalReps: row.totalReps,
              }
            : emptyProfile();
          const subSkillScores: Record<string, number> = {};
          for (const d of input.score.dimensions) {
            if (!d.subSkillScores) continue;
            for (const [id, v] of Object.entries(d.subSkillScores)) {
              if (typeof v === "number") subSkillScores[id] = v;
            }
          }
          // PRD v3 Phase 4 — application fold data comes from the exercise
          // row, not the client: the client's applicationId is only the
          // signal to look. Keeps skill tags authoritative.
          let applicationId: string | null = null;
          let applicationSkills: string[] | null = null;
          if (input.applicationId && input.exerciseId) {
            const [ex] = await db
              .select({
                application: exercises.application,
                applicationSkills: exercises.applicationSkills,
              })
              .from(exercises)
              .where(eq(exercises.id, input.exerciseId))
              .limit(1);
            applicationId = ex?.application ?? null;
            applicationSkills = ex?.applicationSkills ?? null;
          }
          const next = applyRepToProfile(current, {
            dimensions: input.score.dimensions.map((d) => ({
              dimension: d.dimension,
              score: d.score,
            })),
            subSkillScores,
            applicationId,
            applicationSkills,
            composite: input.score.composite,
            // Phase 15 I-9 — coached attempts (retry/again) fold at half
            // the learning rate; see COACHED_ATTEMPT_WEIGHT.
            attemptKind: input.attemptKind ?? "first",
            at: new Date().toISOString(),
          });
          await db
            .insert(communicationProfile)
            .values({
              userId,
              overallScore: next.overallScore,
              coreSkills: next.coreSkills as Record<
                string,
                { score: number; sampleCount: number; updatedAt: string }
              >,
              hiddenSkills: next.hiddenSkills as Record<
                string,
                { score: number; sampleCount: number }
              >,
              applications: next.applications as ApplicationsColumn,
              totalReps: next.totalReps,
            })
            .onConflictDoUpdate({
              target: communicationProfile.userId,
              set: {
                overallScore: next.overallScore,
                coreSkills: next.coreSkills as Record<
                  string,
                  { score: number; sampleCount: number; updatedAt: string }
                >,
                hiddenSkills: next.hiddenSkills as Record<
                  string,
                  { score: number; sampleCount: number }
                >,
                applications: next.applications as ApplicationsColumn,
                totalReps: next.totalReps,
                updatedAt: new Date(),
              },
            });
        } catch (err) {
          log.warn({
            event: "save_rep.profile_update_failed",
            repId,
            msg: err instanceof Error ? err.message : "unknown",
          });
        }
      }
    }

    // Callouts persisted in the core tx (P-2).
    const calloutIds: string[] = core.calloutIds;

    // Fire-and-forget activity events. Emits live only when DB + user are
    // available; safeDb swallows failures so the rep save itself is never
    // blocked by feed bookkeeping.
    if (userId !== "anonymous") {
      const topDim: SkillDimension | null =
        input.score.dimensions.length > 0
          ? [...input.score.dimensions].sort((a, b) => b.score - a.score)[0]!.dimension
          : null;
      await emitActivityEvent(userId, {
        type: "workout_complete",
        composite: input.score.composite,
        repsCount: 1,
        topDimension: topDim,
      });
      const newHigh = await detectNewHigh(userId, input.score.composite);
      if (newHigh && topDim) {
        await emitActivityEvent(userId, {
          type: "new_high",
          dimension: topDim,
          score: newHigh.score,
        });
      }
      const streak = await getStreakDays(userId);
      if (streak > 0 && streak % 7 === 0) {
        await emitActivityEvent(userId, {
          type: "streak_milestone",
          days: streak,
        });
        // Every 7-day streak earns +1 freeze (capped at 3 in-function).
        // The freeze persists in the users table; applied automatically
        // by getStreakStatus when missed committed days appear (up to
        // the banked count — §10.7.1; consecutive misses still break).
        await awardStreakFreeze(userId);
      }
    }

    // Guest rep limit — after saving, count the guest's total reps. If
    // they've hit the cap, flag the gate so the UI shows a signup prompt.
    let gate: "signup_required" | undefined;
    let guestRepCount: number | undefined;
    if (isGuest && userId !== "anonymous") {
      const [row] = await db
        .select({ c: count() })
        .from(reps)
        .where(eq(reps.userId, userId));
      const total = Number(row?.c ?? 0);
      guestRepCount = total;
      if (total >= GUEST_REP_LIMIT) gate = "signup_required";
    }

    // DNA Ch.7 — XP grant. Authenticated users only; guests don't have
    // a progression slot. Streak already computed above; reuse to keep
    // this single round-trip.
    let xp: AwardXpResult | undefined;
    let unlockedAchievements: AchievementId[] | undefined;
    // Shared with the weekly-challenge block below (G6 — "Maintain your
    // committed training schedule"): did THIS rep land on a committed day?
    let trainedOnCommittedDay = false;
    if (userId !== "anonymous" && !isGuest) {
      const streak = await getStreakDays(userId);
      // DNA Ch.9a comeback bonus — fires once when a user returns after a
      // missed-day-streak break. Heuristic: streak just reset to 1 AND
      // lifetime_reps already > 0 (i.e. they've had a streak before).
      // Trades off some false-positives (a brand-new user's first 2nd-day
      // rep also matches if their counts shift weirdly) for a simple
      // signal that fires reliably for actual comebacks.
      const priorLifetime = (await readLifetimeReps(userId)) ?? 0;
      const comebackBonus = streak === 1 && priorLifetime > 0;
      // Phase D — rest-day bonus. If the user trains today despite today
      // not being in their committed_days schedule, give them ×1.5 XP as
      // a "voluntary rep" reward. Cheap read — single column.
      let restDayBonus = false;
      try {
        const [u] = await db
          .select({ committedDays: users.committedDays })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (u) {
          const { isDateCommitted } = await import(
            "@/lib/onboarding/committed-days"
          );
          trainedOnCommittedDay = isDateCommitted(u.committedDays, new Date());
          restDayBonus = !trainedOnCommittedDay;
        }
      } catch {
        // Best-effort; default to no bonus on read failure.
      }
      // PRD v3 Phase 6 (§10.5.3) — retries that implement coaching (and
      // improve the score) progress rank faster than participation alone.
      let implementationVerdict: "nailed" | "partial" | "missed" | null = null;
      let scoreImprovement: number | null = null;
      if (
        (input.attemptKind === "retry" || input.attemptKind === "again") &&
        input.parentRepId
      ) {
        implementationVerdict =
          input.score.implementationReview?.verdict ?? null;
        try {
          const [parentRep] = await db
            .select({ composite: reps.compositeScore })
            .from(reps)
            .where(eq(reps.id, input.parentRepId))
            .limit(1);
          if (parentRep?.composite != null) {
            scoreImprovement = input.score.composite - parentRep.composite;
          }
        } catch {
          // Best-effort — bonus simply doesn't apply.
        }
      }
      xp = await awardXp({
        userId,
        composite: input.score.composite,
        streakDays: streak,
        comebackBonus,
        restDayBonus,
        implementationVerdict,
        scoreImprovement,
        // Phase 15 R-2 (§10.5.3) — Daily Workout is the primary
        // progression driver; other modes carry configurable weights.
        mode: input.mode,
      });
      // DNA Ch.9b — leagues weekly_xp accrual. Behind FF_LEAGUES so the
      // shadow-mode rollout per the master plan can run cohort math
      // before any UI surface goes live.
      if (process.env.FF_LEAGUES === "true" && xp.xpDelta > 0) {
        await tickWeeklyXp(userId, xp.xpDelta);
      }

      // DNA Ch.9c — evaluate achievements after XP grant so the
      // users.lifetime_reps column reflects this rep. getDimensions-
      // EverScored picks up the just-inserted dimensionScores rows.
      // Re-read lifetime_reps post-awardXp for the lifetimeReps tier
      // achievements (priorLifetime is pre-grant).
      const lifetimeReps = (await readLifetimeReps(userId)) ?? priorLifetime + 1;
      const dimsEverScored = await getDimensionsEverScored(userId);
      // PRD §10.12 — implementation milestones read the coaching_events
      // ledger (rows back-filled with implemented_verdict='nailed' by the
      // retry evaluation above, so THIS retry's verdict is included).
      // safeDb-wrapped like readLifetimeReps: a hiccup returns 0 and the
      // implement_* achievements simply don't fire this rep.
      const implementedNailedCount = await safeDb<number>(async () => {
        const [row] = await db
          .select({ c: count() })
          .from(coachingEvents)
          .where(
            and(
              eq(coachingEvents.userId, userId),
              eq(coachingEvents.implementedVerdict, "nailed"),
            ),
          );
        return Number(row?.c ?? 0);
      }, 0);
      unlockedAchievements = await evaluateAchievements({
        userId,
        score: input.score,
        mode: input.mode,
        isFocusDrill: input.mode === "skill_lab",
        // Pressure reps carry their archetype id end-to-end (Skill Lab
        // pressure slots + Build-a-Rep pressure mode → RepSurface →
        // SaveRepInput.pressureArchetypeId).
        isPressureRep: !!input.pressureArchetypeId,
        isBuildARep:
          input.mode === "scenario_training" || input.mode === "build_a_rep",
        lifetimeReps,
        streakDays: streak,
        dimensionsEverScored: dimsEverScored,
        implementedNailedCount,
      });
    }

    // DNA Ch.9d — daily quest progress. Auth users only. The quest
    // selection is stable per (user, day); evaluation flips any quests
    // satisfied by THIS rep + grants their bonus XP. The bonus is added
    // directly to users.xp rather than going through awardXp's curve so
    // quest XP is additive (band/streak multipliers don't apply to it).
    let completedQuests: { ids: string[]; bonusXp: number } | undefined;
    let completedWeeklyChallenges:
      | { ids: string[]; bonusXp: number }
      | undefined;
    if (userId !== "anonymous" && !isGuest) {
      const today = ymdUtc();
      const todays = await getOrCreateTodayQuests(userId, new Date());
      // Phase 6 bug fix: this previously counted LIFETIME reps (no date
      // filter), so "N reps today" quests completed instantly. Count
      // only today's (UTC) reps — includes the row just inserted.
      const todayStartUtc = new Date(`${today}T00:00:00.000Z`);
      const repsToday = (
        await db
          .select({ c: count() })
          .from(reps)
          .where(
            and(eq(reps.userId, userId), gte(reps.createdAt, todayStartUtc)),
          )
      )[0]?.c ?? 0;
      const evalResult = evaluateQuestProgress({
        todaysQuests: todays.quests,
        alreadyCompletedIds: todays.completedIds,
        rep: {
          composite: input.score.composite,
          dimensions: input.score.dimensions.map((d) => ({
            dimension: d.dimension as SkillDimension,
            score: d.score,
          })),
          isFocusDrill: input.mode === "skill_lab",
          isPressureRep: !!input.pressureArchetypeId,
          repsToday: Number(repsToday),
        },
      });
      if (evalResult.newlyCompletedIds.length > 0) {
        await markQuestsCompleted(
          userId,
          today,
          evalResult.newlyCompletedIds,
          evalResult.bonusXp,
        );
        // Tack the bonus XP onto the user record directly (no level-up
        // re-eval — bonus is small and capped per day at ~100 XP across
        // 3 quests, well under a single level threshold).
        await safeDb<void>(async () => {
          await db
            .update(users)
            .set({ xp: sql`${users.xp} + ${evalResult.bonusXp}` })
            .where(eq(users.id, userId));
        }, undefined);
        completedQuests = {
          ids: evalResult.newlyCompletedIds,
          bonusXp: evalResult.bonusXp,
        };
      }

      // PRD v3 Phase 6 — Weekly Challenges (§10.10) + Team Challenges
      // (§10.11). Counter-based, week-keyed; bonus XP additive like
      // quests. Best-effort: failures never lose the rep.
      try {
        const challengeResult = await recordWeeklyChallengeEvent(userId, {
          mode: input.mode,
          composite: input.score.composite,
          implementedRetry:
            (input.attemptKind === "retry" || input.attemptKind === "again") &&
            input.score.implementationReview?.verdict === "nailed",
          newTrainingDay: Number(repsToday) === 1,
          // G6 — computed alongside restDayBonus above (same committed-
          // days read); false for guests/anonymous (block never runs).
          trainedOnCommittedDay,
        });
        if (challengeResult && challengeResult.newlyCompletedIds.length > 0) {
          completedWeeklyChallenges = {
            ids: challengeResult.newlyCompletedIds,
            bonusXp: challengeResult.bonusXp,
          };
        }
        await incrementTeamChallenges(userId);
      } catch (err) {
        log.warn({
          event: "save_rep.weekly_challenges_failed",
          repId,
          msg: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return {
      repId,
      sessionId,
      persisted: true,
      calloutIds,
      gate,
      guestRepCount,
      xp,
      unlockedAchievements,
      completedQuests,
      completedWeeklyChallenges,
    };
  }, fallback, { write: "rep_persist" });
}

export type GetRepResultOutput = {
  status: "pending" | "processing" | "completed" | "failed";
  score: RepScore | null;
  calloutIds: string[];
};

/**
 * Fetch a finalized rep's score + callouts. Used by the async flow once
 * useRepStatus reports status='completed' — pulls everything needed to
 * render FeedbackPanel from the DB (vs. from the /api/score response in
 * the sync flow).
 *
 * Returns status + null score when the rep hasn't completed yet. Caller
 * uses status to decide what to render (spinner vs. results vs. error).
 */
export async function getRepResult(
  repId: string,
): Promise<GetRepResultOutput | null> {
  const user = await currentUser();
  if (!user) return null;

  return safeDb(async () => {
    const rep = await db.query.reps.findFirst({ where: eq(reps.id, repId) });
    if (!rep) return null;
    // Scope to the current user to prevent cross-user reads.
    if (rep.userId !== user.id) return null;

    const statusValue = (rep.status ?? "completed") as GetRepResultOutput["status"];
    if (statusValue !== "completed") {
      return { status: statusValue, score: null, calloutIds: [] };
    }

    const dims = await db
      .select()
      .from(dimensionScores)
      .where(eq(dimensionScores.repId, repId));
    const cos = await db
      .select()
      .from(calloutsTable)
      .where(eq(calloutsTable.repId, repId))
      .orderBy(asc(calloutsTable.transcriptStartMs));

    const score: RepScore = {
      composite: rep.compositeScore ?? 0,
      dimensions: dims.map((d) => {
        const decoded = decodeDimensionSignals(d.signals);
        return {
          dimension: d.dimension as SkillDimension,
          score: d.score,
          signals: decoded.narratives,
          ...(decoded.subSkillScores
            ? { subSkillScores: decoded.subSkillScores }
            : {}),
        };
      }),
      callouts: cos.map((c) => ({
        dimension: c.dimension as SkillDimension,
        tone: c.tone as "positive" | "neutral" | "warn" | "critical",
        title: c.title,
        body: c.body,
        quote: c.quote,
        suggestedRewrite: c.suggestedRewrite,
        transcriptStart: c.transcriptStartMs,
        transcriptEnd: c.transcriptEndMs,
      })),
      modelVersion: rep.modelVersion ?? "",
      rubricVersion: rep.rubricVersion ?? "",
      // Grading v3 — the persisted Coach's Focus survives read-back so
      // async reps drive the retry flow exactly like sync ones.
      ...(rep.coachFocus
        ? {
            coachFocus: {
              dimension: rep.coachFocus.dimension as SkillDimension,
              subSkill: rep.coachFocus.subSkill ?? null,
              behavior: rep.coachFocus.behavior ?? rep.coachFocus.text,
              why: rep.coachFocus.why ?? "",
              action: rep.coachFocus.action ?? rep.coachFocus.text,
              text: rep.coachFocus.text,
            },
          }
        : {}),
    };

    return {
      status: "completed" as const,
      // Grading v3 — merge the persisted feedback doc (headline,
      // Stronger Version, per-skill feedback…). No-op on legacy rows.
      score: applyFeedbackDoc(score, rep.feedback),
      calloutIds: cos.map((c) => c.id),
    };
  }, null);
}
