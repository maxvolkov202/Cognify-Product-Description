import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  callouts as calloutsTable,
  progressSnapshots,
} from "@/lib/db/schema";
import { scoreRep } from "@/lib/ai/score";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import { encodeDimensionSignals } from "@/lib/scoring/signals";
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
  // CTO scan C2 — timing-safe secret comparison. Plain `===` leaks
  // byte-by-byte info via response time on careful probes; node:crypto's
  // timingSafeEqual returns in constant time relative to input length.
  // Length mismatch shortcircuits before the constant-time compare so
  // we don't compare different-length buffers (which throws).
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_SCORING_SECRET;
  if (!secret || !expected || secret.length !== expected.length) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const ok = timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const bodySchema = z.object({
    repId: z.string().uuid(),
    transcript: z.string().min(1).max(50000),
    promptText: z.string().min(1).max(2000),
    durationMs: z.number().positive(),
    timeBudgetMs: z.number().positive().optional(),
    frameworkId: z.string().optional(),
    frameworkNodes: z
      .array(z.object({ label: z.string(), description: z.string() }))
      .optional(),
    words: z
      .array(z.object({ word: z.string(), startMs: z.number(), endMs: z.number() }))
      .optional(),
    userCalibration: z.string().nullable().optional(),
  });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const frameworkWeights = getFrameworkWeights(body.frameworkId);

    // Look up the rep up-front so we can pass userId into scoreRep — the
    // Ch.11c FF gate buckets users by stable hash to ramp the
    // deterministic-signals path. Without a userId, the gate evaluates
    // to false and the legacy path runs (correct for any anonymous rep
    // that somehow reaches this endpoint, but production reps always
    // have a userId on the row).
    const rep = await db.query.reps.findFirst({ where: eq(reps.id, body.repId) });
    if (!rep) {
      return NextResponse.json({ error: "rep_not_found" }, { status: 404 });
    }

    const score = await scoreRep({
      transcript: body.transcript,
      promptText: body.promptText,
      durationMs: body.durationMs,
      timeBudgetMs: body.timeBudgetMs,
      frameworkNodes: body.frameworkNodes,
      words: body.words,
      userCalibration: body.userCalibration ?? null,
      ...(rep.userId ? { userId: rep.userId } : {}),
      ...(frameworkWeights ? { weights: frameworkWeights } : {}),
    });

    // CTO-scan H6 — wrap dim_scores + progress_snapshots + callouts
    // inserts in a single transaction. Without this, a failure between
    // inserts would leave the rep in an inconsistent state (scores
    // recorded, no progress snapshot, no callouts) with no rollback.
    // CTO-scan H8 — and skip the progressSnapshots write entirely when
    // we hit the mock-fallback path; mock scores polluting the user's
    // running averages defeats the calibration drift surface that's
    // supposed to catch this exact problem.
    const isMockFallback = score.modelVersion === "mock-fallback-v1";
    let calloutIds: string[] = [];
    await db.transaction(async (tx) => {
      if (score.dimensions.length > 0) {
        await tx.insert(dimensionScores).values(
          score.dimensions.map((d) => ({
            repId: body.repId,
            dimension: d.dimension,
            score: d.score,
            // Ch.11c — encode narratives + optional subSkillScores into a
            // single jsonb. Legacy string[] shape preserved when no
            // sub-skill data is present.
            signals: encodeDimensionSignals(
              d.signals,
              d.subSkillScores,
            ) as unknown as object,
          })),
        );
        if (!isMockFallback) {
          await tx.insert(progressSnapshots).values(
            score.dimensions.map((d) => ({
              userId: rep.userId,
              dimension: d.dimension,
              score: d.score,
              takenAt: new Date(),
            })),
          );
        }
      }

      if (score.callouts.length > 0) {
        const inserted = await tx
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
    });

    if (isMockFallback) {
      console.warn(
        `[api/score-internal] rep ${body.repId} scored via mock-fallback path; progressSnapshots write SKIPPED to keep running averages clean (CTO-scan H8).`,
      );
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
