/**
 * v4.1 grounded per-skill quotes — verbatim validation + "m:ss" marker
 * parsing. Same anti-hallucination contract as strongerVersion: a quote
 * that isn't a (whitespace-collapsed, case-insensitive) transcript
 * substring is dropped, never rendered.
 */
import {
  sanitizeDimensionQuote,
  dropDuplicateMoments,
  parseTranscriptMarker,
  parseAndValidate,
  assembleRepScore,
  applyHybridLayer,
} from "../src/lib/ai/score-shared";

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  // Counted rather than hardcoded: several assertions below run inside
  // per-dimension loops, so a literal total silently drifts.
  passed++;
}

const transcript =
  "So the main thing I keep coming back to is cost.  We tried this last " +
  "quarter and, honestly, it broke at a hundred thousand requests.";

// Marker parsing.
assert(parseTranscriptMarker("0:45") === 45_000, "0:45 → 45000ms");
assert(parseTranscriptMarker("2:05") === 125_000, "2:05 → 125000ms");
assert(parseTranscriptMarker(" 1:00 ") === 60_000, "whitespace tolerated");
assert(parseTranscriptMarker("1:5") === null, "seconds must be two digits");
assert(parseTranscriptMarker("1:75") === null, "seconds must be < 60");
assert(parseTranscriptMarker("45") === null, "bare number rejected");
// The TIMESTAMP INDEX shows markers as `[0:45] "word"`, so a model that
// echoes the form it was shown must not lose tap-to-hear.
assert(parseTranscriptMarker("[0:45]") === 45_000, "bracketed marker parsed");
assert(parseTranscriptMarker(" [2:05] ") === 125_000, "bracketed + padded");
assert(parseTranscriptMarker(null) === null, "null → null");
assert(parseTranscriptMarker(undefined) === null, "undefined → null");

// Verbatim quotes pass and carry a parsed timestamp.
const ok = sanitizeDimensionQuote({
  quote: "it broke at a hundred thousand requests",
  quoteAt: "0:10",
  transcript,
});
assert(ok != null, "verbatim quote passes");
assert(ok.quoteAtMs === 10_000, "marker parsed to ms");

// Whitespace-collapsed + case-insensitive matching (same as strongerVersion).
const loose = sanitizeDimensionQuote({
  quote: "We tried this last quarter",
  quoteAt: null,
  transcript: transcript.toUpperCase(),
});
assert(loose != null, "case-insensitive match passes");
assert(loose.quoteAtMs === null, "no marker → null ms, quote kept");

// Paraphrases are dropped entirely.
assert(
  sanitizeDimensionQuote({
    quote: "it failed at 100k requests",
    quoteAt: "0:10",
    transcript,
  }) === null,
  "paraphrase dropped",
);

// Junk marker doesn't take the quote down with it.
const junkMarker = sanitizeDimensionQuote({
  quote: "cost",
  quoteAt: "not-a-time",
  transcript,
});
assert(junkMarker != null && junkMarker.quoteAtMs === null,
  "junk marker → quote kept, ms null");

// Absent quote → null.
assert(
  sanitizeDimensionQuote({ quote: null, quoteAt: "0:05", transcript }) === null,
  "null quote → null",
);

// ── Assembly-level: an unvalidated quote must never reach a dimension ──
// The verbatim check is only meaningful if the RAW model quote cannot
// ride the object spread onto a DimensionScore. assembleRepScore's
// grounding pass only ever ADDS a validated quote, so anything that
// leaks through parseAndValidate survives every `return d` path — it
// would render in the blockquote as the user's own words and persist.

const REP_TRANSCRIPT =
  "A firewall checks traffic against a set of rules before it reaches you.";
const DIMS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
] as const;

function modelResponse(quote: string): string {
  return JSON.stringify({
    dimensions: DIMS.map((d) => ({
      dimension: d,
      score: 70,
      signals: [],
      feedback: "ok",
      quote,
      quoteAt: "0:03",
    })),
    headline: "headline",
    headlineTone: "blunt",
    nextRepHint: "next time, lead with the point",
    coachFocus: {
      dimension: "clarity",
      behavior: "lead with the point",
      why: "it lands faster",
      action: "say the point first",
    },
  });
}

