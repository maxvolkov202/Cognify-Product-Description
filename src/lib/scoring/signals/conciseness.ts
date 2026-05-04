/**
 * Cognify Ch.11 — Conciseness text-signal extractor.
 *
 * Pure function over (transcript, words). Produces the measurable
 * Conciseness signals named in the DNA spec.
 *
 * Signals:
 *   - hedgeRatePerMinute  : "kind of", "sort of", "I think", "maybe",
 *                           "just", "a little bit", "I guess", "probably"
 *                           — per minute
 *   - repetitionScore     : 3-gram overlap fraction across sentences
 *                           (0..1) — proxy for "I'm restating the same
 *                           idea"
 *   - wordsPerDistinctIdea: totalWords / distinctContentNouns — proxy
 *                           for words-per-idea / padding
 */

import type { ConcisenessTextSignals } from "./types";
import {
  countLexicon,
  durationToMinutes,
  ngrams,
  round,
  splitSentences,
  tokenize,
} from "./_helpers";

/** Hedge phrases — narrower than the audio-layer hedge lexicon. The
 *  text-signal version targets dilution-of-claim hedges, not all
 *  uncertainty markers. */
const HEDGE_LEXICON = [
  "kind of",
  "sort of",
  "i think",
  "i guess",
  "i suppose",
  "maybe",
  "perhaps",
  "probably",
  "possibly",
  "just a",
  "a little bit",
  "a bit",
  "more or less",
  "pretty much",
  "i feel like",
];

/** Stopwords excluded from "content noun" counting in
 *  wordsPerDistinctIdea. Aligned with English function words. */
const CONTENT_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "in", "on", "at",
  "of", "for", "with", "to", "from", "by", "as", "is", "are",
  "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "should", "could", "can",
  "may", "might", "must", "shall", "this", "that", "these",
  "those", "there", "here", "i", "you", "he", "she", "it", "we",
  "they", "me", "him", "her", "us", "them", "my", "your", "his",
  "its", "our", "their", "what", "which", "who", "whom", "when",
  "where", "why", "how", "so", "not", "no", "yes", "all", "any",
  "some", "very", "really", "just", "only", "even", "also", "too",
  "than", "then", "well", "okay", "alright", "um", "uh",
]);

/** Compute repetition fraction: of all 3-grams in the transcript, what
 *  fraction appears in MORE THAN ONE sentence. Sentence-bounded so a
 *  speaker re-using an idea across sentences scores higher than one
 *  using the same phrase within a single sentence. */
function repetitionScore(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length < 2) return 0;
  // Build per-sentence 3-gram sets.
  const perSentence: Set<string>[] = sentences.map((s) => {
    const tokens = tokenize(s);
    return new Set(ngrams(tokens, 3));
  });
  // Count distinct 3-grams that appear in ≥2 sentences.
  const counts = new Map<string, number>();
  for (const set of perSentence) {
    for (const g of set) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const totalDistinct = counts.size;
  if (totalDistinct === 0) return 0;
  let repeated = 0;
  for (const [, c] of counts) {
    if (c >= 2) repeated++;
  }
  return repeated / totalDistinct;
}

/** wordsPerDistinctIdea — totalWords / distinct content tokens.
 *  Stopwords excluded from the denominator so "the" doesn't count as
 *  an idea. Floors denominator at 1 to avoid div-by-zero on micro-reps. */
function wordsPerDistinctIdea(transcript: string): number {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return 0;
  const distinctContent = new Set<string>();
  for (const t of tokens) {
    if (t.length <= 2) continue;
    if (CONTENT_STOPWORDS.has(t)) continue;
    distinctContent.add(t);
  }
  return tokens.length / Math.max(1, distinctContent.size);
}

/** Ch.S3 — trail-off tail words. If the final sentence ends in any of
 *  these, the speaker effectively trailed off — which is the negative
 *  case for stoppingPointAccuracy. */
const TRAIL_OFF_TAILS: ReadonlySet<string> = new Set([
  "yeah",
  "so",
  "right",
  "you",
  "know",
  "like",
  "i",
  "guess",
  "think",
  "maybe",
  "kind",
  "sort",
  "really",
  "just",
  "um",
  "uh",
  "er",
  "okay",
  "alright",
]);

/** Ch.S3 — Stopping-point accuracy 0-100. Layered heuristic over the
 *  final sentence:
 *    base = 50
 *    +30 if final sentence ends with a period (definitive close marker)
 *    -20 if final sentence ends with "?" or "!" (interrogative or
 *        exclamatory close still counts as intentional but is less
 *        canonical for a "clean stop")
 *    +20 if final sentence is ≥4 words (avoid penalizing one-word
 *        affirmations like "Yes." which DO end cleanly)
 *    -30 if final-sentence tail (last 1-3 words) ends in a trail-off
 *        word (yeah, so, right, you know, kind of, just, um)
 *    -10 if final sentence contains a hedge ("kind of", "i think",
 *        "i guess") within the LAST 5 tokens — late-hedging dilutes
 *        the close even if not literally a trail-off word
 *    +10 if final sentence has a closing-tone marker ("the bottom line",
 *        "in summary", "the answer is", "that's why")
 *  Floor 0, ceil 100. */
function computeStoppingPointAccuracy(transcript: string): number {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return 50;
  const sentences = splitSentences(trimmed);
  if (sentences.length === 0) return 50;
  const last = sentences[sentences.length - 1] ?? "";
  const lastWords = last
    .toLowerCase()
    .replace(/[^a-z0-9'\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (lastWords.length === 0) return 50;

  let score = 50;
  // Punctuation
  if (/\.\s*$/.test(last)) score += 30;
  if (/[?!]\s*$/.test(last)) score -= 20;
  // Length
  if (lastWords.length >= 4) score += 20;
  // Trail-off tail check (last 3 words)
  const tail = lastWords.slice(-3);
  for (const w of tail) {
    if (TRAIL_OFF_TAILS.has(w)) {
      score -= 30;
      break;
    }
  }
  // Late-hedge penalty
  const lastFive = lastWords.slice(-5).join(" ");
  if (
    countLexicon(lastFive, [
      "kind of",
      "sort of",
      "i think",
      "i guess",
      "you know",
      "or something",
      "or whatever",
    ]) > 0
  ) {
    score -= 10;
  }
  // Closing-tone marker bonus
  const lastTen = lastWords.slice(-10).join(" ");
  if (
    countLexicon(lastTen, [
      "the bottom line",
      "in summary",
      "to summarize",
      "the answer is",
      "the takeaway",
      "to close",
      "the headline is",
      "what this means",
      "that's why",
      "in conclusion",
    ]) > 0
  ) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

export function extractConcisenessSignals(input: {
  transcript: string;
  durationMs: number;
}): ConcisenessTextSignals {
  const { transcript, durationMs } = input;
  const minutes = durationToMinutes(durationMs);

  const hedgeCount = countLexicon(transcript, HEDGE_LEXICON);
  const repetition = repetitionScore(transcript);
  const wpdi = wordsPerDistinctIdea(transcript);
  const stopping = computeStoppingPointAccuracy(transcript);

  return {
    hedgeRatePerMinute: round(hedgeCount / minutes, 2),
    repetitionScore: round(repetition, 3),
    wordsPerDistinctIdea: round(wpdi, 2),
    stoppingPointAccuracy: stopping,
  };
}
