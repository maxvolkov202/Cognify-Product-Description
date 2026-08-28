/**
 * Cognify Deterministic Signal Extractor — v2-beta.1
 *
 * Pure functions over Deepgram word-level timestamps. Extracts the
 * measurable signals that feed the hybrid scoring architecture.
 *
 * This file contains the MODEL-STABLE layer of Cognify's scoring — same
 * input audio returns the same signals today, next week, and next year.
 * The calibration story David demanded in the April 2026 advisory
 * meeting relies on this determinism: trend lines are real (not model
 * drift) because these signals are pure functions.
 *
 * Sources:
 *   - Elizabeth Shriberg (SRI) — speech disfluency research, 1994 Switchboard corpus
 *   - 30 Minutes to President's Club — modern cold-call disfluency analysis (2024)
 *   - src/lib/ai/knowledge/skills/pacing.md + confidence.md
 */

export type WordTiming = {
  word: string;
  startMs: number;
  endMs: number;
};

export type SignalBundle = {
  // Core
  wordCount: number;
  durationMs: number;
  timeBudgetMs: number;
  wpm: number;

  // Pacing signals (per minute rates)
  fillerCount: number;
  fillerRate: number;
  hedgeCount: number;
  hedgeRate: number;
  timeBudgetRatio: number;

  // Thinking / recovery signals
  longPauseCount: number;
  stallCount: number;
  /** WS4 — deliberate pauses: 1-3 s gaps right after a clause end (the
   *  preceding punctuated word ends with . ! ? , ; :). These are the
   *  "pauses placed after key points" the rubric rewards. */
  clausePauseCount: number;
  /** WS4 — 1-3 s gaps NOT at a clause end: mid-phrase hesitation. */
  midPhrasePauseCount: number;
  pauseP50Ms: number;
  pauseP95Ms: number;
  restartCount: number;

  // Pressure / pacing-variance signals (quartile analysis)
  quartileWpm: readonly [number, number, number, number];
  quartileWpmVariance: number;
  finalQuartileDelta: number;
};

/**
 * Filler lexicon — non-lexical + lexical fillers common in L1 English.
 * Conservative list: excludes "like" and "so" because they produce too
 * many false positives in natural speech. Targets the disfluencies that
 * listeners universally recognize as filler.
 */
const FILLER_LEXICON = [
  "um",
  "uh",
  "er",
  "ah",
  "hmm",
  "you know",
  "i mean",
  "basically",
  "actually",
  "literally",
  "honestly",
];

/**
 * Hedge lexicon — weakens assertions and erodes perceived confidence.
 * Scored separately from fillers because hedging is a semantic choice
 * (downgrading a claim) rather than a disfluency.
 */
const HEDGE_LEXICON = [
  "i think",
  "i guess",
  "maybe",
  "perhaps",
  "probably",
  "possibly",
  "sort of",
  "kind of",
  "a bit",
  "a little",
  "pretty much",
  "more or less",
];

/**
 * Restart markers — regex patterns indicating the speaker started a
 * sentence, abandoned it, and restarted. Strong signal for cognitive
 * load / confidence wobble.
 */
const RESTART_MARKERS: readonly RegExp[] = [
  /\bwait\b/i,
  /\bsorry\b/i,
  /\blet me start\b/i,
  /\bstart over\b/i,
  /\bwhat i meant\b/i,
  /\bscratch that\b/i,
];

function countLexiconMatches(
  transcript: string,
  lexicon: readonly string[],
): number {
  const lower = transcript.toLowerCase();
  let count = 0;
  for (const term of lexicon) {
    // Escape regex metacharacters, allow flexible whitespace between words
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `\\b${escaped.replace(/\s+/g, "\\s+")}\\b`,
      "g",
    );
    const matches = lower.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor(sortedAsc.length * p)),
  );
  return sortedAsc[idx] ?? 0;
}

/**
 * Extract the full signal bundle from a completed rep.
 *
 * Inputs:
 *   - words       : Deepgram word-level timestamps (preferred signal source)
 *   - transcript  : plain-text transcript (used for lexicon matching)
 *   - durationMs  : actual rep duration in milliseconds
 *   - timeBudgetMs: expected budget for the rep (e.g., 30s or 60s from rep type)
 *
 * Pure function: same inputs → same outputs, always.
 */
