/**
 * Grading plan WS8 — prosody at upload time.
 *
 * `warmProsody` runs inside next/server `after()` in /api/upload: it calls
 * the worker with a generous budget (the cold start is off the scoring
 * path now) and stores the bundle. `getCachedProsody` is the scorer's
 * fast read; a miss (still pending, failed, or an older upload) falls back
 * to the in-request worker call exactly as before.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { audioProsodyCache } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { ProsodyFeatures } from "@/lib/audio/prosody";
import { extractWorkerProsody } from "@/lib/audio/prosody-worker";

/** Worker budget when warming off the scoring path. */
export const WARM_TIMEOUT_MS = 20_000;

export async function warmProsody(input: {
  path: string;
  signedUrl: string;
  durationMs: number;
}): Promise<void> {
  const start = Date.now();
  await safeDb(async () => {
    await db
      .insert(audioProsodyCache)
      .values({ path: input.path, status: "pending" })
      .onConflictDoUpdate({
        target: audioProsodyCache.path,
        set: { status: "pending", error: null, updatedAt: new Date() },
      });
    return true;
  }, false);
  let features: Partial<ProsodyFeatures> | null = null;
  let error: string | null = null;
  try {
    features = await extractWorkerProsody({
      audioUrl: input.signedUrl,
      durationMs: input.durationMs,
      timeoutMs: WARM_TIMEOUT_MS,
    });
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
  }
  await safeDb(async () => {
    // Upsert: if the pending insert was lost to a DB blip, the 20 s worker
    // result must not be discarded with it.
    await db
      .insert(audioProsodyCache)
      .values({
        path: input.path,
        features: (features as Record<string, unknown> | null) ?? null,
        status: features ? "ready" : "failed",
        error: features ? null : (error ?? "worker returned null"),
      })
      .onConflictDoUpdate({
        target: audioProsodyCache.path,
        set: {
          features: (features as Record<string, unknown> | null) ?? null,
          status: features ? "ready" : "failed",
          error: features ? null : (error ?? "worker returned null"),
          updatedAt: new Date(),
        },
      });
    return true;
  }, false);
  console.log(
    `[prosody-cache] warm ${features ? "ready" : "failed"} path=${input.path} ms=${Date.now() - start}`,
  );
}

/** Fast read for the scorer. Returns the bundle only when the warm-up
 *  finished successfully; pending/failed/missing → null (caller falls back). */
export async function getCachedProsody(
  path: string,
): Promise<Partial<ProsodyFeatures> | null> {
  return safeDb(async () => {
    const [row] = await db
      .select({ features: audioProsodyCache.features, status: audioProsodyCache.status })
      .from(audioProsodyCache)
      .where(eq(audioProsodyCache.path, path))
      .limit(1);
    if (!row || row.status !== "ready" || !row.features) return null;
    // Same latency signal as before: a hit is visible in logs, so a
    // regression back to in-request cold starts stays distinguishable.
    console.log(`[prosody-cache] hit path=${path}`);
    return row.features as Partial<ProsodyFeatures>;
  }, null);
}
