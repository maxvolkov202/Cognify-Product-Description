/**
 * v4.1 grounded per-skill quotes — verbatim validation + "m:ss" marker
 * parsing. Same anti-hallucination contract as strongerVersion: a quote
 * that isn't a (whitespace-collapsed, case-insensitive) transcript
 * substring is dropped, never rendered.
 */
import {
  sanitizeDimensionQuote,
  parseTranscriptMarker,
  parseAndValidate,
  assembleRepScore,
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

console.log(`${passed} passed, 0 failed`);
