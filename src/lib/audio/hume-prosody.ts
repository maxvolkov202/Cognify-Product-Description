/**
 * Cognify Ch.S5 — Hume.ai Expression Measurement adapter.
 *
 * Calls Hume's prosody model and maps the 48-emotion response to the
 * subset of `ProsodyFeatures` fields Cognify consumes for Tone scoring.
 *
 * Why Hume:
 *   - Battle-tested commercial prosody analysis (founded on NIH research)
 *   - Per-window emotion vectors map cleanly to Tone sub-skills (pitch
 *     variation ≈ Excitement variance; monotone ≈ Boredom + low
 *     Excitement variance; warmth ≈ Calmness/Tenderness; vocal presence
 *     ≈ Confidence/Determination)
 *   - $0.0005-0.005/rep at typical durations
 *   - 99.9% uptime SLA on the batch API
 *
 * Trade-off:
 *   - Hume returns EMOTION DIMENSIONS, not raw DSP measurements. The
 *     existing ProsodyFeatures schema has fields for pitch std (Hz),
 *     RMS std, etc. that come from Praat-grade DSP. Hume can't directly
 *     fill those — they remain null when Hume is the provider.
 *   - The Tone sub-skill mapper (sub-skill-mapper.ts) reads BOTH the
 *     classic DSP fields AND a new emotion-vector field, so the mapper
 *     gets the best signal available regardless of which provider is
 *     active.
 *
 * Alternative provider: PROSODY_WORKER_URL (the original Ch.3b stub)
 * still works — point it at a self-hosted parselmouth worker for true
 * raw DSP. Either provider populates the same `ProsodyFeatures`
 * schema; downstream code is provider-agnostic.
 *
 * Activation:
 *   1. Set HUME_API_KEY in env (Vercel: `npx vercel env add HUME_API_KEY production`)
 *   2. Set FF_PROSODY_WORKER=true
 *   3. Upload audio for ≥12 reference reps via /ops/reference-bank
 *   4. Run `npx tsx scripts/calibrate-prosody.ts` and review per-rep numbers
 *
 * Failure modes (all return null — score path NEVER fails because of
 * Hume issues):
 *   - HUME_API_KEY unset                 → return null
 *   - Job submission fails (4xx/5xx)     → return null
 *   - Polling exceeds 60s                → return null
 *   - Predictions parse fails            → log, return null
 */

import { z } from "zod";
import type { ProsodyFeatures } from "./prosody";

const HUME_API_BASE = "https://api.hume.ai/v0";
const HUME_DEFAULT_TIMEOUT_MS = 60_000; // 60s — Hume batch jobs typically 5-15s
const HUME_POLL_INTERVAL_MS = 2_000;

/** The 48 emotion names Hume's prosody model emits. Order matters for
 *  the emotion-vector field on ProsodyFeatures — we serialize as a
 *  fixed-order Float array to keep the schema compact. */
export const HUME_EMOTION_NAMES = [
  "Admiration",
  "Adoration",
  "Aesthetic Appreciation",
  "Amusement",
  "Anger",
  "Anxiety",
  "Awe",
  "Awkwardness",
  "Boredom",
  "Calmness",
  "Concentration",
  "Confusion",
  "Contemplation",
  "Contempt",
  "Contentment",
  "Craving",
  "Determination",
  "Disappointment",
  "Disgust",
  "Distress",
  "Doubt",
  "Ecstasy",
  "Embarrassment",
  "Empathic Pain",
  "Entrancement",
  "Envy",
  "Excitement",
  "Fear",
  "Guilt",
  "Horror",
  "Interest",
  "Joy",
  "Love",
  "Nostalgia",
  "Pain",
  "Pride",
  "Realization",
  "Relief",
  "Romance",
  "Sadness",
  "Satisfaction",
  "Desire",
  "Shame",
  "Surprise (negative)",
  "Surprise (positive)",
  "Sympathy",
  "Tiredness",
  "Triumph",
] as const;

export type HumeEmotionName = (typeof HUME_EMOTION_NAMES)[number];

const humeEmotionSchema = z.object({
  name: z.string(),
  score: z.number(),
});

const humePredictionSchema = z.object({
  time: z.object({ begin: z.number(), end: z.number() }),
  emotions: z.array(humeEmotionSchema),
});

const humePredictionsResponseSchema = z.array(
  z.object({
    results: z.object({
      predictions: z.array(
        z.object({
          models: z.object({
            prosody: z
              .object({
                grouped_predictions: z.array(
                  z.object({
                    predictions: z.array(humePredictionSchema),
                  }),
                ),
              })
              .nullable()
              .optional(),
          }),
        }),
      ),
    }),
  }),
);

const jobStatusSchema = z.object({
  state: z.object({
    status: z.enum(["QUEUED", "IN_PROGRESS", "COMPLETED", "FAILED"]),
  }).optional(),
});

/** Output shape returned by extractHumeProsody. Subset of ProsodyFeatures
 *  that Hume can populate — emotion vector + derived sub-skill proxies.
 *  pitchMeanHz / pitchStdSemitones / rmsMean stay null (Praat domain). */
export type HumeProsodyResult = Partial<ProsodyFeatures> & {
  /** Mean per-emotion score across all windows (length-48 array, order
   *  matches HUME_EMOTION_NAMES). */
  humeEmotionMeans: number[];
  /** Per-emotion variance across windows. High variance on
   *  "Excitement"/"Determination" → vocal variety; low → monotone. */
  humeEmotionVariances: number[];
  /** Number of prosody windows analyzed. */
  humeWindowCount: number;
  /** Source identifier — lets the calibration harness distinguish Hume
   *  from a Praat worker output. */
  prosodyProvider: "hume.ai";
};

