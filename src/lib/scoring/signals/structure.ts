/**
 * Cognify Ch.11 — Structure text-signal extractor.
 *
 * Pure function over (transcript, words). Produces the measurable
 * Structure signals named in the DNA spec.
 *
 * Signals:
 *   - transitionMarkerCount  : count of explicit transition words
 *                              (first, second, however, therefore, …)
 *   - transitionMarkerRate   : transitions per minute
 *   - openingPositionScore   : 0..100 — does the first 15% of words
 *                              contain a declarative claim (subject-
 *                              verb-object) vs setup language?
 *   - pointHierarchyMarkers  : count of "primary", "supporting", "main
 *                              point", "the headline is", …
 *   - arcCompletion          : trio of booleans (clearOpening,
 *                              developedMiddle, definitiveClose)
 */

import type { StructureTextSignals } from "./types";
import {
  countLexicon,
  durationToMinutes,
  round,
  splitSentences,
  tokenize,
} from "./_helpers";

const TRANSITION_MARKERS = [
  "first",
  "firstly",
  "second",
  "secondly",
  "third",
  "thirdly",
  "next",
  "then",
  "finally",
  "lastly",
  "because",
  "therefore",
  "however",
  "but",
  "meanwhile",
  "furthermore",
  "moreover",
  "additionally",
  "in addition",
  "on the other hand",
  "in contrast",
  "as a result",
  "consequently",
  "what this means is",
  "building on that",
  "in summary",
  "to summarize",
  "to close",
  "in conclusion",
  "to sum up",
  "the bottom line",
  "the headline is",
  "so",
  "so the point is",
];

const HIERARCHY_MARKERS = [
  "the main point",
  "the primary",
  "the headline is",
  "the bottom line",
  "the takeaway",
  "the key point",
  "the central idea",
  "supporting that",
  "supporting point",
  "the implication",
  "specifically",
  "in particular",
  "more concretely",
  "first reason",
  "second reason",
  "third reason",
  "main reason",
  "primary reason",
];

/** Closing-tone phrases that indicate a definitive close in the final
 *  segment of the response. */
const CLOSING_PHRASES = [
  "in summary",
  "to summarize",
  "to close",
  "in conclusion",
  "to sum up",
  "the bottom line",
  "the takeaway",
  "the answer is",
  "that's why",
  "so in short",
  "in short",
  "what this means",
  "the headline is",
  "to wrap up",
];

/** Opening-tone markers that indicate an explicit thesis/claim statement
 *  in the first segment. Used by the openingPositionScore + clearOpening
 *  arc check. */
const OPENING_THESIS_MARKERS = [
  "the answer is",
  "i would argue",
  "my view is",
  "the key thing",
  "the main point",
  "what i think is",
  "the question is",
  "the issue is",
  "the bottom line is",
  "first off",
  "to start with",
  "the headline is",
];

/** Score 0..100 for whether the FIRST 15% of words contains a
 *  declarative claim vs setup language. Heuristic, layered:
 *    + 50 if at least one OPENING_THESIS_MARKER appears in first 15%
 *    + 25 if first sentence is ≤25 words AND ends with a period/question
 *    + 25 if first 15% contains a verb (proxy for SVO; no parser, so
 *          simple verb-list match)
 *    - 30 if first 15% is dominated by hedge words ("kind of", "sort of",
 *          "I think", "maybe") — those signal indirect / setup speech
 *  Floor 0, ceil 100. */
const HEDGE_OPENERS = ["kind of", "sort of", "i think", "i guess", "maybe", "well"];
const SETUP_OPENERS = [
  "so",
  "well",
  "um",
  "uh",
  "you know",
  "alright",
  "okay",
  "let me",
  "i'm going to",
  "i'll",
  "i wanted to",
  "i was going to",
];
/** Common verbs — proxy for "first 15% has SVO structure." Conservative
 *  list of action/state verbs likely to appear in a thesis sentence. */
const COMMON_VERBS = new Set([
  "is", "are", "was", "were", "be", "been", "being",
  "has", "have", "had",
  "does", "do", "did",
  "means", "signifies", "indicates", "shows", "proves", "argues",
  "states", "claims", "asserts", "thinks", "believes", "wants",
  "needs", "requires", "matters", "suggests", "demonstrates",
  "creates", "builds", "destroys", "improves", "reduces", "increases",
  "leads", "drives", "causes", "explains", "answers",
]);