// A fabricated quote is stripped before it can reach a DimensionScore.
const fabricated = parseAndValidate(
  modelResponse("I INVENTED THIS ENTIRELY"),
  REP_TRANSCRIPT,
);
for (const d of fabricated.sanitizedDimFeedback) {
  const raw = d as Record<string, unknown>;
  assert(raw.quote === undefined, `no raw quote on ${d.dimension}`);
  assert(raw.quoteAt === undefined, `no raw quoteAt on ${d.dimension}`);
}

// ...and it is still absent after assembly (the grounding pass drops it).
const fabricatedScore = assembleRepScore({
  finalDimensions: fabricated.sanitizedDimFeedback,
  dimensionMap: {},
  validated: fabricated.validated,
  input: { transcript: REP_TRANSCRIPT, promptText: "p", durationMs: 30_000 },
  sanitizedCoachFocus: fabricated.sanitizedCoachFocus,
  sanitizedStrongerVersion: fabricated.sanitizedStrongerVersion,
  prosodyFeatures: null,
  signalsFlagOn: false,
  textSignals: null,
  modelUsed: "test",
});
for (const d of fabricatedScore.dimensions) {
  assert(d.quote == null, `fabricated quote dropped on ${d.dimension}`);
}

// A verbatim quote DOES survive assembly, with its marker parsed to ms.
const verbatim = parseAndValidate(
  modelResponse("checks traffic against a set of rules"),
  REP_TRANSCRIPT,
);
const verbatimScore = assembleRepScore({
  finalDimensions: verbatim.sanitizedDimFeedback,
  dimensionMap: {},
  validated: verbatim.validated,
  input: { transcript: REP_TRANSCRIPT, promptText: "p", durationMs: 30_000 },
  sanitizedCoachFocus: verbatim.sanitizedCoachFocus,
  sanitizedStrongerVersion: verbatim.sanitizedStrongerVersion,
  prosodyFeatures: null,
  signalsFlagOn: false,
  textSignals: null,
  modelUsed: "test",
});
const clarity = verbatimScore.dimensions.find((d) => d.dimension === "clarity");
assert(
  clarity?.quote === "checks traffic against a set of rules",
  "verbatim quote survives assembly",
);
assert(clarity?.quoteAtMs === 3_000, "marker parsed to ms on assembly");
// modelResponse() puts the SAME quote on all six dimensions, which is
// exactly the prod symptom QUOTE INDEPENDENCE exists to stop: the first
// dimension in canonical order keeps the moment, the rest render with none.
for (const d of verbatimScore.dimensions.filter((x) => x.dimension !== "clarity")) {
  assert(d.quote == null, `reused moment dropped on ${d.dimension}`);
  assert(d.quoteAtMs == null, `reused moment's marker dropped on ${d.dimension}`);
}
// The scores and feedback are untouched by the drop — only the moment goes.
for (const d of verbatimScore.dimensions) {
  assert(d.feedback === "ok", `feedback survives the dedupe on ${d.dimension}`);
}

// ── The delivery-override guard, exercised through applyHybridLayer ──
// When the deterministic pacing override diverges >10 pts it REPLACES the
// delivery feedback with a generated wpm/filler sentence. A quote the
// model chose to ground its own (now discarded) sentence must not survive
// onto that card. The guard compares rendered vs model feedback
// UNCONDITIONALLY — gating it on the model having written a sentence
// leaves the quote-without-feedback case open, which is the case here.

const SLOW_WORDS = "checks traffic against a set of rules".split(" ").map(
  (word, i) => ({ word, startMs: i * 8_000, endMs: i * 8_000 + 500 }),
);

const overrideResponse = JSON.stringify({
  dimensions: DIMS.map((d) => ({
    dimension: d,
    // Delivery is graded far from what the deterministic scorer returns
    // for these word timings, so the >10pt divergence branch fires.
    score: d === "delivery" ? 30 : 95,
    signals: [],
    // NOTE: delivery deliberately carries a VERBATIM quote and NO
    // feedback — the exact shape the old `raw?.feedback &&` guard let
    // through.
    ...(d === "delivery"
      ? { quote: "checks traffic against a set of rules", quoteAt: "0:03" }
      : d === "clarity"
        ? // The negative control: clarity is NOT touched by the delivery
          // override, so its verbatim quote must SURVIVE. Without this a
          // regression that drops every quote whenever the override fires
          // would leave the suite green.
          {
            feedback: "ok",
            quote: "before it reaches you",
            quoteAt: "0:05",
          }
        : { feedback: "ok" }),
  })),
  headline: "headline",
  headlineTone: "blunt",
  nextRepHint: "next time, lead with the point",
  coachFocus: {
    dimension: "clarity",
    behavior: "lead with the point",
    why: "it lands faster",
    action: "say the point first",
  },
});

