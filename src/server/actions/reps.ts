"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  callouts as calloutsTable,
  progressSnapshots,
  practiceSessions,
} from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { detectNewHigh, emitActivityEvent } from "@/lib/db/queries/activity";
import { getStreakDays } from "@/lib/db/queries/progress";
import type { Framework, ModeId, RepScore, SkillDimension } from "@/types/domain";

/** Guest users get 3 free reps to taste-before-signup. The 3rd save comes
 *  back with `gate: "signup_required"` — the UI shows the score, then
 *  replaces the "Next rep" CTA with a signup paywall. */
const GUEST_REP_LIMIT = 3;

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
      sessionId = session!.id;
    }

    const [rep] = await db
      .insert(reps)
      .values({
        sessionId,
        userId,
        promptText: input.promptText,
        durationMs: input.durationMs,
        audioUrl: input.audioPath,
        transcript: { text: input.transcript } as unknown as object,
        topic: input.topic ?? input.promptText,
        status: "pending",
        frameworkSnapshot: input.framework
          ? ({
              id: input.framework.id,
              name: input.framework.name,
              description: input.framework.description,
              nodes: input.framework.nodes,
              timeBudgetMs: input.timeBudgetMs,
              words: input.words,
            } as unknown as object)
          : input.words || input.timeBudgetMs
            ? ({
                timeBudgetMs: input.timeBudgetMs,
                words: input.words,
              } as unknown as object)
            : null,
      })
      .returning({ id: reps.id });

    return { repId: rep!.id, sessionId };
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
      sessionId = session!.id;
    }

    const [rep] = await db
      .insert(reps)
      .values({
        sessionId,
        userId,
        promptText: input.promptText,
        durationMs: input.durationMs,
        audioUrl: input.audioUrl,
        transcript: { text: input.transcript } as unknown as object,
        compositeScore: input.score.composite,
        modelVersion: input.score.modelVersion,
        rubricVersion: input.score.rubricVersion,
        topic: input.topic ?? input.promptText,
        frameworkSnapshot: input.framework
          ? ({
              name: input.framework.name,
              description: input.framework.description,
              nodes: input.framework.nodes,
            } as unknown as object)
          : null,
      })
      .returning({ id: reps.id });

    const repId = rep!.id;

    if (input.score.dimensions.length > 0) {
      await db.insert(dimensionScores).values(
        input.score.dimensions.map((d) => ({
          repId,
          dimension: d.dimension,
          score: d.score,
          signals: d.signals as unknown as object,
        })),
      );
      await db.insert(progressSnapshots).values(
        input.score.dimensions.map((d) => ({
          userId,
          dimension: d.dimension,
          score: d.score,
          takenAt: new Date(),
        })),
      );
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

    return {
      repId,
      sessionId,
      persisted: true,
      calloutIds,
      gate,
      guestRepCount,
    };
  }, fallback);
}