function openingPositionScore(transcript: string): number {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return 0;
  const cutoff = Math.max(3, Math.floor(tokens.length * 0.15));
  const opening = tokens.slice(0, cutoff).join(" ");
  const sentences = splitSentences(transcript);
  const firstSentence = sentences[0] ?? "";

  let score = 0;
  if (countLexicon(opening, OPENING_THESIS_MARKERS) > 0) score += 50;
  if (
    firstSentence.length > 0 &&
    firstSentence.split(/\s+/).filter(Boolean).length <= 25 &&
    /[.?!]\s*$/.test(firstSentence)
  ) {
    score += 25;
  }
  for (const t of tokens.slice(0, cutoff)) {
    if (COMMON_VERBS.has(t)) {
      score += 25;
      break;
    }
  }
  // Penalty for hedge / setup-only opening.
  const hedgeCount = countLexicon(opening, HEDGE_OPENERS);
  const setupCount = countLexicon(opening, SETUP_OPENERS);
  if (hedgeCount + setupCount >= 2) score -= 30;

  return Math.max(0, Math.min(100, score));
}

/** clearOpening: first 20% of transcript has either an opening thesis
 *  marker, or first sentence is a short declarative ending in period. */
function detectClearOpening(transcript: string): boolean {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return false;
  const cutoff = Math.max(3, Math.floor(tokens.length * 0.2));
  const opening = tokens.slice(0, cutoff).join(" ");
  if (countLexicon(opening, OPENING_THESIS_MARKERS) > 0) return true;
  const firstSentence = splitSentences(transcript)[0] ?? "";
  const wc = firstSentence.split(/\s+/).filter(Boolean).length;
  return wc > 2 && wc <= 25 && /[.?!]\s*$/.test(firstSentence);
}

/** developedMiddle: middle 60% has at least 2 transition markers OR
 *  ≥1 hierarchy marker. */
function detectDevelopedMiddle(transcript: string): boolean {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return false;
  const start = Math.floor(tokens.length * 0.2);
  const end = Math.floor(tokens.length * 0.8);
  const middle = tokens.slice(start, end).join(" ");
  const transitions = countLexicon(middle, TRANSITION_MARKERS);
  const hierarchy = countLexicon(middle, HIERARCHY_MARKERS);
  return transitions >= 2 || hierarchy >= 1;
}

/** definitiveClose: final 15% contains a closing phrase OR final
 *  sentence is a declarative ≥4 words ending with a period (not "?"). */
function detectDefinitiveClose(transcript: string): boolean {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return false;
  const start = Math.floor(tokens.length * 0.85);
  const closing = tokens.slice(start).join(" ");
  if (countLexicon(closing, CLOSING_PHRASES) > 0) return true;
  const sentences = splitSentences(transcript);
  const last = sentences[sentences.length - 1] ?? "";
  const wc = last.split(/\s+/).filter(Boolean).length;
  return wc >= 4 && /\.\s*$/.test(last);
}

/** Ch.S2 — Cross-sentence flow connectors. Phrases that, when they
 *  appear at sentence start, signal that the sentence builds on the
 *  prior one. Conservative list — broader transition markers go in
 *  TRANSITION_MARKERS (those count regardless of position). */
const FLOW_CONNECTOR_PROMPTS = [
  "because",
  "therefore",
  "this means",
  "this shows",
  "this implies",
  "building on that",
  "since",
  "as a result",
  "consequently",
  "so the",
  "which means",
  "what this means",
  "given that",
  "for that reason",
];

/** Stopwords for content-noun extraction in topic-continuity checking.
 *  Same shape as S1's STOPWORDS but inlined here to keep structure.ts
 *  free of cross-extractor coupling. */
const STRUCTURE_STOPWORDS: ReadonlySet<string> = new Set([
  "a","an","the","of","in","on","at","to","from","for","by","with","without",
  "about","as","into","over","under","this","that","these","those",
  "is","are","was","were","be","been","being","am","do","does","did",
  "have","has","had","will","would","should","could","can","may","might",
  "must","i","me","my","mine","we","us","our","ours","you","your","yours",
  "he","him","his","she","her","hers","it","its","they","them","their",
  "what","which","who","whom","whose","where","when","why","how",
  "if","then","than","so","very","just","only","also","yes","no","not",
  "yeah","ok","okay","um","uh","like","really","kind","sort","much",
  "many","more","most","some","any","all","each","every","few","such",
  "own","same","other","another","here","there","now","because","but",
  "and","or","therefore","however","since","while","whereas","although",
]);

