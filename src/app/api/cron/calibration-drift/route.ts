import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { calibrationRuns } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Ch.15b — Nightly calibration drift cron.
 *
 * GET /api/cron/calibration-drift
 *
 * Iterates the reference-rep bank, scores each through /api/score on
 * the same deployment, computes per-dim + composite drift vs hand-
 * authored expected values, and writes one row per ref rep into
 * `calibration_runs`. Operators read the history on /ops/calibration.
 *
 * Auth: same pattern as /api/cron/weekly-narrative. Vercel Cron
 * invocations carry `x-vercel-cron: 1` and a Bearer secret; in dev
 * we relax so manual triggering works.
 *
 * Robustness: each ref-rep call is wrapped — a single failed score
 * doesn't kill the run. When the scoring path fast-fails into the
 * mock-fallback (no Anthropic credits, e.g.), the row is still
 * persisted with `model_version = "mock-fallback-v1"` and
 * `status = "fallback"` so the /ops page can show a clear "credits
 * lapsed" warning instead of a silently-broken run.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const authOk = expected
    ? req.headers.get("authorization") === `Bearer ${expected}`
    : false;
  if (process.env.NODE_ENV === "production" && !authOk && !isVercelCron) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Resolve the base URL for the score-API self-call. Vercel runtime
  // sets VERCEL_URL to the deploy host (no protocol); in dev we hit
  // localhost. Fall back to a manual override env var.
  const baseUrl =
    process.env.CRON_SELF_BASE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://127.0.0.1:3333");

  let refReps: ReferenceRep[];
  try {
    refReps = loadReferenceReps();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "ref_reps_load_failed", message: msg },
      { status: 500 },
    );
  }

  const runId = randomUUID();
  const results: RunOutcome[] = [];

  for (const rep of refReps) {
    const t0 = Date.now();
    try {
      const score = await scoreOne(baseUrl, rep);
      const expectedComposite = rep.expected?.composite ?? null;
      const actualComposite = score.composite ?? null;
      const deltaComposite =
        expectedComposite != null && actualComposite != null
          ? actualComposite - expectedComposite
          : null;

      const expectedPerDim = rep.expected?.dimensions ?? null;
      const actualPerDim: Record<string, number> = {};
      for (const d of score.dimensions ?? []) {
        actualPerDim[d.dimension] = d.score;
      }
      const deltaPerDim: Record<string, number> = {};
      if (expectedPerDim) {
        for (const [dim, exp] of Object.entries(expectedPerDim)) {
          const act = actualPerDim[dim];
          if (typeof exp === "number" && typeof act === "number") {
            deltaPerDim[dim] = act - exp;
          }
        }
      }

      const isFallback = score.modelVersion === "mock-fallback-v1";
      const driftHigh =
        deltaComposite != null && Math.abs(deltaComposite) > 5;
      const status = isFallback
        ? "fallback"
        : driftHigh
          ? "drift"
          : "ok";

      await db.insert(calibrationRuns).values({
        runId,
        refRepId: rep.id,
        expectedComposite,
        actualComposite,
        deltaComposite,
        expectedPerDim:
          (expectedPerDim as unknown as object | null) ?? null,
        actualPerDim:
          (actualPerDim as unknown as object | null) ?? null,
        deltaPerDim:
          Object.keys(deltaPerDim).length > 0
            ? (deltaPerDim as unknown as object)
            : null,
        rubricVersion: score.rubricVersion ?? null,
        modelVersion: score.modelVersion ?? null,
        status,
      });

      results.push({
        refRepId: rep.id,
        latencyMs: Date.now() - t0,
        status,
        deltaComposite,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(
        `[cron/calibration-drift] ref-rep ${rep.id} failed:`,
        msg,
      );
      try {
        await db.insert(calibrationRuns).values({
          runId,
          refRepId: rep.id,
          expectedComposite: rep.expected?.composite ?? null,
          actualComposite: null,
          deltaComposite: null,
          expectedPerDim:
            (rep.expected?.dimensions as unknown as object | null) ?? null,
          actualPerDim: null,
          deltaPerDim: null,
          rubricVersion: null,
          modelVersion: null,
          status: "error",
        });
      } catch (writeErr) {
        // Stay quiet — the next nightly run will retry.
        console.error(
          `[cron/calibration-drift] failed to record error row:`,
          writeErr,
        );
      }
      results.push({
        refRepId: rep.id,
        latencyMs: Date.now() - t0,
        status: "error",
        error: msg,
      });
    }
  }

  const summary = {
    runId,
    totalReps: results.length,
    okCount: results.filter((r) => r.status === "ok").length,
    driftCount: results.filter((r) => r.status === "drift").length,
    fallbackCount: results.filter((r) => r.status === "fallback").length,
    errorCount: results.filter((r) => r.status === "error").length,
    results,
  };

  // Ch.C1 — Alert on drift / fallback. Fire webhook when:
  //   - avg-|delta| > 5 (broad scoring drift), OR
  //   - any single rep's |delta| > 15 (a specific rep blew up), OR
  //   - fallbackCount > 2 (real prod scoring is failing on multiple reps)
  const realDeltas = results
    .map((r) => r.deltaComposite)
    .filter((d): d is number => typeof d === "number");
  const avgAbsDelta =
    realDeltas.length > 0
      ? realDeltas.reduce((s, v) => s + Math.abs(v), 0) / realDeltas.length
      : 0;
  const worstAbsDelta =
    realDeltas.length > 0
      ? Math.max(...realDeltas.map((d) => Math.abs(d)))
      : 0;
  const shouldAlert =
    avgAbsDelta > 5 || worstAbsDelta > 15 || summary.fallbackCount > 2;
  let alertSentAt: Date | null = null;
  let alertOutcome: "sent" | "skipped" | "no-webhook" | "failed" = "skipped";

  if (shouldAlert) {
    const webhookUrl = process.env.CALIBRATION_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn(
        `[cron/calibration-drift] DRIFT ALERT (no webhook configured): runId=${runId} avg=${avgAbsDelta.toFixed(1)} worst=${worstAbsDelta} fallbacks=${summary.fallbackCount}`,
      );
      alertOutcome = "no-webhook";
    } else {
      const top3 = [...results]
        .filter((r) => typeof r.deltaComposite === "number")
        .sort(
          (a, b) =>
            Math.abs((b.deltaComposite ?? 0)) -
            Math.abs((a.deltaComposite ?? 0)),
        )
        .slice(0, 3);
      const driftLines = top3.map(
        (r) => `• ${r.refRepId}: ${r.deltaComposite! > 0 ? "+" : ""}${r.deltaComposite}`,
      );
      const opsUrl = baseUrl + "/ops/calibration";
      const payload = {
        text: [
          `*Cognify calibration drift alert* (run ${runId})`,
          `Avg |Δcomposite|: ${avgAbsDelta.toFixed(1)} (gate >5)`,
          `Worst |Δcomposite|: ${worstAbsDelta} (gate >15)`,
          `Fallbacks: ${summary.fallbackCount} of ${summary.totalReps} (gate >2)`,
          ``,
          `*Top-3 worst drift reps:*`,
          ...driftLines,
          ``,
          `Follow up at <${opsUrl}|/ops/calibration>`,
        ].join("\n"),
      };
      try {
        const alertRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (alertRes.ok) {
          alertSentAt = new Date();
          alertOutcome = "sent";
          // Backfill alert_sent_at across all rows in this run.
          await db
            .update(calibrationRuns)
            .set({ alertSentAt })
            .where(eq(calibrationRuns.runId, runId));
        } else {
          console.error(
            `[cron/calibration-drift] alert webhook returned ${alertRes.status}`,
          );
          alertOutcome = "failed";
        }
      } catch (err) {
        console.error(
          `[cron/calibration-drift] alert webhook error:`,
          err,
        );
        alertOutcome = "failed";
      }
    }
  }

  return NextResponse.json({
    ...summary,
    avgAbsDelta: Math.round(avgAbsDelta * 10) / 10,
    worstAbsDelta,
    alertSentAt: alertSentAt?.toISOString() ?? null,
    alertOutcome,
  });
}

