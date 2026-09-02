/**
 * Prosody v2 (P3) — deterministic Tone core v2 from Praat worker-v2 features.
 * Includes the GF1 gate over the committed fixture vectors
 * (tests/fixtures/audio-grading/features-v2.json — real worker output, no audio needed).
 * Run: npx tsx tests/tone-core.test.ts
 */
import { readFileSync } from "node:fs";
import { scoreToneFromProsody, blendToneWithModel, hasToneCoreEvidence, buildToneFeedback } from "@/lib/scoring/tone-core";
import type { ProsodyFeatures } from "@/lib/audio/prosody";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
/** v2-shaped fixture: windowed monotone is INDEPENDENT, rms/articulation on the
 *  measured scales (in-system p50: rmsStd ≈ 22 dB, articulation ≈ 0.13). */
const mk = (std: number, o: Partial<ProsodyFeatures> = {}): ProsodyFeatures => ({
  wordsPerMinute: 150, fillerCount: 0, fillerRatePerMinute: 0, pauseCount: 3, longPauseCount: 0, pauseTotalMs: 900, meanPauseMs: 300,
  pitchMeanHz: 180, pitchStdSemitones: std, pitchRangeSemitones: std * 4,
  monotoneRatio: 0.2, upspeakRatio: 0.1, rmsMean: 62, rmsStd: 20, articulationScore: 0.15,
  featureVersion: 2,
  ...o,
});
const T = (std: number, o: Partial<ProsodyFeatures> = {}) => scoreToneFromProsody(mk(std, o))!;

