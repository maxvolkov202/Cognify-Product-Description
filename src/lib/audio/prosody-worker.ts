/**
 * External prosody worker client.
 *
 * Cognify's Tone scoring grounds in pitch / volume / inflection / monotone
 * signals that can't be derived from a transcript or word timings — they
 * require frame-by-frame audio analysis. We delegate that work to a
 * standalone Python service (see infra/prosody-worker/) and merge its
 * results into the inline features extracted from Deepgram word timings.
 *
 * Why an external worker:
 *   - parselmouth (Praat) + librosa + ffmpeg add ~150MB of binary deps
 *     that don't belong in the Next.js Node runtime
 *   - Audio analysis is CPU-bound; isolating it lets us scale prosody
 *     independently of the main app
 *   - Cold-start latency (parselmouth init ~200ms) is acceptable as a
 *     standalone service; baked into every request would be painful
 *
 * Failure modes (all degrade gracefully — score path NEVER fails because
 * of worker issues):
 *   - FF_PROSODY_WORKER unset            → skip the call, return null
 *   - PROSODY_WORKER_URL unset           → skip the call, return null
 *   - Worker times out (>5s default)     → return null
 *   - Worker returns non-2xx             → return null
 *   - Worker returns malformed payload   → log + return null
 *
 * When this returns null, hasWorkerProsody() in prosody.ts evaluates
 * false and the UI badges Tone scores as low-confidence (Ch.6 surface).
 */

import { z } from "zod";
import type { ProsodyFeatures } from "./prosody";
import { extractHumeProsody } from "./hume-prosody";

const workerResponseSchema = z.object({
  pitchMeanHz: z.number().nullable(),
  pitchStdSemitones: z.number().nullable(),
  pitchRangeSemitones: z.number().nullable(),
  monotoneRatio: z.number().min(0).max(1).nullable(),
  upspeakRatio: z.number().min(0).max(1).nullable(),
  rmsMean: z.number().nullable(),
  rmsStd: z.number().nullable(),
  articulationScore: z.number().min(0).max(1).nullable(),
});

export type WorkerProsodyResult = z.infer<typeof workerResponseSchema>;

export type ExtractWorkerProsodyInput = {
  /** Signed URL to the audio in Supabase storage. The worker fetches and
   *  decodes; the worker MUST NOT require credentialed access — signed
   *  URLs are short-lived and self-authorizing. */
  audioUrl: string;
  /** Total rep duration; lets the worker bail early on absurdly long
   *  inputs (worker default cap: 180s). */
  durationMs: number;
  /** Override default 5000ms. Tests / batch jobs may want longer. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5000;

/** Call the self-hosted Praat worker (Ch.3b). Returns its prosody subset,
 *  or null on timeout / non-2xx / malformed payload. */
async function callPraatWorker(
  url: string,
  input: ExtractWorkerProsodyInput,
): Promise<Partial<ProsodyFeatures> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.PROSODY_WORKER_TOKEN
          ? { authorization: `Bearer ${process.env.PROSODY_WORKER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        audioUrl: input.audioUrl,
        durationMs: input.durationMs,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(
        `[prosody-worker] non-2xx response (${res.status}); skipping`,
      );
      return null;
    }
    const json: unknown = await res.json();
    const parsed = workerResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        "[prosody-worker] response failed schema validation; skipping",
        parsed.error.issues.slice(0, 3),
      );
      return null;
    }
    return { ...parsed.data, prosodyProvider: "praat-worker" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(
        `[prosody-worker] timeout after ${input.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms; skipping`,
      );
    } else {
      console.warn("[prosody-worker] fetch failed; skipping:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Returns the worker-derived subset of ProsodyFeatures, or null on any
 *  failure. Caller merges into inline-derived features via
 *  `mergeProsody()` from prosody-inline.ts.
 *
 *  Provider selection (Ch.3.1 spike chose the Praat worker as primary;
 *  Hume is optional/additive — grading-v3-design.md §3.1):
 *   1. PROSODY_WORKER_URL set → call the self-hosted Praat worker (Ch.3b).
 *      This is the PRIMARY path because the spike selected it.
 *   2. If the worker is unavailable OR yields nothing, AND HUME_API_KEY is
 *      set → fall back to Hume.ai's prosody model (Ch.S5).
 *   3. Neither available → return null (degrades to inline-only Tone).
 *
 *  A prior bug preferred Hume whenever HUME_API_KEY was set and returned
 *  its result even when null, silently short-circuiting the Praat worker
 *  (so a broken/empty Hume key disabled prosody entirely). Praat-first with
 *  Hume-as-fallback fixes that and matches the spike decision.
 *
 *  Both providers populate the same `ProsodyFeatures` shape so the
 *  downstream score path is provider-agnostic. */
export async function extractWorkerProsody(
  input: ExtractWorkerProsodyInput,
): Promise<Partial<ProsodyFeatures> | null> {
  if (process.env.FF_PROSODY_WORKER !== "true") return null;

  const url = process.env.PROSODY_WORKER_URL;
  const hasHume = Boolean(process.env.HUME_API_KEY);

  // Primary: the Praat worker (the spike winner).
  if (url) {
    const worker = await callPraatWorker(url, input);
    if (worker) return worker;
    // Worker unreachable / empty — fall through to Hume if configured.
  }

  // Fallback (or sole provider when no worker URL): Hume.ai (Ch.S5).
  if (hasHume) {
    return extractHumeProsody({
      audioUrl: input.audioUrl,
      durationMs: input.durationMs,
      timeoutMs: input.timeoutMs,
    });
  }

  if (!url) {
    console.warn(
      "[prosody-worker] FF_PROSODY_WORKER=true but neither PROSODY_WORKER_URL nor HUME_API_KEY is set; skipping",
    );
  }
  return null;
}
