/**
 * Cognify Ch.11 — Text-derived signal types.
 *
 * The four LLM-scored content dimensions (clarity, structure, conciseness,
 * thinking_quality) each have a typed signal bundle of the measurable
 * features the DNA spec named. These bundles are computed by pure
 * functions over the rep transcript + word timings and rendered into the
 * scoring prompt's SIGNALS block — Claude scores AGAINST the numbers
 * rather than re-deriving them holistically.
 *
 * Audio/prosody signals (the older deterministic layer that drives
 * delivery + thinking_quality blends) live in `./audio.ts` under
 * `SignalBundle` / `WordTiming` and are re-exported from `./index.ts` for
 * backward compatibility with existing consumers.
 */

export type ClarityTextSignals = {
  /** Per-minute count of "long words (≥10 chars), all-caps acronyms, or
   *  vocabulary outside the top-3000 frequency list." Higher = more
   *  jargony / more cognitive lift on the listener. Target <1/min. */
  jargonRatePerMinute: number;
  /** Count of phrases that assume the listener already shares context:
   *  "as you know", "obviously", "clearly", "the X" with no prior
   *  referent. Target 0–1 per response. */
  assumedContextMarkers: number;
  /** Average count of subordinating-conjunctions + commas per sentence —
   *  proxy for syntactic complexity. Target <2.0 clauses/sentence. */
  sentenceComplexityIndex: number;
  /** Count of abstract nouns (-tion / -ment / -ity / -ness) that appear
   *  WITHOUT a concrete example within ±1 sentence. Higher = abstract
   *  language without grounding. */
  abstractionMarkerCount: number;
  /** Ch.S1 — Distinct content nouns per sentence. Lemmatized count of
   *  ≥2-char non-stopword tokens divided by sentence count. High =
   *  many ideas crammed per sentence (low idea isolation); low = ideas
   *  isolated cleanly. DNA target: <2.5. */
  ideaDensity: number;
  /** Ch.S1 — Word precision score 0-100 derived from average lexical
   *  concreteness against `concreteness-words.ts` (Brysbaert subset).
   *  Higher = concrete vocabulary; lower = abstract vocabulary.
   *  DNA target: ≥3.5 on the underlying 1-5 scale (≥62 here). */
  wordPrecisionScore: number;
};

export type StructureTextSignals = {
  /** Count of explicit transition markers ("first", "second", "however",
   *  "therefore", "in summary", etc.). Target ≥3 for a 60s response. */
  transitionMarkerCount: number;
  /** transitionMarkerCount / minutes — normalized for response length. */
  transitionMarkerRate: number;
  /** Does the FIRST 15% of words contain a declarative claim
   *  (subject-verb-object) instead of pure setup language? 0..100 score
   *  — 100 means clear opening claim, 0 means meandering setup. */
  openingPositionScore: number;
  /** Count of explicit hierarchy / numbering markers ("primary",
   *  "supporting", "main point", "the headline is", etc.). Higher = more
   *  visible scaffolding. */
  pointHierarchyMarkers: number;
  /** Boolean trio detected positionally + via content heuristics. */
  arcCompletion: {
    /** First 20% has either a question, a thesis, or a directional
     *  claim. */
    clearOpening: boolean;
    /** Middle 60% has at least 2 transition markers OR explicit
     *  hierarchy markers (so the body actually develops). */
    developedMiddle: boolean;
    /** Final 15% has either a closing transition ("in summary", "to
     *  close", "the bottom line"), a declarative summary, or a
     *  conviction-tone ending sentence. */
    definitiveClose: boolean;
  };
  /** Ch.S2 — Logical flow score 0-100. Combines two evidence streams:
   *  (a) cross-sentence connector density — sentences whose first ~5
   *  tokens contain a flow connector ("because", "therefore", "this
   *  means", "building on that", "since", "as a result", "so").
   *  (b) topic continuity — fraction of adjacent-sentence pairs sharing
   *  ≥1 content noun (3-gram lite, lemmatized via S1's stemmer).
   *  High = each sentence flows from the previous; low = topic jumps. */
  logicalFlowScore: number;
  /** Ch.S2 — Coherence index 0-100. Of all sentences after the first
   *  30% of the response, what fraction reference at least one content
   *  noun introduced in the first 30%? High = response stays on the
   *  topic it announces; low = response drifts into unrelated material. */
  coherenceIndex: number;
};

export type ConcisenessTextSignals = {
  /** Per-minute count of hedge phrases ("kind of", "sort of", "I think",
   *  "maybe", "just", "a little bit", "I guess", "probably"). Target
   *  <1/min. */
  hedgeRatePerMinute: number;
  /** 3-gram overlap fraction across sentences — proxy for "I'm restating
   *  the same idea." 0 = no repetition, 1 = total repetition. Target
   *  <0.20. */
  repetitionScore: number;
  /** totalWords / distinctContentNouns — proxy for words-per-idea. Higher
   *  = more padding. Target <25. */
  wordsPerDistinctIdea: number;
};

export type ThinkingQualityTextSignals = {
  /** Fraction (0..1) of declarative claim sentences that are followed
   *  within 2 sentences by a support marker ("because", "since", "for
   *  example", "specifically", "the data", "40%", etc.). Target >0.7. */
  claimSupportRate: number;
  /** Count of counterargument/objection markers ("however", "but the
   *  case against", "skeptics would say", "the objection is"). */
  counterargumentMarkers: number;
  /** Count of depth-of-analysis markers ("why", "so what", "the
   *  implication", "this means", "the deeper reason"). */
  depthOfAnalysisMarkers: number;
  /** Count of intellectual-honesty markers — calibrated certainty
   *  phrases ("I'm confident", "I think", "I'd guess", "I don't know",
   *  "uncertain about"). */
  intellectualHonestyMarkers: number;
};

/**
 * Composed bundle returned by `extractAllTextSignals()`. Mirrors the four
 * LLM-scored content dimensions; rendered into the scoring prompt as the
 * SIGNALS block.
 */
export type TextSignals = {
  clarity: ClarityTextSignals;
  structure: StructureTextSignals;
  conciseness: ConcisenessTextSignals;
  thinking_quality: ThinkingQualityTextSignals;
  /** Word count and minutes — useful for callers (e.g. the SIGNALS block
   *  renderer) that want to label "X /min" rates. */
  meta: {
    wordCount: number;
    durationMs: number;
    durationMinutes: number;
  };
};
