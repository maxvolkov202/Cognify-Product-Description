/**
 * Cognify Ch.11 — Clarity text-signal extractor.
 *
 * Pure function over (transcript, words). Produces the four measurable
 * Clarity signals named in the DNA spec; the LLM scores AGAINST these
 * numbers in the SIGNALS block of the score prompt.
 *
 * Signals:
 *   - jargonRatePerMinute    : long words / acronyms / low-frequency
 *                              vocabulary against COMMON_WORDS, per-minute
 *   - assumedContextMarkers  : "as you know" / "obviously" / "clearly" /
 *                              "of course" / "as I mentioned" — phrases
 *                              that assume shared context with the
 *                              listener
 *   - sentenceComplexityIndex: avg(commas + subordinating-conjunctions)
 *                              per sentence
 *   - abstractionMarkerCount : abstract nouns (-tion/-ment/-ity/-ness)
 *                              that appear without a concrete example
 *                              within ±1 sentence
 */

import type { ClarityTextSignals } from "./types";
import {
  countLexicon,
  durationToMinutes,
  round,
  splitSentences,
  tokenize,
  tokenizeCased,
} from "./_helpers";
import { isCommonWord } from "./common-words";
import { lookupConcreteness } from "./concreteness-words";

/** English stopwords — the closed-class function words that don't carry
 *  content. Used by `countDistinctContentNouns` for the Ch.S1 idea
 *  density signal. Compact list: only the most frequent ~100. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "and",
  "or",
  "but",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "from",
  "for",
  "by",
  "with",
  "without",
  "about",
  "as",
  "into",
  "over",
  "under",
  "this",
  "that",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "will",
  "would",
  "should",
  "could",
  "can",
  "may",
  "might",
  "must",
  "shall",
  "i",
  "me",
  "my",
  "mine",
  "we",
  "us",
  "our",
  "ours",
  "you",
  "your",
  "yours",
  "he",
  "him",
  "his",
  "she",
  "her",
  "hers",
  "it",
  "its",
  "they",
  "them",
  "their",
  "theirs",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "if",
  "then",
  "than",
  "so",
  "very",
  "just",
  "only",
  "also",
  "yes",
  "no",
  "not",
  "n't",
  "yeah",
  "ok",
  "okay",
  "um",
  "uh",
  "like",
  "really",
  "kind",
  "sort",
  "much",
  "many",
  "more",
  "most",
  "some",
  "any",
  "all",
  "each",
  "every",
  "few",
  "such",
  "own",
  "same",
  "other",
  "another",
  "here",
  "there",
  "now",
  "thing",
  "things",
  "stuff",
  "way",
  "ways",
]);

/** Crude pluralization-tolerant stem: lowercases, strips trailing
 *  -s/-es/-ing/-ed when the resulting stem is ≥3 chars. Used for
 *  distinct-content-noun counting in `countDistinctContentNouns`. */
function stemContentToken(token: string): string {
  const t = token.toLowerCase();
  if (t.length <= 3) return t;
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  if (t.endsWith("ing") && t.length > 5) {
    const stem = t.slice(0, -3);
    if (
      stem.length > 1 &&
      stem[stem.length - 1] === stem[stem.length - 2]
    ) {
      return stem.slice(0, -1);
    }
    return stem;
  }
  if (t.endsWith("ed") && t.length > 4) return t.slice(0, -2);
  return t;
}

/** Ch.S1 — Idea density: distinct stemmed content tokens per sentence.
 *  Content tokens = ≥2 chars, not in STOPWORDS, not pure digits. */
function computeIdeaDensity(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return 0;
  const seen = new Set<string>();
  for (const tok of tokenize(transcript)) {
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    seen.add(stemContentToken(tok));
  }
  return seen.size / sentences.length;
}

/** Ch.S1 — Word precision: average concreteness rating of in-lexicon
 *  content tokens, rescaled from 1-5 to 0-100. Tokens not in the
 *  lexicon are SKIPPED (not penalized) so out-of-vocabulary words
 *  don't drag the score in either direction.
 *
 *  Returns 50 (neutral midpoint) when no lookups succeed, so the
 *  signal degrades gracefully on transcripts dominated by names,
 *  numbers, or specialized vocabulary. */
function computeWordPrecisionScore(transcript: string): number {
  const tokens = tokenize(transcript);
  let total = 0;
  let count = 0;
  for (const tok of tokens) {
    if (STOPWORDS.has(tok)) continue;
    const rating = lookupConcreteness(tok);
    if (rating == null) continue;
    total += rating;
    count++;
  }
  if (count === 0) return 50;
  // Rescale 1.0..5.0 → 0..100. (rating - 1) / 4 * 100.
  const mean = total / count;
  return Math.round(((mean - 1) / 4) * 100);
}

/** Phrases that assume the listener already shares context. Conservative
 *  list — does not include "the X" un-anchored references because that
 *  needs co-reference resolution we don't have. */
const ASSUMED_CONTEXT_MARKERS = [
  "as you know",
  "as you can see",
  "as i mentioned",
  "as i said",
  "as i noted",
  "obviously",
  "clearly",
  "of course",
  "everyone knows",
  "needless to say",
  "it goes without saying",
  "we all know",
];

/** Subordinating conjunctions — used in sentence-complexity counting.
 *  Coordinating conjunctions (and, or, but) are intentionally excluded
 *  because they don't add subordinate clause depth. */