/** Extract prosody features via Hume.ai. Returns null on any failure. */
export async function extractHumeProsody(args: {
  audioUrl: string;
  durationMs: number;
  /** Override default 60s. */
  timeoutMs?: number;
}): Promise<HumeProsodyResult | null> {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) return null;

  const totalTimeoutMs = args.timeoutMs ?? HUME_DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + totalTimeoutMs;

  // 1. Submit batch job
  let jobId: string;
  try {
    const submitRes = await fetch(`${HUME_API_BASE}/batch/jobs`, {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: { prosody: { granularity: "utterance" } },
        urls: [args.audioUrl],
      }),
    });
    if (!submitRes.ok) {
      console.warn(
        `[hume-prosody] job submit non-2xx (${submitRes.status}); skipping`,
      );
      return null;
    }
    const submitJson = (await submitRes.json()) as { job_id?: string };
    if (!submitJson.job_id) {
      console.warn("[hume-prosody] no job_id in response; skipping");
      return null;
    }
    jobId = submitJson.job_id;
  } catch (err) {
    console.warn("[hume-prosody] job submit failed:", err);
    return null;
  }

  // 2. Poll for completion
  while (Date.now() < deadline) {
    await sleep(HUME_POLL_INTERVAL_MS);
    try {
      const statusRes = await fetch(
        `${HUME_API_BASE}/batch/jobs/${jobId}`,
        { headers: { "X-Hume-Api-Key": apiKey } },
      );
      if (!statusRes.ok) {
        console.warn(
          `[hume-prosody] poll non-2xx (${statusRes.status}); retrying`,
        );
        continue;
      }
      const parsed = jobStatusSchema.safeParse(await statusRes.json());
      const status = parsed.data?.state?.status;
      if (status === "COMPLETED") break;
      if (status === "FAILED") {
        console.warn("[hume-prosody] job FAILED");
        return null;
      }
    } catch (err) {
      console.warn("[hume-prosody] poll error (continuing):", err);
    }
  }
  if (Date.now() >= deadline) {
    console.warn(`[hume-prosody] timeout after ${totalTimeoutMs}ms`);
    return null;
  }

  // 3. Fetch predictions
  let predictions: z.infer<typeof humePredictionSchema>[];
  try {
    const predRes = await fetch(
      `${HUME_API_BASE}/batch/jobs/${jobId}/predictions`,
      { headers: { "X-Hume-Api-Key": apiKey } },
    );
    if (!predRes.ok) {
      console.warn(
        `[hume-prosody] predictions non-2xx (${predRes.status}); skipping`,
      );
      return null;
    }
    const json = await predRes.json();
    const parsed = humePredictionsResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        "[hume-prosody] predictions schema validation failed",
        parsed.error.issues.slice(0, 3),
      );
      return null;
    }
    predictions = parsed.data
      .flatMap((d) => d.results.predictions)
      .flatMap((p) => p.models.prosody?.grouped_predictions ?? [])
      .flatMap((g) => g.predictions);
  } catch (err) {
    console.warn("[hume-prosody] predictions fetch failed:", err);
    return null;
  }

  if (predictions.length === 0) {
    console.warn("[hume-prosody] zero predictions returned; skipping");
    return null;
  }

  return aggregateHumePredictions(predictions);
}

/** Pure: aggregate Hume per-window emotion arrays into the schema-
 *  compatible ProsodyFeatures shape. Exposed for unit testing. */
export function aggregateHumePredictions(
  predictions: z.infer<typeof humePredictionSchema>[],
): HumeProsodyResult {
  const n = predictions.length;
  const dim = HUME_EMOTION_NAMES.length;
  const sums = new Array<number>(dim).fill(0);
  const sumSquares = new Array<number>(dim).fill(0);

  for (const pred of predictions) {
    const lookup = new Map(pred.emotions.map((e) => [e.name, e.score]));
    for (let i = 0; i < dim; i++) {
      const v = lookup.get(HUME_EMOTION_NAMES[i]!) ?? 0;
      sums[i]! += v;
      sumSquares[i]! += v * v;
    }
  }
  const means = sums.map((s) => s / n);
  const variances = sumSquares.map((sq, i) => {
    const m = means[i]!;
    const variance = sq / n - m * m;
    return Math.max(0, variance);
  });

  return {
    pitchMeanHz: null,
    pitchStdSemitones: null,
    pitchRangeSemitones: null,
    monotoneRatio: null,
    upspeakRatio: null,
    rmsMean: null,
    rmsStd: null,
    articulationScore: null,
    humeEmotionMeans: means,
    humeEmotionVariances: variances,
    humeWindowCount: n,
    prosodyProvider: "hume.ai",
  };
}

/** Look up an emotion's mean score by name. Returns 0 if absent. */
export function getHumeEmotionMean(
  result: HumeProsodyResult,
  name: HumeEmotionName,
): number {
  const idx = HUME_EMOTION_NAMES.indexOf(name);
  return idx >= 0 ? (result.humeEmotionMeans[idx] ?? 0) : 0;
}

/** Look up an emotion's per-window variance by name. */
export function getHumeEmotionVariance(
  result: HumeProsodyResult,
  name: HumeEmotionName,
): number {
  const idx = HUME_EMOTION_NAMES.indexOf(name);
  return idx >= 0 ? (result.humeEmotionVariances[idx] ?? 0) : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