const overrideParsed = parseAndValidate(overrideResponse, REP_TRANSCRIPT);
const overrideInput = {
  transcript: REP_TRANSCRIPT,
  promptText: "p",
  durationMs: 60_000,
  words: SLOW_WORDS,
};
const hybrid = applyHybridLayer({
  dims: overrideParsed.sanitizedDimFeedback,
  input: overrideInput,
  config: { deliveryMode: "deterministic" as const, thinkingMode: "blend" as const },
});
const overrideScore = assembleRepScore({
  finalDimensions: hybrid.finalDimensions,
  dimensionMap: hybrid.dimensionMap,
  validated: overrideParsed.validated,
  input: overrideInput,
  sanitizedCoachFocus: overrideParsed.sanitizedCoachFocus,
  sanitizedStrongerVersion: overrideParsed.sanitizedStrongerVersion,
  prosodyFeatures: null,
  signalsFlagOn: false,
  textSignals: null,
  modelUsed: "test",
});
const deliveryDim = overrideScore.dimensions.find(
  (d) => d.dimension === "delivery",
);
// Guard the premise: if the override stopped diverging this test would
// pass for the wrong reason.
assert(
  deliveryDim != null && deliveryDim.score !== 30,
  "premise: deterministic delivery override replaced the model score",
);
assert(
  deliveryDim?.feedback != null,
  "premise: override injected a generated delivery sentence",
);
assert(
  deliveryDim?.quote == null,
  "quote dropped when the override replaced the delivery sentence",
);
// A dimension the override never touched keeps its verbatim quote.
const untouched = overrideScore.dimensions.find((d) => d.dimension === "clarity");
assert(
  untouched?.quote === "before it reaches you",
  "untouched dimension keeps its verbatim quote while delivery loses its own",
);
assert(untouched?.quoteAtMs === 5_000, "untouched dimension keeps its marker");

// ── QUOTE INDEPENDENCE — dropDuplicateMoments in isolation ──
// With six dimensions over one short transcript the model reliably grounds
// several skills on one phrase; the same sentence quoted back under four
// skill cards reads as broken. First in canonical order claims the moment.

const distinct = dropDuplicateMoments([
  { dimension: "clarity", quote: "the main thing I keep coming back to is cost" },
  { dimension: "structure", quote: "We tried this last quarter" },
  { dimension: "tone", quote: null },
]);
assert(distinct[0]!.quote != null, "distinct moment 1 kept");
assert(distinct[1]!.quote != null, "distinct moment 2 kept");
assert(distinct[2]!.quote == null, "null quote stays null");

// Exact reuse: later dimensions lose the moment.
const exact = dropDuplicateMoments([
  { dimension: "clarity", quote: "it broke at a hundred thousand requests" },
  { dimension: "structure", quote: "it broke at a hundred thousand requests" },
  { dimension: "conciseness", quote: "it broke at a hundred thousand requests" },
]);
assert(exact[0]!.quote != null, "first claim of an exact-reused moment kept");
assert(exact[1]!.quote === undefined, "second exact reuse dropped");
assert(exact[2]!.quote === undefined, "third exact reuse dropped");

// Containment in BOTH directions counts as the same moment — a re-quote
// that trims or extends the span is still the same phrase on screen.
const extended = dropDuplicateMoments([
  { dimension: "clarity", quote: "it broke at a hundred thousand" },
  { dimension: "structure", quote: "it broke at a hundred thousand requests" },
]);
assert(extended[1]!.quote === undefined, "extended span is the same moment");
const trimmed = dropDuplicateMoments([
  { dimension: "clarity", quote: "it broke at a hundred thousand requests" },
  { dimension: "structure", quote: "a hundred thousand requests" },
]);
assert(trimmed[1]!.quote === undefined, "trimmed span is the same moment");

