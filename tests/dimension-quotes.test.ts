/**
 * v4.1 grounded per-skill quotes — verbatim validation + "m:ss" marker
 * parsing. Same anti-hallucination contract as strongerVersion: a quote
 * that isn't a (whitespace-collapsed, case-insensitive) transcript
 * substring is dropped, never rendered.
 */
import {
  sanitizeDimensionQuote,
  parseTranscriptMarker,
} from "../src/lib/ai/score-shared";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

console.log("17 passed, 0 failed");
