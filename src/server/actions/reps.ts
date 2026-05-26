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
} from "@/lib/db/schema";
import { count, eq, asc, sql } from "drizzle-orm";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
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
  }, null);
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

  return safeDb(async () => {
    let sessionId = input.sessionId;
    if (!sessionId) {
      const [session] = await db
        .insert(practiceSessions)
        .values({
          userId,
          mode: input.mode,
          startedAt: new Date(),
          endedAt: new Date(),
          compositeScore: input.score.composite,
        })
        .returning({ id: practiceSessions.id });
      if (!session) return fallback;
      sessionId = session.id;
    }

    const [rep] = await db
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
        frameworkSnapshot: input.framework
          ? {
              name: input.framework.name,
              description: input.framework.description,
              nodes: input.framework.nodes,
            }
          : null,
      })
      .returning({ id: reps.id });
    if (!rep) return fallback;

    const repId = rep.id;

    if (input.score.dimensions.length > 0) {
      await db.insert(dimensionScores).values(
        input.score.dimensions.map((d) => ({
          repId,
          dimension: d.dimension,
          score: d.score,
          // Ch.11c — encode narratives + optional subSkillScores into a
          // single jsonb. Falls back to the legacy string[] shape when
          // subSkillScores is absent (FF-off path) so back-compat is
          // preserved on disk.
          signals: encodeDimensionSignals(
            d.signals,
            d.subSkillScores,
          ) as Record<string, unknown>,
        })),
      );
      // CTO-scan H8 — when scoring fell into the mock-fallback path
      // (api/score returned modelVersion="mock-fallback-v1" because
      // both Anthropic AND OpenAI failed), do NOT pollute the user's
      // running averages or personal-bests with the mock 70-across-the-
      // board scores. The dim_scores rows still get written for
      // historical-record completeness (they carry the mock-fallback
      // tag in the rep's modelVersion) but progress + PB skips so the
      // calibration drift surface stays clean.
      const isMockFallback = input.score.modelVersion === "mock-fallback-v1";
      if (!isMockFallback) {
        await db.insert(progressSnapshots).values(
          input.score.dimensions.map((d) => ({
            userId,
            dimension: d.dimension,
            score: d.score,
            takenAt: new Date(),
          })),
        );
        // Record any per-dimension personal bests this rep set. Durable
        // across sessions; in-session UI keeps using WorkoutSession's
        // local detection for instant-feedback toast, but the DB row is
        // the source of truth for /progress and /report.
        if (userId !== "anonymous") {
          await recordPersonalBests({
            userId,
            repId,
            dimensionScores: input.score.dimensions.map((d) => ({
              dimension: d.dimension,
              score: d.score,
            })),
          });
        }
      } else {
        console.warn(
          `[saveRep] rep ${repId} scored via mock-fallback path; progressSnapshots + personalBests SKIPPED (CTO-scan H8).`,
        );
      }
    }

    let calloutIds: string[] = [];
    if (input.score.callouts.length > 0) {
      const inserted = await db
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
      calloutIds = inserted.map((r) => r.id);
    }

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
        // The freeze persists in the users table; consumed automatically
        // by getStreakStatus when a single-day gap appears.
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
          restDayBonus = !isDateCommitted(u.committedDays, new Date());
        }
      } catch {
        // Best-effort; default to no bonus on read failure.
      }
      xp = await awardXp({
        userId,
        composite: input.score.composite,
        streakDays: streak,
        comebackBonus,
        restDayBonus,
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
      unlockedAchievements = await evaluateAchievements({
        userId,
        score: input.score,
        mode: input.mode,
        isFocusDrill: input.mode === "skill_lab",
        // Pressure detection requires the archetype id which doesn't
        // currently flow into SaveRepInput. Defer to a follow-up that
        // plumbs pressureArchetypeId; for now explore_pressure achievement
        // unlocks via the Skill Lab pressure-mode entry point only.
        isPressureRep: false,
        isBuildARep: input.mode === "scenario_training",
        lifetimeReps,
        streakDays: streak,
        dimensionsEverScored: dimsEverScored,
      });
    }

    // DNA Ch.9d — daily quest progress. Auth users only. The quest
    // selection is stable per (user, day); evaluation flips any quests
    // satisfied by THIS rep + grants their bonus XP. The bonus is added
    // directly to users.xp rather than going through awardXp's curve so
    // quest XP is additive (band/streak multipliers don't apply to it).
    let completedQuests: { ids: string[]; bonusXp: number } | undefined;
    if (userId !== "anonymous" && !isGuest) {
      const today = ymdUtc();
      const todays = await getOrCreateTodayQuests(userId, new Date());
      const repsToday = (
        await db
          .select({ c: count() })
          .from(reps)
          .where(eq(reps.userId, userId))
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
          isPressureRep: false,
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
    };
  }, fallback);
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
    };

    return {
      status: "completed" as const,
      score,
      calloutIds: cos.map((c) => c.id),
    };
  }, null);
}
