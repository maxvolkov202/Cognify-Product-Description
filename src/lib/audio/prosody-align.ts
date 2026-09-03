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
const PERIOD_ONLY_RE = /\.["')\]]*$/;
/** Common abbreviations whose trailing period is not a sentence boundary. */
const ABBREVIATIONS = new Set([
  "dr", "mr", "mrs", "ms", "jr", "sr", "st", "vs", "etc", "inc", "co", "corp",
  // NOTE: "no" is deliberately absent — "No." is a common one-word sentence in
  // rep audio; the lowercase-continuation rule below covers "no." mid-sentence.
  "dept", "approx", "est", "e.g", "i.e", "u.s", "u.k", "a.m", "p.m",
]);

/** End timestamps (ms) of words that close a statement, from punctuated
 *  Deepgram words. A period on a known abbreviation, or one followed by a
 *  lowercase word, is treated as mid-sentence (an "etc." before a pause would
 *  otherwise claim that pause's segment tail). Question marks are reported
 *  separately so callers can exclude interrogatives from the upspeak
 *  denominator — a rising question is correct intonation. */
export function statementEndsFromWords(
  words: AlignableWord[] | null | undefined,
): { endMs: number; isQuestion: boolean }[] {
  if (!words?.length) return [];
  const ends: { endMs: number; isQuestion: boolean }[] = [];
  for (let i = 0; i < words.length; i++) {
    const token = (words[i]!.word ?? "").trim();
    if (!STATEMENT_END_RE.test(token)) continue;
    if (PERIOD_ONLY_RE.test(token) && !/[?!…]/.test(token)) {
      const bare = token.replace(/["')\]]*$/, "").replace(/\.$/, "").toLowerCase();
      if (ABBREVIATIONS.has(bare)) continue;
      const next = (words[i + 1]?.word ?? "").trim();
      if (next && /^[a-z]/.test(next)) continue;
    }
    ends.push({ endMs: words[i]!.endMs, isQuestion: /\?["')\]]*$/.test(token) });
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
  // Global nearest-first matching: pair (statement, tail) candidates by distance
  // and claim greedily by DISTANCE, never by transcript order — an earlier
  // declarative must not steal the tail that sits on a later question (or vice
  // versa). Questions participate in claiming precisely so their rising tails
  // are consumed rather than misattributed; they are then excluded from the
  // declarative denominator.
  const pairs: { s: number; t: number; d: number }[] = [];
  for (let s = 0; s < statementEnds.length; s++) {
    for (let ti = 0; ti < segmentTails.length; ti++) {
      const d = Math.abs(segmentTails[ti]!.endMs - statementEnds[s]!.endMs);
      if (d <= toleranceMs) pairs.push({ s, t: ti, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const claimedTails = new Set<number>();
  const claimedStatements = new Set<number>();
  let rising = 0;
  let falling = 0;
  let alignedDeclarative = 0;
  let aligned = 0;
  for (const pr of pairs) {
    if (claimedTails.has(pr.t) || claimedStatements.has(pr.s)) continue;
    claimedTails.add(pr.t);
    claimedStatements.add(pr.s);
    aligned++;
    if (statementEnds[pr.s]!.isQuestion) continue;
    alignedDeclarative++;
    const slope = segmentTails[pr.t]!.tailSlopeHzPerSec;
    if (slope > TAIL_SLOPE_RISING_HZ_S) rising++;
    if (slope < TAIL_SLOPE_FALLING_HZ_S) falling++;
  }
  // v1 refused to emit a ratio below 2 segments; the aligned path keeps that
  // floor — a single declarative would let one +60 Hz/s tail swing tone by −25.
  if (alignedDeclarative < 2) return null;
  return {
    upspeakRatioAligned: rising / alignedDeclarative,
    finalFallRatioAligned: falling / alignedDeclarative,
    alignedCount: aligned,
    declarativeCount: alignedDeclarative,
    statementCount: statementEnds.length,
  };
}

/** Attach aligned ratios onto a features object when both halves exist.
 *  Returns the same reference otherwise. Only ADDS the *Aligned fields —
 *  never mutates existing ones — so the default render is byte-identical
 *  (calibration guardrail). Since Phase 5, renderProsodyBlock DOES render
 *  the preferred finals ratio when the confidence assist is on
 *  (FF_CONFIDENCE_ACOUSTICS) — changing aligned-ratio computation changes
 *  scoring-prompt bytes under that flag and needs a calibration cycle. */
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
