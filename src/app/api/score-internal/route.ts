import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  reps,
  dimensionScores,
  callouts as calloutsTable,
  coachingEvents,
  progressSnapshots,
} from "@/lib/db/schema";
import { scoreRepWithMetrics } from "@/lib/ai/score";
import { deriveCoachFocus } from "@/lib/ai/coach-focus";
import { buildFeedbackDoc } from "@/lib/scoring/feedback-doc";
import { getFrameworkWeights } from "@/lib/scoring/framework-profiles";
import { encodeDimensionSignals } from "@/lib/scoring/signals";
import {
  writeScoringTelemetry,
  categorizeFailure,
  resolveFallbackReason,
} from "@/lib/scoring/telemetry";
import type { SkillDimension } from "@/types/domain";
import { log, serializeErr } from "@/lib/log";

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
  // Phase 0 — total wall-clock for the route handler. scoring_telemetry
  // writes the merged duration so /api/score/health/stats can show
  // p50/p95/p99 across both endpoints.
  const requestStart = Date.now();

  // CTO scan C2 — timing-safe secret comparison. Plain `===` leaks
  // byte-by-byte info via response time on careful probes; node:crypto's
  // timingSafeEqual returns in constant time relative to input length.
  // Length mismatch shortcircuits before the constant-time compare so
  // we don't compare different-length buffers (which throws).
  //
  // Trailing-whitespace tolerance: both the Vercel env var and the
  // Supabase Edge Function env var were stored with a stray `\n` at
  // some point. Trimming on both inputs before comparison makes the
  // comparator robust to either side being cleaned (or not) at any
  // time — no coordinated env-store flip required.
  const secret = (req.headers.get("x-internal-secret") ?? "").replace(/\s+$/, "");
  const expected = (process.env.INTERNAL_SCORING_SECRET ?? "").replace(/\s+$/, "");
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
    // Phase 8 — muscle-group context. Optional; when set, overrides the
    // values on the rep row (rep row may not have them yet — they're
    // tagged via Phase 7's tagWorkoutRep which races with this call).
    exerciseId: z.string().uuid().optional(),
    muscleGroupDayId: z.string().uuid().optional(),
    isGraduationRep: z.boolean().optional(),
  });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  // Phase 0 — captured for catch-block telemetry; body is consumed by
  // safeParse above so we can't re-read it from the request.
  const capturedRepId = body.repId;

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

    const { score, metrics: scoreMetrics } = await scoreRepWithMetrics({
      transcript: body.transcript,
      promptText: body.promptText,
      durationMs: body.durationMs,
      timeBudgetMs: body.timeBudgetMs,
      frameworkNodes: body.frameworkNodes,
      words: body.words,
      userCalibration: body.userCalibration ?? null,
      ...(rep.userId ? { userId: rep.userId } : {}),
      ...(frameworkWeights ? { weights: frameworkWeights } : {}),
      // Phase 8 — surface the muscle-group exercise context to scoring.
      // Body values take priority because tagWorkoutRep races with this
      // call (it tags after the rep is saved); the rep row may not have
      // the FKs yet at scoring time, but the client knows them.
      ...(body.exerciseId || rep.exerciseId
        ? { exerciseId: body.exerciseId ?? rep.exerciseId! }
        : {}),
      ...(body.muscleGroupDayId || rep.muscleGroupDayId
        ? {
            muscleGroupDayId:
              body.muscleGroupDayId ?? rep.muscleGroupDayId!,
          }
        : {}),
      ...(body.isGraduationRep || rep.isGraduationRep
        ? { isGraduationRep: true }
        : {}),
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
    // Grading v3 — async write parity with saveRep: persist the Coach's
    // Focus + doc-shaped feedback on the rep row so async reps drive the
    // retry flow and read back losslessly.
    const coachFocus = isMockFallback ? null : deriveCoachFocus(score);
    const feedbackDoc = buildFeedbackDoc(score);
    let calloutIds: string[] = [];
    await db.transaction(async (tx) => {
      if (coachFocus || feedbackDoc) {
        await tx
          .update(reps)
          .set({
            ...(coachFocus
              ? {
                  coachFocus: {
                    dimension: coachFocus.dimension,
                    subSkill: coachFocus.subSkill,
                    text: coachFocus.text,
                    ...(coachFocus.behavior
                      ? { behavior: coachFocus.behavior }
                      : {}),
                    ...(coachFocus.why ? { why: coachFocus.why } : {}),
                    ...(coachFocus.action
                      ? { action: coachFocus.action }
                      : {}),
                  },
                }
              : {}),
            ...(feedbackDoc ? { feedback: feedbackDoc } : {}),
          })
          .where(eq(reps.id, body.repId));
      }
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
            ) as Record<string, unknown>,
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
      log.warn({
        event: "score_internal.mock_fallback",
        repId: body.repId,
        msg: "progressSnapshots write skipped",
      });
    }

    // Grading v3 — async retry-ledger parity with saveRep: one
    // coaching_events row per delivered Coach's Focus. Best-effort
    // (never fails the scoring response); guests/anonymous rows are
    // skipped like the sync path.
    if (coachFocus && rep.userId) {
      try {
        await db.insert(coachingEvents).values({
          userId: rep.userId,
          repId: body.repId,
          dimension: coachFocus.dimension,
          subSkill: coachFocus.subSkill,
          focusText: coachFocus.text,
          technique: coachFocus.technique ?? null,
        });
      } catch (err) {
        log.warn({
          event: "score_internal.coaching_event_failed",
          repId: body.repId,
          err: serializeErr(err),
        });
      }
    }

    // Phase 0 — happy-path telemetry. score-internal always has repId
    // because the Edge Function only invokes this endpoint with a real
    // pending rep in hand.
    void writeScoringTelemetry({
      source: "api_score_internal",
      repId: body.repId,
      userId: rep.userId,
      metrics: scoreMetrics,
      totalServerDurationMs: Date.now() - requestStart,
      failureReason: resolveFallbackReason(scoreMetrics),
      compositeScore: score.composite,
      // Phase 8 — muscle-group slicing.
      exerciseId: body.exerciseId ?? rep.exerciseId ?? null,
      muscleGroupDayId:
        body.muscleGroupDayId ?? rep.muscleGroupDayId ?? null,
      isGraduationRep:
        body.isGraduationRep ?? rep.isGraduationRep ?? false,
    });

    return NextResponse.json({
      score,
      calloutIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "scoring_failed";
    const failureReason = categorizeFailure(error);
    log.error({
      event: "score_internal.failed",
      failureReason,
      err: serializeErr(error),
    });

    // Phase 0 — failure-path telemetry. Best-effort attribution: we may
    // or may not have repId in scope depending on which try-block step
    // threw; safeParse + the rep lookup are above the scoring call, so
    // by this point repId is usually known. Try-catch the lookup so a
    // telemetry write never blocks the error response.
    void writeScoringTelemetry({
      source: "api_score_internal",
      repId: capturedRepId,
      metrics: null,
      totalServerDurationMs: Date.now() - requestStart,
      failureReason:
        failureReason === "none"
          ? "mock_fallback_both_failed"
          : failureReason,
      errorDetail: message,
      modelUsedOverride: "mock-fallback-v1",
    });

    return NextResponse.json({ error: "scoring_failed", message }, { status: 500 });
  }
}
