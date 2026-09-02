/**
 * Prosody v2 Phase 4 — Measured-delivery strip formatting. Every number must
 * come from the scorer's own machinery: the SCORED filler lexicon (not
 * prosody-inline's broader one), the 8s rate-measurable floor, the exported
 * well-paced band, and tone-core's pitch tiers. Plain language, no em-dashes.
 */
import { buildLiveDeliveryMetrics, describePitchVariety } from "../src/lib/audio/live-metrics";
import { extractInlineProsody } from "../src/lib/audio/prosody-inline";
import { RATE_MEASURABLE_MIN_MS } from "../src/lib/scoring/deterministic";

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed++;
}

const words = (n: number, gapMs = 100, wordMs = 250, text = (i: number) => `word${i}`) => {
  const out: { word: string; startMs: number; endMs: number }[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    out.push({ word: text(i), startMs: t, endMs: t + wordMs });
    t += wordMs + gapMs;
  }
  return out;
};
const build = (w: ReturnType<typeof words>, durationMs: number) =>
  buildLiveDeliveryMetrics(extractInlineProsody({ words: w, durationMs }), { words: w, durationMs });

{
  const m = build(words(60), 24_000);
  assert(/Pace 150 wpm, on pace/.test(m.paceLabel), `on-pace label: ${m.paceLabel}`);
  assert(/130-165/.test(m.paceLabel), "band shown");
  assert(m.fillerLabel === "No fillers", m.fillerLabel);
  assert(m.pauseLabel === "No long pauses", String(m.pauseLabel));
}
{
  const fast = build(words(60), 18_000);
  assert(/fast/.test(fast.paceLabel), fast.paceLabel);
  const slow = build(words(40), 24_000);
  assert(/unhurried/.test(slow.paceLabel), slow.paceLabel);
}
{
  // The scorer refuses a rate verdict under 8s — so must the strip.
  const short = build(words(24), RATE_MEASURABLE_MIN_MS - 1_000);
  assert(short.paceLabel === "Too short to measure a steady pace", short.paceLabel);
}
{
  // Fillers use the SCORED lexicon: "like"/"so" are excluded there (too many
  // false positives), "um"/"uh" count.
  const likeSo = build(words(30, 100, 250, (i) => (i % 2 ? "like" : "so")), 12_000);
  assert(likeSo.fillerLabel === "No fillers", `like/so must not count: ${likeSo.fillerLabel}`);
  const um = build(words(30, 100, 250, (i) => (i < 3 ? "um" : `word${i}`)), 12_000);
  assert(/^3 fillers \(15\.0 per minute\)/.test(um.fillerLabel), um.fillerLabel);
}
{
  // Ordinary 400-1500ms clause breaths are NOT flagged (the pacing score
  // credits them); only long pauses (>=1.5s) get a chip.
  const breaths = words(10, 600);
  const m1 = build(breaths, 10_000);
  assert(m1.pauseLabel === "No long pauses", String(m1.pauseLabel));
  const w = words(10);
  w[5] = { ...w[5]!, startMs: w[4]!.endMs + 1600, endMs: w[4]!.endMs + 1850 };
  for (let i = 6; i < 10; i++) w[i] = { word: `word${i}`, startMs: w[i - 1]!.endMs + 100, endMs: w[i - 1]!.endMs + 350 };
  const m2 = build(w, 10_000);
  assert(m2.pauseLabel === "1 long pause (over 1.5s)", String(m2.pauseLabel));
}
{
  // Synthesized baseline (no word timings) → pause line suppressed, never faked.
  const inline = extractInlineProsody({ words: words(30), durationMs: 12_000 });
  const m = buildLiveDeliveryMetrics({ ...inline, pauseDataAvailable: false }, { words: words(30), durationMs: 12_000 });
  assert(m.pauseLabel === null, "no measured pauses = no pause chip");
}
{
  // Pitch phrases delegate to tone-core's classifyPitchVariety (one definition).
  assert(describePitchVariety(null, null, null) === null, "no pitch = no phrase");
  assert(describePitchVariety(0.2, 1, true) === "Pitch stayed flat", "flat");
  assert(describePitchVariety(3.4, 0.9, true) === "Pitch stayed flat", "windowed monotone flat wins");
  assert(describePitchVariety(3.4, 0.9, false) === "Pitch varied well", "std-derived monotone ignored (same rule as the core)");
  assert(describePitchVariety(2.2, 0.2, true) === "Pitch moved a little", "mid");
  assert(describePitchVariety(3.4, 0.2, true) === "Pitch varied well", "varied");
  for (const s of ["Pitch stayed flat", "Pitch moved a little", "Pitch varied well"]) assert(!s.includes("—"), "no em-dash");
}
console.log(`✓ all ${passed} live-metrics assertions pass`);