// ——— Reference-rep loading ————————————————————————————————

type ReferenceRep = {
  id: string;
  promptText: string;
  transcript: string;
  durationMs: number;
  audioUrl?: string;
  expected?: {
    composite?: number;
    dimensions?: Record<string, number>;
  };
};

function loadReferenceReps(): ReferenceRep[] {
  const path = resolve(
    process.cwd(),
    "scripts",
    "calibration",
    "reference-reps.json",
  );
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as { reps?: ReferenceRep[] };
  if (!parsed.reps || !Array.isArray(parsed.reps)) {
    throw new Error("reference-reps.json missing top-level `reps` array");
  }
  // Only run "band" reps — independence reps don't have an expected
  // composite to compute drift against. The /ops page can render
  // independence-rep results separately if/when needed.
  return parsed.reps.filter(
    (r) => r.expected?.composite != null,
  );
}

// ——— Score-API self-call ————————————————————————————————

type ScoreResponse = {
  composite?: number;
  rubricVersion?: string;
  modelVersion?: string;
  dimensions?: { dimension: string; score: number }[];
};

async function scoreOne(
  baseUrl: string,
  rep: ReferenceRep,
): Promise<ScoreResponse> {
  const body: Record<string, unknown> = {
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
  };
  if (rep.audioUrl) body.audioUrl = rep.audioUrl;
  const res = await fetch(`${baseUrl}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ScoreResponse;
}

type RunOutcome = {
  refRepId: string;
  latencyMs: number;
  status: "ok" | "drift" | "fallback" | "error";
  deltaComposite?: number | null;
  error?: string;
};
