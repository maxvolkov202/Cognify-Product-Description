/**
 * Cognify Ch.11 — Thinking Quality text-signal extractor.
 *
 * Pure function over (transcript, words). Produces the measurable
 * Thinking Quality signals named in the DNA spec.
 *
 * Signals:
 *   - claimSupportRate         : fraction (0..1) of declarative claims
 *                                followed within 2 sentences by a
 *                                support marker (because, since,
 *                                specifically, the data, 40%, …)
 *   - counterargumentMarkers   : count of objection / counter-claim
 *                                phrases ("however", "the case
 *                                against", "skeptics would say")
 *   - depthOfAnalysisMarkers   : count of why / so-what / implication
 *                                phrases ("the implication", "this
 *                                means", "the deeper reason")
 *   - intellectualHonestyMarkers: count of calibrated certainty phrases
 *                                ("I'm confident", "I think", "I'd
 *                                guess", "I don't know", "uncertain")
 */

import type { ThinkingQualityTextSignals } from "./types";
import { countLexicon, round, splitSentences, tokenize } from "./_helpers";
import { lookupDocumentFrequency } from "./typical-corpus";

const SUPPORT_MARKERS = [
  "because",
  "since",
  "for example",
  "for instance",
  "specifically",
  "the data",
  "the evidence",
  "research shows",
  "studies show",
  "according to",
  "given that",
  "in fact",
  "in practice",
  "concretely",
  "namely",
  "such as",
  "consider",
  "imagine",
  "look at",
  "the reason is",
  "the proof is",
];

/** Numeric / quantitative markers also count as support — a percentage
 *  or a number is concrete evidence. Detected via regex (digits or
 *  percent signs in the support sentence). */
const NUMBER_RE = /\b(\d+(?:\.\d+)?%?|\$\d+|\d+x)\b/;

const COUNTERARGUMENT_MARKERS = [
  "however",
  "but the case against",
  "the case against",
  "skeptics would say",
  "the objection is",
  "one might argue",
  "the counterargument",
  "on the other hand",
  "to be fair",
  "that said",
  "that being said",
  "the opposing view",
  "critics argue",
  "the pushback would be",
];

const DEPTH_MARKERS = [
  "the implication",
  "the implications",
  "this means",
  "what this means",
  "the deeper reason",
  "the underlying",
  "fundamentally",
  "at root",
  "the root cause",
  "so what this implies",
  "which suggests",
  "which means",
  "so the broader",
  "the bigger picture",
  "the second-order",
  "the consequence is",
];

const HONESTY_MARKERS = [
  "i'm confident",
  "i'm certain",
  "i think",
  "i believe",
  "i'd guess",
  "i would guess",
  "i don't know",
  "i'm not sure",
  "uncertain about",
  "i'm uncertain",
  "to be honest",
  "honestly",
  "i could be wrong",
  "i may be wrong",
  "my best guess",
  "i suspect",
];

/** Heuristic: a sentence is a "claim" if it ends in a period (not
 *  question), starts with a capital, has at least 4 words, and is not
 *  itself a transition / setup phrase. */
function isClaimSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length === 0) return false;
  if (!/[.!]\s*$/.test(trimmed)) return false;
  const wc = trimmed.split(/\s+/).filter(Boolean).length;
  if (wc < 4) return false;
  // Skip sentences that are pure transitions / hedges.
  const lower = trimmed.toLowerCase();
  const setupOnly = [
    "first",
    "second",
    "third",
    "next",
    "then",
    "so",
    "well",
    "okay",
    "alright",
  ];
  for (const s of setupOnly) {
    if (lower === `${s}.` || lower === `${s},`) return false;
  }
  return true;
}

function claimSupportRate(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return 0;
  let claims = 0;
  let supported = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i] ?? "";
    if (!isClaimSentence(sentence)) continue;
    claims++;
    // Support window: this sentence + next 2 sentences.
    const windowEnd = Math.min(sentences.length - 1, i + 2);
    let supportFound = false;
    for (let j = i; j <= windowEnd; j++) {
      const s = sentences[j] ?? "";
      if (countLexicon(s, SUPPORT_MARKERS) > 0 || NUMBER_RE.test(s)) {
        supportFound = true;
        break;
      }
    }
    if (supportFound) supported++;
  }
  if (claims === 0) return 0;
  return supported / claims;
}

/** Ch.S4 — self-correction markers. Speaker contradicts something just
 *  said, signaling confused thinking rather than calibrated uncertainty.
 *  Distinct from the HONESTY_MARKERS list above — those are forward-
 *  looking ("I think", "I don't know"); these are backward-looking
 *  retractions. */
const SELF_CORRECTION_MARKERS = [
  "but actually",
  "wait no",
  "wait actually",
  "scratch that",
  "let me revise",
  "let me restart",
  "i take that back",
  "actually that's wrong",
  "actually that's not right",
  "i misspoke",
  "i was wrong about",
  "no wait",
  "hold on let me",
  "let me back up",
  "let me try that again",
  "or rather",
  "or actually",
  "i should say",
  "i meant to say",
];

/** Ch.S4 — Originality index 0-100. Computes IDF-style rarity over
 *  content tokens. For each content token (lowercase, length ≥3, not
 *  numeric), look up document frequency; the per-token contribution
 *  is `1 - df` (so rare tokens contribute close to 1). Average across
 *  tokens, then rescale to 0-100 with a curve that matches realistic
 *  spoken-rep ranges:
 *    - All boilerplate (avg 0.18 distinctiveness) → ~25 originality
 *    - Mixed (avg 0.4 distinctiveness) → ~60 originality
 *    - Heavy domain-specific (avg 0.65 distinctiveness) → ~85 originality
 *
 *  Empty / micro transcripts return neutral 50. */
function computeOriginalityIndex(transcript: string): number {
  const tokens = tokenize(transcript);
  let total = 0;
  let count = 0;
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (/^\d+$/.test(t)) continue;
    const df = lookupDocumentFrequency(t);
    total += 1 - df;
    count++;
  }
  if (count === 0) return 50;
  const meanDistinctiveness = total / count;
  // Curve: 0.0 → 0, 0.2 → 30, 0.4 → 60, 0.6 → 80, 0.8+ → 92.
  // Linear in [0, 0.2] [0.2, 0.4] [0.4, 0.6] [0.6, 0.8] segments.
  let score: number;
  if (meanDistinctiveness <= 0.2) score = (meanDistinctiveness / 0.2) * 30;
  else if (meanDistinctiveness <= 0.4)
    score = 30 + ((meanDistinctiveness - 0.2) / 0.2) * 30;
  else if (meanDistinctiveness <= 0.6)
    score = 60 + ((meanDistinctiveness - 0.4) / 0.2) * 20;
  else if (meanDistinctiveness <= 0.8)
    score = 80 + ((meanDistinctiveness - 0.6) / 0.2) * 12;
  else score = 92;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function extractThinkingQualitySignals(input: {
  transcript: string;
  durationMs: number;
}): ThinkingQualityTextSignals {
  const { transcript } = input;

  return {
    claimSupportRate: round(claimSupportRate(transcript), 3),
    counterargumentMarkers: countLexicon(transcript, COUNTERARGUMENT_MARKERS),
    depthOfAnalysisMarkers: countLexicon(transcript, DEPTH_MARKERS),
    intellectualHonestyMarkers: countLexicon(transcript, HONESTY_MARKERS),
    originalityIndex: computeOriginalityIndex(transcript),
    logicalConsistencyMarkers: countLexicon(transcript, SELF_CORRECTION_MARKERS),
  };
}
