/**
 * Inline prosody extractor — pure function over Deepgram word timings.
 *
 * Always available when word timings are present (no raw audio fetch
 * required). Returns the worker-derived fields as null; the worker
 * pipeline (Ch.3b) fills them in when prosody analysis lands.
 *
 * Why it lives separately from the worker path: the inline metrics
 * (rate/fillers/pauses) are cheap and never fail. The worker metrics
 * (pitch/volume) are slow and can fail. Splitting lets us trust the
 * inline path unconditionally and treat the worker as a quality lift.
 */

import type { ProsodyFeatures, WordTimingLike } from "./prosody";

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "uhm",
  "umm",
  "uhh",
  "like",
  "you",
  "know",
  "basically",
  "literally",
  "actually",
  "right",
  "so",
  "well",
  "kinda",
  "sorta",
]);

/** "you know" only counts as filler when consecutive — single words "you"
 *  and "know" appear constantly in normal speech. We post-process. */
const PAUSE_THRESHOLD_MS = 400;
const LONG_PAUSE_THRESHOLD_MS = 1500;

export type ExtractInlineProsodyInput = {
  words: readonly WordTimingLike[];
  durationMs: number;
};

/** Returns prosody features with worker-derived fields nulled. Worker
 *  pipeline merges its results in via `mergeProsody()` at the call site. */
export function extractInlineProsody(
  input: ExtractInlineProsodyInput,
): ProsodyFeatures {
  const { words, durationMs } = input;

  // ——— Words per minute
  const minutes = durationMs / 60_000;
  const wordsPerMinute = minutes > 0 ? words.length / minutes : 0;

  // ——— Filler detection
  const fillerCount = countFillers(words);
  const fillerRatePerMinute = minutes > 0 ? fillerCount / minutes : 0;

  // ——— Pause detection (inter-word gaps)
  let pauseCount = 0;
  let longPauseCount = 0;
  let pauseTotalMs = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i]!.startMs - words[i - 1]!.endMs;
    if (gap >= PAUSE_THRESHOLD_MS) {
      pauseCount += 1;
      pauseTotalMs += gap;
      if (gap >= LONG_PAUSE_THRESHOLD_MS) longPauseCount += 1;
    }
  }
  const meanPauseMs = pauseCount > 0 ? pauseTotalMs / pauseCount : 0;

  return {
    wordsPerMinute,
    fillerCount,
    fillerRatePerMinute,
    pauseCount,
    longPauseCount,
    pauseTotalMs,
    meanPauseMs,
    pitchMeanHz: null,
    pitchStdSemitones: null,
    pitchRangeSemitones: null,
    monotoneRatio: null,
    upspeakRatio: null,
    rmsMean: null,
    rmsStd: null,
    articulationScore: null,
  };
}

/** Count fillers, with the "you know" two-word special case. */
function countFillers(words: readonly WordTimingLike[]): number {
  let count = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!.word.toLowerCase().replace(/[^a-z]/g, "");
    if (w === "you" && i + 1 < words.length) {
      const next = words[i + 1]!.word.toLowerCase().replace(/[^a-z]/g, "");
      if (next === "know") {
        count += 1; // count "you know" as one filler
        i += 1; // skip next word
        continue;
      }
    }
    if (w === "you") continue; // bare "you" is not a filler
    if (w === "know") continue; // bare "know" is not a filler
    if (FILLER_WORDS.has(w)) count += 1;
  }
  return count;
}

/** Merge worker-derived fields into an inline-derived feature set. Used
 *  by the score pipeline once the worker (Ch.3b) returns. */
export function mergeProsody(
  inline: ProsodyFeatures,
  worker: Partial<ProsodyFeatures> | null,
): ProsodyFeatures {
  if (!worker) return inline;
  return {
    ...inline,
    pitchMeanHz: worker.pitchMeanHz ?? inline.pitchMeanHz,
    pitchStdSemitones: worker.pitchStdSemitones ?? inline.pitchStdSemitones,
    pitchRangeSemitones:
      worker.pitchRangeSemitones ?? inline.pitchRangeSemitones,
    monotoneRatio: worker.monotoneRatio ?? inline.monotoneRatio,
    upspeakRatio: worker.upspeakRatio ?? inline.upspeakRatio,
    rmsMean: worker.rmsMean ?? inline.rmsMean,
    rmsStd: worker.rmsStd ?? inline.rmsStd,
    articulationScore: worker.articulationScore ?? inline.articulationScore,
  };
}
