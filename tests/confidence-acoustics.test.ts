/**
 * Prosody v2 Phase 5 (P7) — confidence assist byte-safety + rendering.
 *
 * G5-BYTES is the load-bearing gate here: with the assist OFF (or with
 * v1-shaped features that carry no finals value even when it is ON), the
 * rendered PROSODY block must be BYTE-IDENTICAL to the pre-Phase-5 render —
 * the calibration guardrail (render optional blocks only when present) and
 * the prod flag-off path both depend on it.
 */
import { renderProsodyBlock, type ProsodyFeatures } from "../src/lib/audio/prosody";
import { withAlignedTailRatios } from "../src/lib/audio/prosody-align";

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed++;
}

const baseFeatures: ProsodyFeatures = {
  wordsPerMinute: 148,
  fillerCount: 2,
  fillerRatePerMinute: 1.1,
  pauseCount: 4,
  longPauseCount: 1,
  meanPauseMs: 620,
  pauseTotalMs: 2480,
  pitchMeanHz: 142,
  pitchStdSemitones: 3.1,
  pitchRangeSemitones: 9.4,
  monotoneRatio: 0.14,
  upspeakRatio: 0.1,
  rmsMean: 0.061,
  rmsStd: 0.02,
  articulationScore: 0.13,
};

// ——— G5-BYTES: flag off ⇒ byte-identical, opts-less caller ⇒ byte-identical ———
{
  const v2 = {
    ...baseFeatures,
    featureVersion: 2,
    finalFallRatio: 0.85,
    finalFallRatioAligned: 0.9,
  };
  const plain = renderProsodyBlock(v2);
  const offExplicit = renderProsodyBlock(v2, { confidenceAssist: false });
  const preP5 = renderProsodyBlock({ ...v2, finalFallRatio: null, finalFallRatioAligned: null } as ProsodyFeatures);
  assert(plain === offExplicit, "opts-less render must equal confidenceAssist:false render");
  assert(plain === preP5, "assist off: finals fields must not change a single byte");
  assert(plain != null && !plain.includes("statement endings"), "assist off: no finals line");
  assert(plain != null && !plain.includes("confidence assist"), "assist off: no exception text");
}

// ——— assist on but v1 features (no finals value) ⇒ still byte-identical ———
{
  const v1 = { ...baseFeatures };
  const off = renderProsodyBlock(v1);
  const on = renderProsodyBlock(v1, { confidenceAssist: true });
  assert(off === on, "assist on + v1 features (no finals): byte-identical render");
}

// ——— assist on + finals ⇒ line + exception, aligned preferred ———
{
  const v2 = {
    ...baseFeatures,
    finalFallRatio: 0.4,
    finalFallRatioAligned: 0.9,
  };
  const on = renderProsodyBlock(v2, { confidenceAssist: true });
  assert(on != null && on.includes("statement endings: 90% falling finals"), "aligned ratio preferred over raw");
  assert(on.includes("confidence assist (narrow exception"), "exception text present when assist active");
  assert(on.includes("at most ±5"), "±5 cap stated");
  assert(on.includes("edge-rule 2b protection"), "2b precedence stated");
  // Retune 1 (G5-HALO attempt 1): the exception must NOT re-mention the content
  // dims — end-of-block salience re-anchored clarity/structure in the first
  // battery. The header ban is the only place they appear.
  const afterHeader = on.slice(on.indexOf("\n"));
  assert(!afterHeader.includes("clarity"), "content dims not re-mentioned outside the header");
}

// ——— raw fallback when aligned is absent ———
{
  const v2 = { ...baseFeatures, finalFallRatio: 0.25 };
  const on = renderProsodyBlock(v2, { confidenceAssist: true });
  assert(on != null && on.includes("statement endings: 25% falling finals"), "raw finals used when no aligned value");
}

// ——— no-volume variant: exception must not reference volume-steadiness when
//     the volume line itself is absent (rms fields null) ———
{
  const noRms = {
    ...baseFeatures,
    rmsMean: null,
    rmsStd: null,
    finalFallRatio: 0.7,
  };
  const on = renderProsodyBlock(noRms, { confidenceAssist: true });
  assert(on != null && !on.includes("volume mean"), "no volume line without rms fields");
  assert(!on.includes("volume-steadiness"), "exception omits volume-steadiness when no volume line exists");
  assert(on.includes("it CORROBORATES"), "singular phrasing in the no-volume variant");
}

// ——— withAlignedTailRatios remains additive: render of aligned object with assist
//     OFF must equal render of the un-aligned object (the score-shared reorder) ———
{
  const v2 = {
    ...baseFeatures,
    finalFallRatio: 0.5,
    segmentTails: [
      { endMs: 2000, tailSlopeHzPerSec: -80 },
      { endMs: 5000, tailSlopeHzPerSec: -120 },
      { endMs: 9000, tailSlopeHzPerSec: 40 },
    ],
  };
  const words = [
    { word: "First.", endMs: 2010 },
    { word: "Second.", endMs: 5040 },
    { word: "third?", endMs: 9010 },
  ];
  const aligned = withAlignedTailRatios(v2, words);
  assert(aligned !== null, "alignment produced a features object");
  assert(
    renderProsodyBlock(aligned) === renderProsodyBlock(v2),
    "rendering the aligned object with assist off is byte-identical to the raw object",
  );
}

// ——— the block header firewall itself is unchanged ———
{
  const on = renderProsodyBlock(
    { ...baseFeatures, finalFallRatio: 0.8 } as ProsodyFeatures,
    { confidenceAssist: true },
  );
  assert(
    on != null &&
      on.startsWith(
        "PROSODY (objective audio measurements; evidence for delivery and tone ONLY",
      ),
    "header firewall line unchanged",
  );
}

// ——— no stale copy drift: the pre-registration promises ±5 — assert it on
//     the RENDERED block (behavior), not on source text ———
{
  const on = renderProsodyBlock(
    { ...baseFeatures, finalFallRatio: 0.8 },
    { confidenceAssist: true },
  );
  const caps = on?.match(/±5/g) ?? [];
  assert(caps.length === 1, "exactly one ±5 cap statement in the rendered block");
}

console.log(`✓ all ${passed} confidence-acoustics assertions pass`);