/** Conservative content-noun stem: lowercase, strip trailing -s/-es/-ing.
 *  Used to compare across-sentence content overlap. */
function stemForFlow(token: string): string {
  const t = token.toLowerCase();
  if (t.length <= 3) return t;
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  if (t.endsWith("ing") && t.length > 5) return t.slice(0, -3);
  return t;
}

function contentNounsOf(sentence: string): Set<string> {
  const out = new Set<string>();
  for (const tok of tokenize(sentence)) {
    if (tok.length < 3) continue;
    if (/^\d+$/.test(tok)) continue;
    if (STRUCTURE_STOPWORDS.has(tok)) continue;
    out.add(stemForFlow(tok));
  }
  return out;
}

/** Ch.S2 — logicalFlowScore 0-100. Two equally-weighted halves:
 *  (a) connector-start ratio: of all sentences after the first, what
 *  fraction begin with a FLOW_CONNECTOR phrase in their first ~5 tokens?
 *  (b) topic-continuity ratio: of adjacent-sentence pairs, what fraction
 *  share ≥1 content noun (stemmed)?
 *  High = sentences flow from each other; low = topic jumps. */
function computeLogicalFlowScore(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length < 2) return 50;

  // (a) Connector-at-start ratio.
  let connectorStarts = 0;
  for (let i = 1; i < sentences.length; i++) {
    const sent = sentences[i] ?? "";
    const head = sent.toLowerCase().split(/\s+/).slice(0, 5).join(" ");
    if (countLexicon(head, FLOW_CONNECTOR_PROMPTS) > 0) connectorStarts++;
  }
  const connectorRatio = connectorStarts / (sentences.length - 1);

  // (b) Adjacent-sentence content overlap ratio.
  let overlapping = 0;
  let prevContent = contentNounsOf(sentences[0] ?? "");
  for (let i = 1; i < sentences.length; i++) {
    const cur = contentNounsOf(sentences[i] ?? "");
    let hit = false;
    for (const t of cur) {
      if (prevContent.has(t)) {
        hit = true;
        break;
      }
    }
    if (hit) overlapping++;
    prevContent = cur;
  }
  const overlapRatio = overlapping / (sentences.length - 1);

  // Composite: weight overlap slightly more (it's the structural
  // backbone; connectors are the surface signal).
  const composite = 0.4 * connectorRatio + 0.6 * overlapRatio;
  return Math.round(composite * 100);
}

/** Ch.S2 — coherenceIndex 0-100. Builds a "topic vocabulary" from
 *  content nouns in the first 30% of the response, then checks what
 *  fraction of post-30% sentences reference ≥1 of those nouns. High =
 *  response stays on its announced topic; low = drift / fragmentation. */
function computeCoherenceIndex(transcript: string): number {
  const sentences = splitSentences(transcript);
  if (sentences.length < 2) return 50;
  const headCount = Math.max(1, Math.floor(sentences.length * 0.3));
  const topicVocab = new Set<string>();
  for (let i = 0; i < headCount; i++) {
    for (const t of contentNounsOf(sentences[i] ?? "")) {
      topicVocab.add(t);
    }
  }
  if (topicVocab.size === 0) return 50;
  const tail = sentences.slice(headCount);
  if (tail.length === 0) return 100;
  let onTopic = 0;
  for (const sent of tail) {
    for (const t of contentNounsOf(sent)) {
      if (topicVocab.has(t)) {
        onTopic++;
        break;
      }
    }
  }
  return Math.round((onTopic / tail.length) * 100);
}

export function extractStructureSignals(input: {
  transcript: string;
  durationMs: number;
}): StructureTextSignals {
  const { transcript, durationMs } = input;
  const minutes = durationToMinutes(durationMs);

  const transitionCount = countLexicon(transcript, TRANSITION_MARKERS);
  const hierarchyCount = countLexicon(transcript, HIERARCHY_MARKERS);
  const opening = openingPositionScore(transcript);

  return {
    transitionMarkerCount: transitionCount,
    transitionMarkerRate: round(transitionCount / minutes, 2),
    openingPositionScore: opening,
    pointHierarchyMarkers: hierarchyCount,
    arcCompletion: {
      clearOpening: detectClearOpening(transcript),
      developedMiddle: detectDevelopedMiddle(transcript),
      definitiveClose: detectDefinitiveClose(transcript),
    },
    logicalFlowScore: computeLogicalFlowScore(transcript),
    coherenceIndex: computeCoherenceIndex(transcript),
  };
}
