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

export function extractConcisenessSignals(input: {
  transcript: string;
  durationMs: number;
}): ConcisenessTextSignals {
  const { transcript, durationMs } = input;
  const minutes = durationToMinutes(durationMs);

  const hedgeCount = countLexicon(transcript, HEDGE_LEXICON);
  const repetition = repetitionScore(transcript);
  const wpdi = wordsPerDistinctIdea(transcript);

  return {
    hedgeRatePerMinute: round(hedgeCount / minutes, 2),
    repetitionScore: round(repetition, 3),
    wordsPerDistinctIdea: round(wpdi, 2),
  };
}
