/**
 * Prosody features extracted from a rep's audio.
 *
 * Cognify DNA Ch.3 splits prosody extraction into two paths:
 *   - INLINE  : derived from Deepgram word timings only (no raw audio
 *               access required). Always available when word timings are
 *               present. Covers rate / fillers / pauses.
 *   - WORKER  : derived from raw audio via parselmouth/Praat (or
 *               equivalent) on an external worker. Covers pitch / volume /
 *               inflection / monotone. Optional — when worker is offline,
 *               worker fields stay null and `prosodyAvailable` is false
 *               so the UI can render Tone scores with a "low-confidence"
 *               affordance.
 *
 * Stored as JSONB on `dimensionScores.signals` (or new `repProsody` table —
 * decided in Ch.3 implementation). Read at chart time to ground Tone +
 * Delivery scores against concrete numbers.
 */

import type { WordTiming } from "./transcribe";

export type ProsodyFeatures = {
  // ——— Inline (Deepgram-derived, always available when words present)
  wordsPerMinute: number;
  fillerCount: number;
  fillerRatePerMinute: number;
  pauseCount: number; // gaps > 400ms between adjacent words
  longPauseCount: number; // gaps > 1500ms — "active processing windows"
  pauseTotalMs: number;
  meanPauseMs: number;
  // ——— Worker (parselmouth/Praat — async, may be null)
  pitchMeanHz: number | null;
  pitchStdSemitones: number | null;
  pitchRangeSemitones: number | null;
  /** % of speech with sustained low pitch variance — high = monotone. */
  monotoneRatio: number | null;
  /** % of statement-end intonations rising — high = upspeak penalty. */
  upspeakRatio: number | null;
  rmsMean: number | null;
  rmsStd: number | null;
  /** Heuristic 0-1; higher = clearer consonant articulation. */
  articulationScore: number | null;
};

/** Whether worker-extracted fields populated. UI uses this to badge
 *  Tone scores as low-confidence when prosody pipeline was offline. */
export function hasWorkerProsody(features: ProsodyFeatures | null): boolean {
  if (!features) return false;
  return (
    features.pitchMeanHz != null ||
    features.pitchStdSemitones != null ||
    features.rmsMean != null
  );
}

/** Render prosody features into a compact prompt block for the AI. */
export function renderProsodyBlock(
  features: ProsodyFeatures | null,
): string | null {
  if (!features) return null;
  const lines: string[] = ["PROSODY (objective audio measurements):"];
  lines.push(
    `  rate: ${features.wordsPerMinute.toFixed(0)} wpm (target band 150-160)`,
  );
  lines.push(
    `  fillers: ${features.fillerCount} total (${features.fillerRatePerMinute.toFixed(1)}/min; target <2/min)`,
  );
  lines.push(
    `  pauses: ${features.pauseCount} (${features.longPauseCount} long ≥1.5s, mean ${Math.round(features.meanPauseMs)}ms)`,
  );
  if (features.pitchMeanHz != null) {
    lines.push(`  pitch mean: ${features.pitchMeanHz.toFixed(0)}Hz`);
  }
  if (features.pitchStdSemitones != null) {
    lines.push(
      `  pitch std: ${features.pitchStdSemitones.toFixed(2)} semitones (target ≥3 for vocal variety)`,
    );
  }
  if (features.pitchRangeSemitones != null) {
    lines.push(
      `  pitch range: ${features.pitchRangeSemitones.toFixed(2)} semitones`,
    );
  }
  if (features.monotoneRatio != null) {
    lines.push(
      `  monotone ratio: ${(features.monotoneRatio * 100).toFixed(0)}% (high = penalize Tone)`,
    );
  }
  if (features.upspeakRatio != null) {
    lines.push(
      `  upspeak ratio: ${(features.upspeakRatio * 100).toFixed(0)}% (high = penalize Tone)`,
    );
  }
  if (features.rmsMean != null && features.rmsStd != null) {
    lines.push(
      `  volume mean ${features.rmsMean.toFixed(3)} std ${features.rmsStd.toFixed(3)} (low std = locked-flat volume)`,
    );
  }
  if (features.articulationScore != null) {
    lines.push(
      `  articulation: ${(features.articulationScore * 100).toFixed(0)}/100`,
    );
  }
  if (!hasWorkerProsody(features)) {
    lines.push(
      `  [PROSODY WORKER OFFLINE — pitch/volume/inflection unavailable; Tone score derived from text + inline metrics only]`,
    );
  }
  return lines.join("\n");
}

export type WordTimingLike = Pick<WordTiming, "word" | "startMs" | "endMs">;
