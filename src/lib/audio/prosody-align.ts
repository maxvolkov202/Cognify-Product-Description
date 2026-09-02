/**
 * Prosody v2 — scoring-time alignment (plan P2).
 *
 * The worker's upspeakRatio segments on silence because the upload-time warm
 * runs in parallel with transcription and can never see a transcript. At
 * SCORING time we do have Deepgram's punctuated word timings, so the scorer
 * intersects the cached `segmentTails` with statement-end timestamps to get
 * upspeak/finalFall ratios anchored to actual sentence boundaries — pure TS,
 * unit-tested, no second worker call, warm path untouched.
 *
 * The silence-heuristic worker ratios remain the fallback when word timings
 * are absent (async retries, calibration clips).
 */
import type { ProsodyFeatures } from "./prosody";

/** Minimal structural slice of a timed word — the scorer's word payload
 *  doesn't always carry confidence, and alignment needs neither it nor start. */
export type AlignableWord = { word: string; endMs: number };

/** A voiced-segment tail must end within this window of a statement end to
 *  count as that statement's final contour. Deepgram word ends and Praat
 *  voicing ends disagree by ~100-300ms routinely. */
export const ALIGN_TOLERANCE_MS = 400;

/** Same thresholds as the worker's silence-heuristic ratios (main_v2.py):
 *  ±50 Hz/sec ≈ ±0.5 Hz per 10ms frame. */
export const TAIL_SLOPE_RISING_HZ_S = 50;
export const TAIL_SLOPE_FALLING_HZ_S = -50;

const STATEMENT_END_RE = /[.?!…]["')\]]*$/;

/** End timestamps (ms) of words that close a statement, from punctuated
 *  Deepgram words. Question marks are EXCLUDED from the upspeak denominator's
 *  source set by callers that want declarative-only — here we keep every
 *  terminal mark and report questions separately so the core can decide. */
export function statementEndsFromWords(
  words: AlignableWord[] | null | undefined,
): { endMs: number; isQuestion: boolean }[] {
  if (!words?.length) return [];
  const ends: { endMs: number; isQuestion: boolean }[] = [];
  for (const w of words) {
    const token = (w.word ?? "").trim();
    if (STATEMENT_END_RE.test(token)) {
      ends.push({ endMs: w.endMs, isQuestion: /\?["')\]]*$/.test(token) });
    }
  }
  return ends;
}

export type AlignedTailRatios = {
  /** Rising-tail share over aligned DECLARATIVE statement ends. */
  upspeakRatioAligned: number;
  /** Falling-tail share over aligned declarative statement ends. */
  finalFallRatioAligned: number;
  /** How many statement ends found a matching segment tail. */
  alignedCount: number;
  declarativeCount: number;
  statementCount: number;
};

/** Intersect worker segment tails with statement ends. Each statement end
 *  claims the nearest tail within ALIGN_TOLERANCE_MS (a tail can serve only
 *  one statement). Returns null when there is nothing to align — callers keep
 *  the worker's silence-heuristic ratio as the fallback. */
export function alignSegmentTails(
  segmentTails: { endMs: number; tailSlopeHzPerSec: number }[] | null | undefined,
  statementEnds: { endMs: number; isQuestion: boolean }[],
  toleranceMs: number = ALIGN_TOLERANCE_MS,
): AlignedTailRatios | null {
  if (!segmentTails?.length || !statementEnds.length) return null;
  const tails = [...segmentTails].sort((a, b) => a.endMs - b.endMs);
  const claimed = new Set<number>();
  let rising = 0;
  let falling = 0;
  let alignedDeclarative = 0;
  let aligned = 0;
  for (const s of statementEnds) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < tails.length; i++) {
      if (claimed.has(i)) continue;
      const d = Math.abs(tails[i]!.endMs - s.endMs);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best < 0 || bestDist > toleranceMs) continue;
    claimed.add(best);
    aligned++;
    if (s.isQuestion) continue; // a rising question is correct intonation, not upspeak
    alignedDeclarative++;
    const slope = tails[best]!.tailSlopeHzPerSec;
    if (slope > TAIL_SLOPE_RISING_HZ_S) rising++;
    if (slope < TAIL_SLOPE_FALLING_HZ_S) falling++;
  }
  if (alignedDeclarative === 0) return null;
  return {
    upspeakRatioAligned: rising / alignedDeclarative,
    finalFallRatioAligned: falling / alignedDeclarative,
    alignedCount: aligned,
    declarativeCount: alignedDeclarative,
    statementCount: statementEnds.length,
  };
}

/** Attach aligned ratios onto a features object when both halves exist.
 *  Returns the same reference otherwise. NEVER touches fields the prompt
 *  evidence block renders (calibration guardrail: zero prompt-byte impact). */
export function withAlignedTailRatios(
  features: ProsodyFeatures | null,
  words: AlignableWord[] | null | undefined,
): ProsodyFeatures | null {
  if (!features?.segmentTails?.length) return features;
  const aligned = alignSegmentTails(features.segmentTails, statementEndsFromWords(words));
  if (!aligned) return features;
  return {
    ...features,
    upspeakRatioAligned: aligned.upspeakRatioAligned,
    finalFallRatioAligned: aligned.finalFallRatioAligned,
  };
}
