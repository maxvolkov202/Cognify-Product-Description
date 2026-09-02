/**
 * Prosody v2 (plan P2) — scoring-time alignment of worker segmentTails with
 * Deepgram punctuated statement ends, plus the cache featureVersion guard
 * (P1 revert-correctness: env flip alone must not keep serving v2 features).
 */
import {
  statementEndsFromWords,
  alignSegmentTails,
  withAlignedTailRatios,
  ALIGN_TOLERANCE_MS,
} from "../src/lib/audio/prosody-align";
import { featureVersionAllowed } from "../src/lib/audio/prosody-cache";
import type { ProsodyFeatures } from "../src/lib/audio/prosody";

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed++;
}
const approx = (a: number | null | undefined, b: number) =>
  a != null && Math.abs(a - b) < 1e-9;

// ——— statementEndsFromWords ————————————————————————————————
{
  const ends = statementEndsFromWords([
    { word: "Hello", endMs: 400 },
    { word: "world.", endMs: 900 },
    { word: "Really?", endMs: 1800 },
    { word: "Yes!", endMs: 2500 },
    { word: 'quote."', endMs: 3300 },
    { word: "Trailing", endMs: 4000 },
  ]);
  assert(ends.length === 4, "four terminal-punctuation words found");
  assert(ends[0]!.endMs === 900 && !ends[0]!.isQuestion, "period = declarative");
  assert(ends[1]!.endMs === 1800 && ends[1]!.isQuestion, "question mark flagged");
  assert(!ends[2]!.isQuestion, "exclamation = declarative");
  assert(ends[3]!.endMs === 3300, "closing quote after period still terminal");
  assert(statementEndsFromWords([]).length === 0, "empty words = no ends");
  assert(statementEndsFromWords(null).length === 0, "null words = no ends");
}
{
  // Abbreviations and mid-sentence periods must NOT count as statement ends.
  const ends = statementEndsFromWords([
    { word: "Dr.", endMs: 300 },
    { word: "Smith", endMs: 600 },
    { word: "from", endMs: 800 },
    { word: "Acme", endMs: 1000 },
    { word: "Inc.", endMs: 1200 },
    { word: "arrived.", endMs: 1600 },
    { word: "The", endMs: 1900 },
    { word: "U.S.", endMs: 2200 },
    { word: "economy", endMs: 2600 },
    { word: "grew.", endMs: 3000 },
  ]);
  assert(ends.length === 2, "only the two real sentence ends survive");
  assert(ends[0]!.endMs === 1600 && ends[1]!.endMs === 3000, "abbreviation periods skipped (Dr., Inc., U.S.)");
  // Lowercase continuation after a period = not a boundary (Deepgram capitalizes sentence starts).
  const lc = statementEndsFromWords([
    { word: "etc.", endMs: 500 },
    { word: "and", endMs: 700 },
    { word: "more.", endMs: 1000 },
  ]);
  assert(lc.length === 1 && lc[0]!.endMs === 1000, "period followed by lowercase word is mid-sentence");
}
{
  // Distance-greedy matching: an earlier declarative must not steal the tail
  // that sits ON a later question (theft scenario from the Phase 2 review).
  // With one rising tail exactly at the question's end, the question claims it
  // (distance 0 beats the declarative's 100), no declarative aligns, and the
  // result is null — NOT upspeakRatioAligned = 1.0 on upspeak-free audio.
  const stolen = alignSegmentTails(
    [{ endMs: 1000, tailSlopeHzPerSec: 200 }],
    [
      { endMs: 900, isQuestion: false },
      { endMs: 1000, isQuestion: true },
    ],
  );
  assert(stolen === null, "question claims its own rising tail; no false upspeak");
  // With a tail for each, both align and only the declarative counts.
  const both = alignSegmentTails(
    [
      { endMs: 880, tailSlopeHzPerSec: -100 },
      { endMs: 1950, tailSlopeHzPerSec: -120 },
      { endMs: 3000, tailSlopeHzPerSec: 200 },
    ],
    [
      { endMs: 900, isQuestion: false },
      { endMs: 2000, isQuestion: false },
      { endMs: 3000, isQuestion: true },
    ],
  );
  assert(both != null && both!.alignedCount === 3 && both!.declarativeCount === 2, "each end claims its nearest tail");
  assert(approx(both!.upspeakRatioAligned, 0) && approx(both!.finalFallRatioAligned, 1), "declaratives fall; question's rise excluded");
}

