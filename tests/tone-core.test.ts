/**
 * Grading plan WS5 — deterministic Tone core from prosody.
 * Run: npx tsx tests/tone-core.test.ts
 */
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
/** Worker-consistent fixture: monotoneRatio derived from pitch std,
 *  intensity in dB. */
const mk = (std: number, o: Partial<ProsodyFeatures> = {}): ProsodyFeatures => ({
  wordsPerMinute: 150, fillerCount: 0, fillerRatePerMinute: 0, pauseCount: 3, longPauseCount: 0, pauseTotalMs: 900, meanPauseMs: 300,
  pitchMeanHz: 180, pitchStdSemitones: std, pitchRangeSemitones: std * 4,
  monotoneRatio: std <= 1.5 ? 1 : std >= 4.5 ? 0 : 1 - (std - 1.5) / 3,
  upspeakRatio: 0.1, rmsMean: 62, rmsStd: 6, articulationScore: 0.7,
  ...o,
});
const T = (std: number, o: Partial<ProsodyFeatures> = {}) => scoreToneFromProsody(mk(std, o))!;

{
  check("no features → null", scoreToneFromProsody(null) === null);
  check("no pitch std → null (Hume-only stays with the model)", scoreToneFromProsody(mk(3, { pitchStdSemitones: null })) === null);
  check("non-finite pitch std → null", scoreToneFromProsody(mk(3, { pitchStdSemitones: Infinity })) === null);
  check("hasToneCoreEvidence", hasToneCoreEvidence(mk(3)) && !hasToneCoreEvidence(null));
  const s3 = T(3.0), s25 = T(2.5), s1 = T(1.0), s025 = T(0.25), s4 = T(4.0);
  check("3 st → healthy variety band (≥ 70)", s3.score >= 70, String(s3.score));
  check("2.5 st → between bands (50-70)", s25.score >= 50 && s25.score < 70, String(s25.score));
  check("1 st → ≤ 45", s1.score <= 45, String(s1.score));
  check("PSOLA-flattened 0.25 st → ≤ 45 (audio-tone bank rule)", s025.score <= 45, String(s025.score));
  check("flat vs expressive separate by ≥ 20", s4.score - s025.score >= 20, `${s4.score} vs ${s025.score}`);
  const steps = [0.25, 0.75, 1, 2, 3, 4, 5.5].map((s) => T(s).score);
  check("monotone in pitch std", steps.every((v, i) => i === 0 || v >= steps[i - 1]!), steps.join(","));
  check("upspeak docks even with variety (edge rule 4)", T(3.5, { upspeakRatio: 0.5 }).score <= T(3.5).score - 15);
  check("flat volume (< 2 dB) docks, lively (9 dB) lifts", T(3, { rmsStd: 1.5 }).score < T(3).score && T(3, { rmsStd: 9 }).score > T(3).score);
  check("volume evidence is in dB", /volume std 6\.0 dB/.test(T(3).evidence), T(3).evidence);
  check("articulation: 0.9 beats 0.3", T(3, { articulationScore: 0.9 }).score > T(3, { articulationScore: 0.3 }).score);
  check("idempotent", T(3).score === s3.score);
  check("evidence names the real fields", /pitch std 3\.00 st, range 12\.0 st, upspeak 10%, volume std 6\.0 dB, articulation 70/.test(s3.evidence), s3.evidence);
}
{
  check("blend: model within ±10 wins", blendToneWithModel(70, 76) === 76 && blendToneWithModel(70, 64) === 64);
  check("blend: clamped at ±10", blendToneWithModel(70, 95) === 80 && blendToneWithModel(70, 30) === 60);
  check("blend: no model → core", blendToneWithModel(70, undefined) === 70);
  const fb = buildToneFeedback(mk(0.8, { rmsStd: 1.2 }));
  check("generated tone feedback: flat pitch + flat volume + action", /barely moved/.test(fb) && /volume stayed/.test(fb) && /\.$/.test(fb), fb);
  check("no em-dash in generated tone copy", !/—/.test(fb));
}
console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all tone-core tests pass");
else process.exitCode = 1;
