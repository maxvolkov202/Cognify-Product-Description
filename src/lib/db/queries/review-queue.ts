/**
 * DNA Ch.C2 — Review queue queries.
 *
 * The queue surface lists reps that triggered the requiresHumanReview
 * flag (today: composite_score >= 95) AND have no existing entry in
 * score_corrections. Submitting a verdict removes the rep from the
 * queue without mutating the rep itself.
 */

import { sql, desc, eq, and, isNull, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reps,
  scoreCorrections,
  users,
  dimensionScores,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

const REVIEW_FLAG_THRESHOLD = 95;

export type ReviewQueueRep = {
  id: string;
  userId: string;
  userEmail: string | null;
  promptText: string;
  topic: string | null;
  durationMs: number;
  audioUrl: string | null;
  composite: number;
  dimensions: Record<string, number>;
  createdAt: Date;
  modelVersion: string | null;
  rubricVersion: string | null;
};

/** Fetch the next page of unreviewed flagged reps. */
export async function getReviewQueue(args: {
  limit?: number;
  offset?: number;
}): Promise<ReviewQueueRep[]> {
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;
  return safeDb<ReviewQueueRep[]>(async () => {
    const rows = await db
      .select({
        id: reps.id,
        userId: reps.userId,
        userEmail: users.email,
        promptText: reps.promptText,
        topic: reps.topic,
        durationMs: reps.durationMs,
        audioUrl: reps.audioUrl,
        composite: reps.compositeScore,
        createdAt: reps.createdAt,
        modelVersion: reps.modelVersion,
        rubricVersion: reps.rubricVersion,
      })
      .from(reps)
      .leftJoin(users, eq(users.id, reps.userId))
      .leftJoin(scoreCorrections, eq(scoreCorrections.repId, reps.id))
      .where(
        and(
          gte(reps.compositeScore, REVIEW_FLAG_THRESHOLD),
          eq(reps.status, "completed"),
          isNull(scoreCorrections.repId),
        ),
      )
      .orderBy(desc(reps.createdAt))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) return [];

    // Pull per-dim scores in a separate query to avoid N+1 join blow-up.
    const repIds = rows.map((r) => r.id);
    const dimRows = await db
      .select({
        repId: dimensionScores.repId,
        dimension: dimensionScores.dimension,
        score: dimensionScores.score,
      })
      .from(dimensionScores)
      .where(sql`${dimensionScores.repId} = ANY(${repIds})`);

    const dimsByRep = new Map<string, Record<string, number>>();
    for (const dr of dimRows) {
      const cur = dimsByRep.get(dr.repId) ?? {};
      cur[dr.dimension] = dr.score;
      dimsByRep.set(dr.repId, cur);
    }

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.userEmail,
      promptText: r.promptText,
      topic: r.topic,
      durationMs: r.durationMs,
      audioUrl: r.audioUrl,
      composite: r.composite ?? 0,
      dimensions: dimsByRep.get(r.id) ?? {},
      createdAt: r.createdAt,
      modelVersion: r.modelVersion,
      rubricVersion: r.rubricVersion,
    }));
  }, []);
}

/** Count of unreviewed flagged reps. Drives the badge on /ops. */
export async function getReviewQueueCount(): Promise<number> {
  return safeDb<number>(async () => {
    const result = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(reps)
      .leftJoin(scoreCorrections, eq(scoreCorrections.repId, reps.id))
      .where(
        and(
          gte(reps.compositeScore, REVIEW_FLAG_THRESHOLD),
          eq(reps.status, "completed"),
          isNull(scoreCorrections.repId),
        ),
      );
    return result[0]?.count ?? 0;
  }, 0);
}

export type SubmitReviewArgs = {
  repId: string;
  reviewerUserId: string;
  verdict:
    | "confirmed_accurate"
    | "should_be_lower"
    | "should_be_higher"
    | "skipped";
  correctedComposite?: number | null;
  correctedPerDim?: Record<string, number> | null;
  notes?: string | null;
};

/** Insert a review verdict. Returns the inserted row id. */
export async function submitReview(args: SubmitReviewArgs): Promise<string | null> {
  return safeDb<string | null>(async () => {
    const [row] = await db
      .insert(scoreCorrections)
      .values({
        repId: args.repId,
        reviewerUserId: args.reviewerUserId,
        verdict: args.verdict,
        correctedComposite: args.correctedComposite ?? null,
        correctedPerDim: args.correctedPerDim ?? null,
        notes: args.notes ?? null,
      })
      .returning({ id: scoreCorrections.id });
    return row?.id ?? null;
  }, null);
}