// ——— alignSegmentTails ————————————————————————————————————
{
  // Two declaratives (one rising = upspeak, one falling) + one question (rising, excluded).
  const tails = [
    { endMs: 1000, tailSlopeHzPerSec: 120 },   // near decl end 900 → rising
    { endMs: 2100, tailSlopeHzPerSec: 200 },   // near question end 1800 → excluded (wait: 300 > tol? no, tol 400)
    { endMs: 3400, tailSlopeHzPerSec: -150 },  // near decl end 3300 → falling
  ];
  const ends = [
    { endMs: 900, isQuestion: false },
    { endMs: 1800, isQuestion: true },
    { endMs: 3300, isQuestion: false },
  ];
  const r = alignSegmentTails(tails, ends);
  assert(r != null, "alignment produced");
  assert(r!.statementCount === 3 && r!.alignedCount === 3, "all three ends aligned");
  assert(r!.declarativeCount === 2, "question excluded from declaratives");
  assert(approx(r!.upspeakRatioAligned, 0.5), "1 of 2 declaratives rises");
  assert(approx(r!.finalFallRatioAligned, 0.5), "1 of 2 declaratives falls");
}
{
  // Tolerance: a tail 401ms away must NOT align (window is 400).
  const r = alignSegmentTails(
    [{ endMs: 900 + ALIGN_TOLERANCE_MS + 1, tailSlopeHzPerSec: 100 }],
    [{ endMs: 900, isQuestion: false }],
  );
  assert(r === null, "tail outside tolerance → nothing aligned → null");
}
{
  // n=1 floor: a single aligned declarative must NOT emit ratios (one +60 Hz/s
  // tail would swing tone by −25 off one data point; v1's ≥2-segment rule kept).
  const r = alignSegmentTails(
    [{ endMs: 1000, tailSlopeHzPerSec: 100 }],
    [
      { endMs: 950, isQuestion: false },
      { endMs: 1100, isQuestion: false },
    ],
  );
  assert(r === null, "one tail over two ends aligns once → below the n=2 floor → null");
}
{
  // Flat slopes (between thresholds) count in the denominator only.
  const r = alignSegmentTails(
    [
      { endMs: 900, tailSlopeHzPerSec: 10 },
      { endMs: 2000, tailSlopeHzPerSec: -10 },
    ],
    [
      { endMs: 900, isQuestion: false },
      { endMs: 2000, isQuestion: false },
    ],
  );
  assert(r != null && r!.declarativeCount === 2 && approx(r!.upspeakRatioAligned, 0) && approx(r!.finalFallRatioAligned, 0), "flat tails count in denominator only");
}
assert(alignSegmentTails(null, [{ endMs: 1, isQuestion: false }]) === null, "no tails → null");
assert(alignSegmentTails([{ endMs: 1, tailSlopeHzPerSec: 0 }], []) === null, "no ends → null");
{
  // Only questions align → no declarative denominator → null (fallback keeps worker ratio).
  const r = alignSegmentTails(
    [{ endMs: 900, tailSlopeHzPerSec: 100 }],
    [{ endMs: 900, isQuestion: true }],
  );
  assert(r === null, "question-only alignment → null");
}

// ——— withAlignedTailRatios ————————————————————————————————
const baseFeatures: ProsodyFeatures = {
  wordsPerMinute: 150, fillerCount: 0, fillerRatePerMinute: 0, pauseCount: 0,
  longPauseCount: 0, pauseTotalMs: 0, meanPauseMs: 0,
  pitchMeanHz: 140, pitchStdSemitones: 2, pitchRangeSemitones: 6,
  monotoneRatio: 0.2, upspeakRatio: 0.4, rmsMean: 60, rmsStd: 5, articulationScore: 0.6,
};
{
  const withTails: ProsodyFeatures = {
    ...baseFeatures,
    segmentTails: [
      { endMs: 900, tailSlopeHzPerSec: 120 },
      { endMs: 2000, tailSlopeHzPerSec: 150 },
    ],
  };
  const out = withAlignedTailRatios(withTails, [
    { word: "done.", endMs: 900 },
    { word: "Sure.", endMs: 2000 },
  ]);
  assert(approx(out!.upspeakRatioAligned, 1), "aligned upspeak attached");
  assert(out!.upspeakRatio === 0.4, "silence-heuristic ratio untouched");
  const single = withAlignedTailRatios(withTails, [{ word: "done.", endMs: 900 }]);
  assert(single === withTails, "one aligned declarative is below the floor → no aligned fields");
  const noWords = withAlignedTailRatios(withTails, []);
  assert(noWords === withTails, "no words → same reference, no aligned fields");
  const noTails = withAlignedTailRatios(baseFeatures, [{ word: "done.", endMs: 900 }]);
  assert(noTails === baseFeatures, "no tails → same reference");
  assert(withAlignedTailRatios(null, []) === null, "null features passthrough");
}

// ——— featureVersionAllowed (P1 cache guard) ————————————————
{
  const v1 = { pitchStdSemitones: 1 } as Partial<ProsodyFeatures>;
  const v2 = { pitchStdSemitones: 1, featureVersion: 2 } as Partial<ProsodyFeatures>;
  assert(featureVersionAllowed(v1, undefined), "unset max: v1 allowed");
  assert(featureVersionAllowed(v2, undefined), "unset max: v2 allowed");
  assert(featureVersionAllowed(v1, "1"), "max=1: unversioned rows are v1, allowed");
  assert(!featureVersionAllowed(v2, "1"), "max=1: v2 row is a MISS (revert drill)");
  assert(featureVersionAllowed(v2, "2"), "max=2: v2 allowed");
  assert(featureVersionAllowed(v2, "garbage"), "garbage max = unlimited");
  assert(featureVersionAllowed(null, "1"), "null features passthrough");
}

console.log(`✓ all ${passed} prosody-align + version-guard assertions pass`);