export function extractSignals(input: {
  words: readonly WordTiming[];
  transcript: string;
  durationMs: number;
  timeBudgetMs: number;
}): SignalBundle {
  const { words, transcript, durationMs, timeBudgetMs } = input;
  const safeDurationMs = Math.max(1, durationMs);
  const durationMin = safeDurationMs / 60_000;

  // Word count: prefer Deepgram array; fall back to transcript split
  const wordCount =
    words.length > 0
      ? words.length
      : transcript.trim().split(/\s+/).filter(Boolean).length;

  const wpm = wordCount / durationMin;

  // Lexicon matches — fully deterministic
  const fillerCount = countLexiconMatches(transcript, FILLER_LEXICON);
  const hedgeCount = countLexiconMatches(transcript, HEDGE_LEXICON);

  // Pause distribution from inter-word gaps
  const gaps: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const curr = words[i];
    if (!prev || !curr) continue;
    const gap = curr.startMs - prev.endMs;
    // Ignore micro-gaps (< 300ms) — those are normal word spacing
    if (gap > 300) gaps.push(gap);
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  // WS4 — pause placement. A 1-3 s gap after a clause end is a deliberate
  // bookmark; the same gap mid-phrase is a hesitation. Deepgram words are
  // punctuated (transcribe.ts uses punctuated_word), so the preceding
  // word's trailing punctuation marks the clause boundary.
  let clausePauseCount = 0;
  let midPhrasePauseCount = 0;
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const curr = words[i];
    if (!prev || !curr) continue;
    const gap = curr.startMs - prev.endMs;
    if (gap < 1000 || gap > 3000) continue;
    if (/[.!?,;:\u2026\u2014\u2013]["')\]]*$/.test(prev.word)) clausePauseCount += 1;
    else midPhrasePauseCount += 1;
  }
  const longPauseCount = gaps.filter((g) => g > 1500).length;
  const stallCount = gaps.filter((g) => g > 3000).length;
  const pauseP50Ms = percentile(sortedGaps, 0.5);
  const pauseP95Ms = percentile(sortedGaps, 0.95);

  // Restart heuristic from transcript regex
  let restartCount = 0;
  for (const pattern of RESTART_MARKERS) {
    const matches = transcript.match(pattern);
    if (matches) restartCount += matches.length;
  }

  // Quartile WPM — split the SPEECH SPAN (first word start → last word
  // end) into 4 windows, compute WPM per window. Using the recording
  // length instead would zero the last window whenever the user stops the
  // recorder late, and read even delivery as a collapse (WS4 review).
  // High variance = unstable pacing. Final-quartile delta = rush signal.
  const speechStartMs = words.length > 0 ? Math.min(...words.map((w) => w.startMs)) : 0;
  const speechEndMs = words.length > 0 ? Math.max(...words.map((w) => w.endMs)) : safeDurationMs;
  const speechSpanMs = Math.max(1, speechEndMs - speechStartMs);
  const quartileDurMs = speechSpanMs / 4;
  const quartileWpm: [number, number, number, number] = [0, 0, 0, 0];
  if (words.length > 0 && quartileDurMs > 0) {
    for (let q = 0; q < 4; q++) {
      const startMs = speechStartMs + q * quartileDurMs;
      const endMs = speechStartMs + (q + 1) * quartileDurMs;
      const count = words.filter(
        (w) => w.startMs >= startMs && (w.startMs < endMs || (q === 3 && w.startMs <= endMs)),
      ).length;
      quartileWpm[q] = count / (quartileDurMs / 60_000);
    }
  }

  const qMean =
    (quartileWpm[0] + quartileWpm[1] + quartileWpm[2] + quartileWpm[3]) / 4;
  const quartileWpmVariance =
    quartileWpm.reduce((sum, q) => sum + Math.pow(q - qMean, 2), 0) / 4;
  const finalQuartileDelta =
    qMean > 0 ? (quartileWpm[3] - qMean) / qMean : 0;

  return {
    wordCount,
    durationMs: safeDurationMs,
    timeBudgetMs: Math.max(1, timeBudgetMs),
    wpm,
    fillerCount,
    fillerRate: fillerCount / durationMin,
    hedgeCount,
    hedgeRate: hedgeCount / durationMin,
    timeBudgetRatio: safeDurationMs / Math.max(1, timeBudgetMs),
    longPauseCount,
    stallCount,
    clausePauseCount,
    midPhrasePauseCount,
    pauseP50Ms,
    pauseP95Ms,
    restartCount,
    quartileWpm: [...quartileWpm] as readonly [number, number, number, number],
    quartileWpmVariance,
    finalQuartileDelta,
  };
}