{
  check("no features → null", scoreToneFromProsody(null) === null);
  check("no pitch std → null (Hume-only stays with the model)", scoreToneFromProsody(mk(3, { pitchStdSemitones: null })) === null);
  check("non-finite pitch std → null", scoreToneFromProsody(mk(3, { pitchStdSemitones: Infinity })) === null);
  check("hasToneCoreEvidence", hasToneCoreEvidence(mk(3)) && !hasToneCoreEvidence(null));
  const s3 = T(3.0), s25 = T(2.5), s1 = T(1.0), s4 = T(4.0);
  const flat = T(0.25, { monotoneRatio: 1 });
  check("3 st, low monotone → expressive band (≥ 65)", s3.score >= 65, String(s3.score));
  check("2.5 st → between bands (50-70)", s25.score >= 50 && s25.score < 70, String(s25.score));
  check("1 st → ≤ 45", s1.score <= 45, String(s1.score));
  check("PSOLA-flattened 0.25 st, monotone 100% → ≤ 45 (audio-tone bank rule)", flat.score <= 45, String(flat.score));
  check("flat vs expressive separate by ≥ 25", s4.score - flat.score >= 25, `${s4.score} vs ${flat.score}`);
  const steps = [0.25, 0.75, 1, 2, 3, 4, 5.5].map((s) => T(s).score);
  check("monotone in pitch std", steps.every((v, i) => i === 0 || v >= steps[i - 1]!), steps.join(","));
  // v2: windowed monotone is an INDEPENDENT signal — same std, more flat windows, lower score.
  check("windowed monotone docks independently of std", T(3, { monotoneRatio: 0.9 }).score <= T(3, { monotoneRatio: 0.2 }).score - 10,
    `${T(3, { monotoneRatio: 0.9 }).score} vs ${T(3, { monotoneRatio: 0.2 }).score}`);
  check("aligned upspeak docks even with variety (edge rule 4)", T(3.5, { upspeakRatioAligned: 0.5 }).score <= T(3.5).score - 15);
  // v2: the scoring-time ALIGNED ratio outranks the silence heuristic.
  check("aligned upspeak 0 overrides noisy raw 0.5", T(3.5, { upspeakRatio: 0.5, upspeakRatioAligned: 0 }).score === T(3.5, { upspeakRatio: 0.1 }).score,
    `${T(3.5, { upspeakRatio: 0.5, upspeakRatioAligned: 0 }).score}`);
  check("raw fallback is uncharged in its documented noise band (≤0.3)", T(3.5, { upspeakRatio: 0.25 }).score === T(3.5, { upspeakRatio: 0 }).score);
  check("raw fallback still docks real upspeak (0.65)", T(3.5, { upspeakRatio: 0.65 }).score <= T(3.5).score - 15);
  // v2: falling statement finals earn a bonus (flat fixtures ≈ 0, expressive 0.5-1.0);
  // the raw variant comes from the same noisy segmentation as raw upspeak, so damped.
  check("aligned falling finals lift the score", T(3, { finalFallRatioAligned: 0.8 }).score >= T(3, { finalFallRatioAligned: 0 }).score + 4,
    `${T(3, { finalFallRatioAligned: 0.8 }).score} vs ${T(3, { finalFallRatioAligned: 0 }).score}`);
  check("raw falling-final bonus is damped (≤3)", T(3, { finalFallRatio: 0.8 }).score - T(3, { finalFallRatio: 0 }).score <= 3);
  // v1-shaped features must not be double-counted: their monotoneRatio IS the std.
  check("v1 features (no featureVersion): std-derived monotone uncharged",
    T(1.0, { featureVersion: null, monotoneRatio: 1 }).score === T(1.0, { featureVersion: null, monotoneRatio: 0.2 }).score,
    `${T(1.0, { featureVersion: null, monotoneRatio: 1 }).score} vs ${T(1.0, { featureVersion: null, monotoneRatio: 0.2 }).score}`);
  check("v2 short-clip fallback (monotoneWindowed=false) uncharged",
    T(1.0, { monotoneWindowed: false, monotoneRatio: 1 }).score === T(1.0, { monotoneWindowed: false, monotoneRatio: 0.2 }).score);
  check("flat volume (8 dB on this scale) docks, lively (40 dB) lifts", T(3, { rmsStd: 8 }).score < T(3).score && T(3, { rmsStd: 40 }).score > T(3).score);
  check("articulation: 0.4 beats 0.03, halved weight (≤ 6 apart)",
    T(3, { articulationScore: 0.4 }).score > T(3, { articulationScore: 0.03 }).score &&
    T(3, { articulationScore: 0.4 }).score - T(3, { articulationScore: 0.03 }).score <= 6);
  check("idempotent", T(3).score === s3.score);
  check("evidence names the v2 fields", /pitch std 3\.00 st, monotone 20%, upspeak 10%, volume std 20\.0 dB, articulation 15/.test(s3.evidence), s3.evidence);
}
{
  // ── GF1 over the committed worker-v2 fixture vectors ──
  const fx = JSON.parse(readFileSync("tests/fixtures/audio-grading/features-v2.json", "utf8")).fixtures as
    Record<string, { style: string; scriptId: string; features: ProsodyFeatures }>;
  const byScript: Record<string, Record<string, number>> = {};
  for (const v of Object.values(fx)) {
    const s = scoreToneFromProsody(v.features);
    check(`fixture scores (${v.scriptId}/${v.style})`, s != null);
    (byScript[v.scriptId] ??= {})[v.style] = s!.score;
  }
  const scripts = Object.entries(byScript);
  check("all five scripts have flat+expressive pairs", scripts.length === 5 && scripts.every(([, v]) => v.flat != null && v.expressive != null));
  for (const [sid, v] of scripts) {
    check(`GF1 ${sid}: flat ≤ 45`, v.flat! <= 45, String(v.flat));
    const flatRaw = Object.values(fx).filter((f) => f.scriptId === sid && f.style === "flat")
      .map((f) => scoreToneFromProsody(f.features)!.raw)[0]!;
    check(`GF1 ${sid}: flat RAW ≤ 35 (margin below the clamp, not the clamp itself)`, flatRaw <= 35, String(flatRaw));
    check(`GF1 ${sid}: expressive ≥ 65`, v.expressive! >= 65, String(v.expressive));
    check(`GF1 ${sid}: separation ≥ 25`, v.expressive! - v.flat! >= 25, `${v.expressive! - v.flat!}`);
  }
}
{
  check("blend: model within ±10 wins", blendToneWithModel(70, 76) === 76 && blendToneWithModel(70, 64) === 64);
  check("blend: clamped at ±10", blendToneWithModel(70, 95) === 80 && blendToneWithModel(70, 30) === 60);
  check("blend: no model → core", blendToneWithModel(70, undefined) === 70);
  const fb = buildToneFeedback(mk(0.8, { rmsStd: 1.2, monotoneRatio: 0.95 }));
  check("generated tone feedback: flat pitch + flat volume + action", /barely moved/.test(fb) && /volume stayed/.test(fb) && /\.$/.test(fb), fb);
  const fbUp = buildToneFeedback(mk(3.2, { upspeakRatioAligned: 0.5 }));
  check("upspeak feedback uses the aligned ratio", /rising at the end/.test(fbUp) && /falling note/.test(fbUp), fbUp);
  // Coherence: the sentence tiers use the SAME cuts as the scoring curves —
  // std 3.5 with monotone 0.6 is mid-tier everywhere, never self-contradicting.
  const fbMid = buildToneFeedback(mk(3.5, { monotoneRatio: 0.6 }));
  check("mid-tier monotone reads as one coherent sentence",
    /moved a little/.test(fbMid) && /long stretches stayed on one note/.test(fbMid) && /Land the key words/.test(fbMid), fbMid);
  const fbV1 = buildToneFeedback(mk(3.2, { featureVersion: null, monotoneRatio: 1 }));
  check("v1 features: std-derived monotone never flips the sentence to flat", /moved well/.test(fbV1), fbV1);
  check("no em-dash in generated tone copy", !/—/.test(fb) && !/—/.test(fbUp) && !/—/.test(fbMid));
}
console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all tone-core tests pass");
else process.exitCode = 1;
