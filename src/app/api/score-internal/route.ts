import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  callouts as calloutsTable,
  progressSnapshots,
} from "@/lib/db/schema";
import { scoreRep } from "@/lib/ai/score";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import type { SkillDimension } from "@/types/domain";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Internal scoring endpoint called ONLY by the Supabase `process-rep`
 * Edge Function. Protected by a shared secret (INTERNAL_SCORING_SECRET)
 * so the public internet can't invoke it directly.
 *
 * Flow:
 *   1. Edge Function claims the rep (optimistic lock → status='processing')
 *   2. Edge Function transcribes audio via Deepgram
 *   3. Edge Function calls THIS endpoint with { repId, transcript, words }
 *   4. This endpoint runs Claude scoring, writes dimension_scores, callouts,
 *      progress_snapshots. Returns completed RepScore.
 *   5. Edge Function sets reps.status='completed' (or 'failed' on error) and
 *      writes compositeScore + modelVersion + rubricVersion.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SCORING_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  type Body = {
    repId: string;
    transcript: string;
    promptText: string;
    durationMs: number;
    timeBudgetMs?: number;
    frameworkId?: string;
    frameworkNodes?: { label: string; description: string }[];
    words?: { word: string; startMs: number; endMs: number }[];
    userCalibration?: string | null;
  };
  const body = (await req.json()) as Body;

  try {
    const frameworkWeights = getFrameworkWeights(body.frameworkId);
    const score = await scoreRep({
      transcript: body.transcript,
      promptText: body.promptText,
      durationMs: body.durationMs,
      timeBudgetMs: body.timeBudgetMs,
      frameworkNodes: body.frameworkNodes,
      words: body.words,
      userCalibration: body.userCalibration ?? null,
      ...(frameworkWeights ? { weights: frameworkWeights } : {}),
    });

    // Persist dimension_scores + callouts + progress_snapshots. We fetch
    // userId from the rep row since the Edge Function isn't sending it.
    const rep = await db.query.reps.findFirst({ where: eq(reps.id, body.repId) });
    if (!rep) {
      return NextResponse.json({ error: "rep_not_found" }, { status: 404 });
    }

    if (score.dimensions.length > 0) {
      await db.insert(dimensionScores).values(
        score.dimensions.map((d) => ({
          repId: body.repId,
          dimension: d.dimension,
          score: d.score,
          signals: d.signals as unknown as object,
        })),
      );
      await db.insert(progressSnapshots).values(
        score.dimensions.map((d) => ({
          userId: rep.userId,
          dimension: d.dimension,
          score: d.score,
          takenAt: new Date(),
        })),
      );
    }

    let calloutIds: string[] = [];
    if (score.callouts.length > 0) {
      const inserted = await db
        .insert(calloutsTable)
        .values(
          score.callouts.map((c) => ({
            repId: body.repId,
            dimension: c.dimension as SkillDimension,
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

    return NextResponse.json({
      score,
      calloutIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "scoring_failed";
    console.error("[api/score-internal] failed:", message);
    return NextResponse.json({ error: "scoring_failed", message }, { status: 500 });
  }
}