const SUBORDINATING_CONJUNCTIONS = [
  "because",
  "since",
  "although",
  "though",
  "while",
  "whereas",
  "if",
  "unless",
  "until",
  "when",
  "whenever",
  "where",
  "wherever",
  "before",
  "after",
  "as",
  "even though",
  "even if",
  "so that",
  "in order to",
];

/** Concrete-example markers that "ground" abstract nouns in adjacent
 *  sentences. Presence of any of these within ±1 sentence of an
 *  abstract noun cancels its abstractionMarker count. */
const CONCRETE_EXAMPLE_MARKERS = [
  "for example",
  "for instance",
  "such as",
  "specifically",
  "like when",
  "like the time",
  "imagine",
  "picture",
  "concretely",
  "in particular",
  "namely",
];

/** Abstract-noun suffix regex — matches words ending in -tion / -ment /
 *  -ity / -ness (case-insensitive, ≥6 chars to skip false positives like
 *  "ten" or "men"). */
const ABSTRACT_NOUN_RE = /\b[a-zA-Z]{4,}(tion|ment|ity|ness)\b/gi;

/** All-caps acronym regex — 4+ uppercase letters, optionally with
 *  digits. 2-3 letter acronyms (CFO, ROI, CEO, KPI, GTM, B2B) are
 *  intentionally exempted — they're standard business / tech vocabulary
 *  for the audiences Cognify trains against, and counting them as
 *  jargon inverts the signal on real biz pitches. The 4+ threshold
 *  catches genuinely-jargon-y acronyms (REST, SOAP, SQL, JWT, OAUTH)
 *  while letting the conventional ones through. */
const ACRONYM_RE = /\b[A-Z][A-Z0-9]{3,}\b/g;

/** Count tokens that are jargon candidates:
 *   - length ≥10 chars AND not in COMMON_WORDS
 *   - OR matches the acronym regex (≥4 uppercase chars)
 *  Hyphenated tokens are split on the hyphen so "highest-ROI" doesn't
 *  trigger the long-word path — its parts are evaluated independently.
 *  Each token is counted once per occurrence (a rep that says
 *  "fundamentally" twice has 2 jargon hits). */
function countJargonTokens(transcript: string): number {
  // Long-word check (lowercase tokens for COMMON_WORDS lookup).
  // Hyphenated tokens get split — a 12-char hyphenated phrase with two
  // 5-char parts is two short common parts, not one jargon long word.
  const tokens = tokenize(transcript);
  let longWordCount = 0;
  for (const t of tokens) {
    const parts = t.includes("-") ? t.split("-").filter(Boolean) : [t];
    for (const p of parts) {
      if (p.length >= 10 && !isCommonWord(p)) longWordCount++;
    }
  }
  // Acronym check — separate pass on cased text. ALL-CAPS tokens that
  // are themselves common words are skipped via the COMMON_WORDS lookup.
  const casedTokens = tokenizeCased(transcript);
  let acronymCount = 0;
  for (const t of casedTokens) {
    ACRONYM_RE.lastIndex = 0;
    if (ACRONYM_RE.test(t)) {
      if (!isCommonWord(t.toLowerCase())) acronymCount++;
    }
  }
  return longWordCount + acronymCount;
}

/** Count distinct abstract nouns across the transcript, discounting
 *  those that appear within ±1 sentence of a concrete-example marker. */
function countAbstractionMarkers(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return 0;
  let net = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i] ?? "";
    const matches = sentence.match(ABSTRACT_NOUN_RE);
    if (!matches || matches.length === 0) continue;
    // Check ±1 sentence window for concrete-example markers.
    const windowStart = Math.max(0, i - 1);
    const windowEnd = Math.min(sentences.length - 1, i + 1);
    let groundedNearby = false;
    for (let j = windowStart; j <= windowEnd; j++) {
      const window = sentences[j] ?? "";
      if (countLexicon(window, CONCRETE_EXAMPLE_MARKERS) > 0) {
        groundedNearby = true;
        break;
      }
    }
    if (!groundedNearby) net += matches.length;
  }
  return net;
}

/** Average count of (commas + subordinating-conjunction matches) per
 *  sentence. Pure structural complexity proxy. */
function sentenceComplexity(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return 0;
  let total = 0;
  for (const s of sentences) {
    const commaCount = (s.match(/,/g) ?? []).length;
    const subordCount = countLexicon(s, SUBORDINATING_CONJUNCTIONS);
    total += commaCount + subordCount;
  }
  return total / sentences.length;
}

/**
 * Extract the four Clarity signals. Pure: same input → same output.
 */
export function extractClaritySignals(input: {
  transcript: string;
  durationMs: number;
}): ClarityTextSignals {
  const { transcript, durationMs } = input;
  const minutes = durationToMinutes(durationMs);

  const jargonCount = countJargonTokens(transcript);
  const assumedContextCount = countLexicon(transcript, ASSUMED_CONTEXT_MARKERS);
  const complexity = sentenceComplexity(transcript);
  const abstraction = countAbstractionMarkers(transcript);

  return {
    jargonRatePerMinute: round(jargonCount / minutes, 2),
    assumedContextMarkers: assumedContextCount,
    sentenceComplexityIndex: round(complexity, 2),
    abstractionMarkerCount: abstraction,
    ideaDensity: round(computeIdeaDensity(transcript), 2),
    wordPrecisionScore: computeWordPrecisionScore(transcript),
  };
}