// Normalization matches sanitizeDimensionQuote's (whitespace-collapsed,
// case-insensitive), so casing/spacing games don't sneak a duplicate past.
const noisy = dropDuplicateMoments([
  { dimension: "clarity", quote: "We tried this last quarter" },
  { dimension: "structure", quote: "we   TRIED this  last quarter" },
]);
assert(noisy[1]!.quote === undefined, "case/whitespace variants are one moment");

// The dropped dimension loses quoteAtMs too — a marker with no quote
// would render a seek button pointing at nothing.
const withMs = dropDuplicateMoments([
  { dimension: "clarity", quote: "cost", quoteAtMs: 1_000 },
  { dimension: "structure", quote: "cost", quoteAtMs: 2_000 },
]);
assert(
  withMs[1]!.quote === undefined && withMs[1]!.quoteAtMs === undefined,
  "duplicate drops both quote and quoteAtMs",
);

// ── Distinct moments all survive assembly ──
// The negative control for the dedupe: a model that obeys QUOTE
// INDEPENDENCE must keep every one of its quotes.
const DISTINCT_TRANSCRIPT =
  "A firewall checks traffic against a set of rules before it reaches you. " +
  "It is basically a bouncer at the door, and it never gets tired.";
const distinctResponse = JSON.stringify({
  dimensions: [
    ["clarity", "checks traffic against a set of rules"],
    ["structure", "before it reaches you"],
    ["conciseness", "basically a bouncer at the door"],
    ["thinking_quality", "it never gets tired"],
    ["delivery", null],
    ["tone", null],
  ].map(([d, q]) => ({
    dimension: d,
    score: 70,
    signals: [],
    feedback: "ok",
    quote: q,
    quoteAt: "0:03",
  })),
  headline: "headline",
  headlineTone: "blunt",
  nextRepHint: "next time, lead with the point",
  coachFocus: {
    dimension: "clarity",
    behavior: "lead with the point",
    why: "it lands faster",
    action: "say the point first",
  },
});
const distinctParsed = parseAndValidate(distinctResponse, DISTINCT_TRANSCRIPT);
const distinctScore = assembleRepScore({
  finalDimensions: distinctParsed.sanitizedDimFeedback,
  dimensionMap: {},
  validated: distinctParsed.validated,
  input: { transcript: DISTINCT_TRANSCRIPT, promptText: "p", durationMs: 30_000 },
  sanitizedCoachFocus: distinctParsed.sanitizedCoachFocus,
  sanitizedStrongerVersion: distinctParsed.sanitizedStrongerVersion,
  prosodyFeatures: null,
  signalsFlagOn: false,
  textSignals: null,
  modelUsed: "test",
});
for (const dim of ["clarity", "structure", "conciseness", "thinking_quality"]) {
  const found = distinctScore.dimensions.find((d) => d.dimension === dim);
  assert(found?.quote != null, `distinct moment kept on ${dim}`);
}
assert(
  new Set(
    distinctScore.dimensions.map((d) => d.quote).filter(Boolean),
  ).size === 4,
  "four distinct moments, four distinct quotes",
);

// ── Phrase-length cap on dimensions[].quote ──
// Six paragraph-length quotes eat decode headroom against max_tokens 2500;
// a truncated response fails the JSON parse and lands on mock-fallback-v1,
// which skips the feedback doc AND the progress snapshots. The prompt asks
// for <=200 chars; the schema backstops at 400 with `.catch(null)`, so an
// over-cap quote drops to null instead of failing the whole parse.
const LONG_TRANSCRIPT = "word ".repeat(200).trim();
const overCap = LONG_TRANSCRIPT.slice(0, 500);
assert(overCap.length > 400, "premise: the test quote exceeds the schema cap");
const cappedParsed = parseAndValidate(
  JSON.stringify({
    dimensions: DIMS.map((d) => ({
      dimension: d,
      score: 70,
      signals: [],
      feedback: "ok",
      // Verbatim, so ONLY the length can drop it.
      quote: overCap,
      quoteAt: "0:03",
    })),
    headline: "headline",
    headlineTone: "blunt",
    nextRepHint: "next time, lead with the point",
    coachFocus: {
      dimension: "clarity",
      behavior: "lead with the point",
      why: "it lands faster",
      action: "say the point first",
    },
  }),
  LONG_TRANSCRIPT,
);
assert(
  cappedParsed.validated.dimensions.every((d) => d.quote == null),
  "over-cap quote coerced to null rather than failing the parse",
);
assert(
  cappedParsed.validated.dimensions.every((d) => d.score === 70),
  "the rest of the dimension survives an over-cap quote",
);
// An at-cap quote still passes.
const atCap = LONG_TRANSCRIPT.slice(0, 380);
const atCapParsed = parseAndValidate(
  JSON.stringify({
    dimensions: DIMS.map((d) => ({
      dimension: d,
      score: 70,
      signals: [],
      feedback: "ok",
      quote: d === "clarity" ? atCap : null,
      quoteAt: "0:03",
    })),
    headline: "headline",
    headlineTone: "blunt",
    nextRepHint: "next time, lead with the point",
    coachFocus: {
      dimension: "clarity",
      behavior: "lead with the point",
      why: "it lands faster",
      action: "say the point first",
    },
  }),
  LONG_TRANSCRIPT,
);
assert(
  atCapParsed.validated.dimensions.find((d) => d.dimension === "clarity")
    ?.quote === atCap,
  "a quote under the 400-char backstop survives the parse",
);

