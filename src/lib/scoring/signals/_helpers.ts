/**
 * Shared utilities for the four text-signal extractors. Pure functions
 * only — no DB, no fetch, no time-of-day. Internal to the `signals/`
 * directory; consumers of the public API import from `./index.ts`.
 */

/** Split transcript into sentences. Handles ".", "?", "!", and the
 *  realistic transcript edge case where punctuation may be missing
 *  (Deepgram occasionally drops it on stutters). When fewer than 2
 *  sentence-terminators are present, falls back to splitting on
 *  conjunction-led clauses ("and then", "but", "so") so single-sentence
 *  reps still produce >0 segments for sentence-level metrics. */
export function splitSentences(transcript: string): string[] {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return [];
  // Primary: sentence-terminator split.
  const primary = trimmed
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (primary.length >= 2) return primary;
  // Fallback: clause split on common spoken-language conjunction starts.
  // Only triggers when terminators are missing.
  const fallback = trimmed
    .split(/[,]?\s+(?=(?:and then|but then|so then|but|so|because)\s)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return fallback.length > 0 ? fallback : [trimmed];
}

/** Tokenize text into lowercased word tokens. Strips punctuation but
 *  preserves hyphens within compound words (e.g. "first-principles"). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Tokenize preserving original case — used for acronym detection. */
export function tokenizeCased(text: string): string[] {
  return text
    .replace(/[^A-Za-z0-9'-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Count case-insensitive occurrences of any phrase from `lexicon`,
 *  matching whole words (so "in" doesn't match "inside"). Handles
 *  multi-word phrases by allowing flexible internal whitespace. */
export function countLexicon(
  text: string,
  lexicon: readonly string[],
): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const phrase of lexicon) {
    const escaped = phrase
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    const re = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lower.match(re);
    if (matches) total += matches.length;
  }
  return total;
}

/** Extract n-grams from a flat list of tokens. Returns the raw n-gram
 *  strings (joined by single space). */
export function ngrams(tokens: readonly string[], n: number): string[] {
  if (tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

/** Minutes (≥0.001 to avoid div-by-zero). */
export function durationToMinutes(durationMs: number): number {
  return Math.max(0.001, durationMs / 60_000);
}

/** Word count from words array if available, else from transcript split. */
export function getWordCount(
  transcript: string,
  words?: readonly { word: string }[],
): number {
  if (words && words.length > 0) return words.length;
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

/** Round to N decimals — used in extractors so the rendered SIGNALS
 *  block doesn't show 14 digits of float noise. */
export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
