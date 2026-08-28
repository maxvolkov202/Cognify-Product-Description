/**
 * Grading plan WS5 — deterministic Tone core from prosody.
 * Run: npx tsx tests/tone-core.test.ts
 */
import { scoreToneFromProsody, blendToneWithModel, hasToneCoreEvidence } from "@/lib/scoring/tone-core";
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
const base: ProsodyFeatures = {
  wordsPerMinute: 150, fillerCount: 0, fillerRatePerMinute: 0, pauseCount: 3, longPauseCount: 0, pauseTotalMs: 900, meanPauseMs: 300,
  pitchMeanHz: 180, pitchStdSemitones: 3.2, pitchRangeSemitones: 12, monotoneRatio: 0.12, upspeakRatio: 0.1,
  rmsMean: 0.05, rmsStd: 0.02, articulationScore: 0.7,
};
const T = (o: Partial<ProsodyFeatures>) => scoreToneFromProsody({ ...base, ...o })!;

{
  check("no features → null", scoreToneFromProsody(null) === null);
  check("no pitch std → null (Hume-only stays with the model)", scoreToneFromProsody({ ...base, pitchStdSemitones: null }) === null);
  check("hasToneCoreEvidence", hasToneCoreEvidence(base) && !hasToneCoreEvidence(null));
  const expressive = T({});
  const flat = T({ pitchStdSemitones: 0.25, pitchRangeSemitones: 1, monotoneRatio: 0.8, rmsStd: 0.004 });
  check("flat vs expressive separate by ≥ 20 points", expressive.score - flat.score >= 20, `${expressive.score} vs ${flat.score}`);
  check("PSOLA-flattened monotone (≤0.25 st) lands ≤ 45 (audio-tone bank rule)", flat.score <= 45, String(flat.score));
  check("expressive lands 70-90", expressive.score >= 70 && expressive.score <= 90, String(expressive.score));
  const ups = T({ upspeakRatio: 0.5 });
  check("upspeak docks even with variety (edge rule 4)", ups.score < expressive.score - 10, `${ups.score}`);
  const mono = T({ monotoneRatio: 0.65 });
  check("monotone ratio > 60% docks hard", mono.score <= expressive.score - 20, `${mono.score}`);
  const steps = [0.25, 0.75, 1, 2, 3, 4, 5.5].map((s) => T({ pitchStdSemitones: s }).score);
  check("monotone in pitch std", steps.every((v, i) => i === 0 || v >= steps[i - 1]!), steps.join(","));
  check("articulation modifies within ±6", Math.abs(T({ articulationScore: 0.9 }).score - T({ articulationScore: 0.3 }).score) <= 12);
  check("idempotent", T({}).score === expressive.score);
  check("bounds 20-95", T({ pitchStdSemitones: 0, monotoneRatio: 1, upspeakRatio: 1, rmsStd: 0, articulationScore: 0 }).score >= 20 && T({ pitchStdSemitones: 9, monotoneRatio: 0, rmsStd: 0.05, articulationScore: 1 }).score <= 95);
  check("evidence names the real fields", /pitch std .* st, range .* st, monotone \d+%, upspeak \d+%, volume cv/.test(expressive.evidence), expressive.evidence);
}
{
  check("blend: model within ±10 wins", blendToneWithModel(70, 76) === 76 && blendToneWithModel(70, 64) === 64);
  check("blend: clamped at ±10", blendToneWithModel(70, 95) === 80 && blendToneWithModel(70, 30) === 60);
  check("blend: no model → core", blendToneWithModel(70, undefined) === 70);
}
console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all tone-core tests pass");
else process.exitCode = 1;