// ── Regression: claim order is CANONICAL, not model emission order ──
// `validated.dimensions` arrives in raw model emission order — nothing
// between the parse and the dedupe sorts it. On a provider or fallback that
// emits `tone` first, trusting array order would hand the worded moment to
// the dimension supposed to have one LEAST often and strip it from the
// clarity card whose feedback sentence is about that very phrase.
const emittedToneFirst = dropDuplicateMoments([
  { dimension: "tone", quote: "Firewall is basically a security guard" },
  { dimension: "clarity", quote: "Firewall is basically a security guard" },
]);
assert(
  emittedToneFirst[0]!.quote === undefined,
  "tone loses the moment even when the model emitted it first",
);
assert(
  emittedToneFirst[1]!.quote === "Firewall is basically a security guard",
  "clarity claims the moment by canonical order, not array position",
);
// Output keeps INPUT order — only the claim walk is canonical.
assert(
  emittedToneFirst[0]!.dimension === "tone" &&
    emittedToneFirst[1]!.dimension === "clarity",
  "input order is preserved in the output",
);

// ── Regression: a short quote must not swallow unrelated longer ones ──
// The prompt invites short delivery/tone quotes (a filler cluster). With
// bare-substring containment, "um" is inside "n(um)ber" and "ass(um)ptions",
// so one filler quote stripped every other dimension's moment — the exact
// opposite of what this guard is for. Containment now compares whole tokens
// AND only applies once the shorter span is >= MIN_CONTAINMENT_TOKENS.
const filler = dropDuplicateMoments([
  { dimension: "delivery", quote: "um" },
  { dimension: "clarity", quote: "the number of requests" },
  { dimension: "structure", quote: "our assumptions were wrong" },
]);
assert(filler[0]!.quote === "um", "the short filler quote itself is kept");
assert(
  filler[1]!.quote === "the number of requests",
  "'um' does not swallow 'number'",
);
assert(
  filler[2]!.quote === "our assumptions were wrong",
  "'um' does not swallow 'assumptions'",
);
// A short quote is still deduped against an EXACT repeat of itself.
const shortExact = dropDuplicateMoments([
  { dimension: "clarity", quote: "um" },
  { dimension: "tone", quote: "um" },
]);
assert(
  shortExact[1]!.quote === undefined,
  "literal reuse of a short quote is still caught by exact match",
);
// Sub-token overlap between two SHORT quotes is not a duplicate either.
const shortDistinct = dropDuplicateMoments([
  { dimension: "clarity", quote: "you know" },
  { dimension: "tone", quote: "know" },
]);
assert(
  shortDistinct[1]!.quote === "know",
  "short spans below the containment floor need an exact match to dedupe",
);

// Punctuation must not hide a duplicate: the dedupe normalizer flattens it,
// unlike the strict verbatim normalizer behind sanitizeDimensionQuote.
const punct = dropDuplicateMoments([
  { dimension: "clarity", quote: "Is this thing on." },
  { dimension: "structure", quote: "is this thing on" },
]);
assert(
  punct[1]!.quote === undefined,
  "trailing punctuation does not hide a duplicate moment",
);

console.log(`${passed} passed, 0 failed`);
