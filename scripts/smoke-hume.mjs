// One-shot smoke test: call extractHumeProsody against a Hume-hosted
// reference WAV to verify the adapter end-to-end. Confirms:
//   - HUME_API_KEY env var is read
//   - Job submission succeeds
//   - Polling completes
//   - Predictions parse against our Zod schema
//   - aggregateHumePredictions returns a populated emotion vector
//
// Use Hume's own public sample to avoid needing Supabase storage.

import { config } from "dotenv";

config({ path: ".env.prod-temp" });

if (!process.env.HUME_API_KEY) {
  console.error("HUME_API_KEY not set in .env.prod-temp");
  process.exit(1);
}

const { extractHumeProsody, HUME_EMOTION_NAMES } = await import(
  "../src/lib/audio/hume-prosody.ts"
);

console.log("Submitting Hume job (this takes ~10-30s)...");
const t0 = Date.now();
const result = await extractHumeProsody({
  audioUrl: "https://storage.googleapis.com/hume-evi-tts-samples/sample.wav",
  durationMs: 5000,
  timeoutMs: 90_000,
});
const elapsed = Date.now() - t0;

if (!result) {
  console.error("Hume returned null — adapter failed. Check Vercel logs / API key.");
  process.exit(1);
}

console.log(`✓ Hume returned in ${elapsed}ms`);
console.log("  prosodyProvider:", result.prosodyProvider);
console.log("  windowCount:", result.humeWindowCount);
console.log("  emotionMeans length:", result.humeEmotionMeans?.length);
console.log("  emotionVariances length:", result.humeEmotionVariances?.length);
console.log("  raw DSP fields (should be null):");
console.log("    pitchMeanHz:", result.pitchMeanHz);
console.log("    rmsMean:", result.rmsMean);
console.log("    upspeakRatio:", result.upspeakRatio);

// Top-3 emotions by mean.
if (result.humeEmotionMeans) {
  const indexed = result.humeEmotionMeans
    .map((v, i) => ({ name: HUME_EMOTION_NAMES[i], score: v }))
    .sort((a, b) => b.score - a.score);
  console.log("  top-3 emotions:");
  for (const e of indexed.slice(0, 3)) {
    console.log(`    ${e.name}: ${e.score.toFixed(3)}`);
  }
}

console.log("\n✓ Hume adapter end-to-end: OK");
