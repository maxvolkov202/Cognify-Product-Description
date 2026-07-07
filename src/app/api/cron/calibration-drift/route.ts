import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { calibrationRuns, cronRuns } from "@/lib/db/schema";
import { scoreRep } from "@/lib/ai/score";
import { log, serializeErr } from "@/lib/log";

// Phase 14 — provider-aware drift tolerance. The reference-rep expected
// bands were authored against Anthropic Haiku; GPT-4o systematically
// compresses the top band (measured baseline 2026-07-06: avg |delta| 7.8,
// worst ~23), so the Haiku threshold flags most reps as "drift" when
// OpenAI is the active provider. Tolerance follows the provider; override
// with DRIFT_TOLERANCE for either.
import { AI_PROVIDER_ACTIVE } from "@/lib/ai/claude";
const DRIFT_TOLERANCE = parseInt(
  process.env.DRIFT_TOLERANCE ??
    (AI_PROVIDER_ACTIVE === "openai" ? "12" : "5"),
  10,
);

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Per-rep fanout concurrency. 8 workers × ~15s/rep × 4 batches ≈ 60s wall
// time on the 29-rep band — comfortable headroom under maxDuration=300.
// Mirrors weekly-narrative/route.ts:92–99.
const CONCURRENCY = 8;

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
async function handleCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  const authOk = expected
    ? req.headers.get("authorization") === `Bearer ${expected}`
    : false;
  if (process.env.NODE_ENV === "production" && !authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const runId = randomUUID();
  const results: RunOutcome[] = [];

  log.info({
    event: "cron.calibration_drift.start",
    runId,
    refRepCount: refReps.length,
    concurrency: CONCURRENCY,
    dryRun,
  });

  async function processOne(rep: ReferenceRep): Promise<void> {
    const t0 = Date.now();
    try {
      const score = await scoreOne(rep);
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
        deltaComposite != null && Math.abs(deltaComposite) > DRIFT_TOLERANCE;
      const status = isFallback
        ? "fallback"
        : driftHigh
          ? "drift"
          : "ok";

      if (!dryRun) {
        await db.insert(calibrationRuns).values({
          runId,
          refRepId: rep.id,
          expectedComposite,
          actualComposite,
          deltaComposite,
          expectedPerDim:
            (expectedPerDim as Record<string, number> | null) ?? null,
          actualPerDim:
            (actualPerDim as Record<string, number> | null) ?? null,
          deltaPerDim:
            Object.keys(deltaPerDim).length > 0
              ? (deltaPerDim as Record<string, number>)
              : null,
          rubricVersion: score.rubricVersion ?? null,
          modelVersion: score.modelVersion ?? null,
          status,
        });
      }

      results.push({
        refRepId: rep.id,
        latencyMs: Date.now() - t0,
        status,
        deltaComposite,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      log.error({
        event: "cron.calibration_drift.ref_rep_failed",
        refRepId: rep.id,
        err: serializeErr(err),
      });
      if (!dryRun) {
        try {
          await db.insert(calibrationRuns).values({
            runId,
            refRepId: rep.id,
            expectedComposite: rep.expected?.composite ?? null,
            actualComposite: null,
            deltaComposite: null,
            expectedPerDim:
              (rep.expected?.dimensions as Record<string, number> | null) ?? null,
            actualPerDim: null,
            deltaPerDim: null,
            rubricVersion: null,
            modelVersion: null,
            status: "error",
          });
        } catch (writeErr) {
          // Stay quiet — the next nightly run will retry.
          log.error({
            event: "cron.calibration_drift.record_error_row_failed",
            err: serializeErr(writeErr),
          });
        }
      }
      results.push({
        refRepId: rep.id,
        latencyMs: Date.now() - t0,
        status: "error",
        error: msg,
      });
    }
  }

  // Hand-rolled bounded concurrency — N workers pull from a shared cursor.
  // Mirrors the proven pattern in weekly-narrative/route.ts:92–99.
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, refReps.length) },
    async () => {
      while (cursor < refReps.length) {
        const i = cursor++;
        await processOne(refReps[i]!);
      }
    },
  );
  await Promise.all(workers);

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
  let alertOutcome: "sent" | "skipped" | "no-webhook" | "failed" | "dry-run" =
    "skipped";

  if (shouldAlert && dryRun) {
    alertOutcome = "dry-run";
  } else if (shouldAlert) {
    const webhookUrl = process.env.CALIBRATION_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      log.warn({
        event: "cron.calibration_drift.alert_no_webhook",
        runId,
        avgAbsDelta: Number(avgAbsDelta.toFixed(1)),
        worstAbsDelta,
        fallbacks: summary.fallbackCount,
      });
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
      const opsUrl =
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "") + "/ops/calibration";
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
          log.error({
            event: "cron.calibration_drift.alert_http_error",
            status: alertRes.status,
          });
          alertOutcome = "failed";
        }
      } catch (err) {
        log.error({
          event: "cron.calibration_drift.alert_webhook_error",
          err: serializeErr(err),
        });
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

// ── P8 — cron run ledger ────────────────────────────────────────────────
// Wraps the handler so every authorized invocation records one
// cognify_v2.cron_runs row (name, ok, duration_ms, error). Best-effort:
// a down DB never turns the cron response into a 500. Unauthorized
// probes (401/403) are not recorded so they don't spam the ledger.
const CRON_NAME = "calibration-drift";

async function recordCronRun(
  ok: boolean,
  durationMs: number,
  error: string | null,
): Promise<void> {
  try {
    await db
      .insert(cronRuns)
      .values({ name: CRON_NAME, ok, durationMs, error });
  } catch {
    // Ledger write is best-effort — never fail the cron over it.
  }
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = Date.now();
  let res: Response;
  try {
    res = await handleCron(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(false, Date.now() - startedAt, message.slice(0, 300));
    throw err;
  }
  if (res.status !== 401 && res.status !== 403) {
    const ok = res.status >= 200 && res.status < 300;
    let error: string | null = null;
    if (!ok) {
      try {
        error = (await res.clone().text()).slice(0, 300);
      } catch {
        error = `HTTP ${res.status}`;
      }
    }
    await recordCronRun(ok, Date.now() - startedAt, error);
  }
  return res;
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

async function scoreOne(rep: ReferenceRep): Promise<ScoreResponse> {
  // P-4: call the scorer in-process. The cron used to self-fetch
  // /api/score, but that endpoint now requires currentUser(). The
  // shared-secret alternative (/api/score-internal) is purpose-built
  // for the Supabase Edge Function with a different body shape;
  // calling scoreRep directly avoids the HTTP hop, the secret
  // handling, and the body-schema mismatch entirely.
  const score = await scoreRep({
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
    ...(rep.audioUrl ? { audioUrl: rep.audioUrl } : {}),
  });
  return {
    composite: score.composite,
    rubricVersion: score.rubricVersion,
    modelVersion: score.modelVersion,
    dimensions: score.dimensions.map((d) => ({
      dimension: d.dimension,
      score: d.score,
    })),
  };
}

type RunOutcome = {
  refRepId: string;
  latencyMs: number;
  status: "ok" | "drift" | "fallback" | "error";
  deltaComposite?: number | null;
  error?: string;
};
