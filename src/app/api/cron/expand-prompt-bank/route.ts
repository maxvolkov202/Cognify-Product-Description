import { NextResponse } from "next/server";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Grading plan 1c step 4 — offline prompt-bank fill.
 *
 * The live picker only generates prompts when a user taps "Cycle prompts"
 * with fewer than 5 unseen — two serial LLM calls, user-blocking, the one
 * genuine 20 s+ risk on the slate path. This cron tops up the thinnest
 * active banks offline instead (same pipeline: generateAndCachePrompts →
 * canon QA → cache-back), so the in-request generator stays rare.
 *
 * Budget: at most EXERCISES_PER_RUN exercises per run (two serial LLM
 * calls each); daily cadence catches up over runs. Requires live provider
 * credits — a provider failure yields 0 rows for that exercise and is
 * counted, never partial garbage. Scheduled in vercel.json (Vercel Pro
 * cron allowance, 2026-08-30).
 */
const MIN_BANK = 12; // top up any active exercise below this many active prompts
const TOP_UP_TO = 15;
const EXERCISES_PER_RUN = 3;
const PER_EXERCISE_CAP = 8;

async function handleCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  const authOk = expected
    ? req.headers.get("authorization") === `Bearer ${expected}`
    : false;
  if (process.env.NODE_ENV === "production" && !authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const thin = await db.execute<{ id: string; slug: string; bank: number }>(drizzleSql`
    SELECT e.id, e.slug,
      (SELECT COUNT(*)::int FROM cognify_v2.exercise_prompts ep
        WHERE ep.exercise_id = e.id AND ep.is_active = true) AS bank
    FROM cognify_v2.exercises e
    WHERE e.is_active = true
    ORDER BY bank ASC, e.slug ASC
    LIMIT 50
  `);
  const targets = thin.filter((t) => t.bank < MIN_BANK).slice(0, EXERCISES_PER_RUN);
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      thinBanks: thin.filter((t) => t.bank < MIN_BANK).length,
      wouldFill: targets,
    });
  }

  let generated = 0;
  let failures = 0;
  const filled: { slug: string; added: number }[] = [];
  // Lazy import keeps the AI + knowledge graph out of the cron bundle's
  // cold start (same reasoning as the picker's lazy generator).
  const { generateAndCachePrompts } = await import("@/server/lib/prompt-gen-cache");
  for (const t of targets) {
    const count = Math.min(PER_EXERCISE_CAP, TOP_UP_TO - t.bank);
    try {
      const cached = await generateAndCachePrompts({ exerciseId: t.id, count });
      generated += cached.length;
      filled.push({ slug: t.slug, added: cached.length });
      if (cached.length === 0) failures += 1;
    } catch (err) {
      failures += 1;
      log.error({
        event: "cron.expand_prompt_bank.exercise_failed",
        exerciseId: t.id,
        err: serializeErr(err),
      });
    }
  }
  log.info({ event: "cron.expand_prompt_bank.done", generated, failures, filled });
  return NextResponse.json({ ok: failures < targets.length || targets.length === 0, generated, failures, filled });
}

const CRON_NAME = "expand-prompt-bank";

async function recordCronRun(ok: boolean, durationMs: number, error: string | null): Promise<void> {
  try {
    await db.insert(cronRuns).values({ name: CRON_NAME, ok, durationMs, error });
  } catch {
    // observability only — never fail the cron over it
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
    let error: string | null = null;
    const ok = res.status < 400;
    if (!ok) {
      try {
        error = (await res.clone().text()).slice(0, 300);
      } catch {
        error = `status ${res.status}`;
      }
    }
    await recordCronRun(ok, Date.now() - startedAt, error);
  }
  return res;
}
