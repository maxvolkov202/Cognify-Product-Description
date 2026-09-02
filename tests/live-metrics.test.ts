/**
 * Prosody v2 Phase 4 — Measured-delivery strip formatting. Plain language,
 * no em-dashes, and pitch phrasing on the SAME cuts as the tone core.
 */
import { buildLiveDeliveryMetrics, describePitchVariety } from "../src/lib/audio/live-metrics";
import { extractInlineProsody } from "../src/lib/audio/prosody-inline";

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed++;
}

const words = (n: number, gapMs = 100, wordMs = 250) => {
  const out: { word: string; startMs: number; endMs: number }[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    out.push({ word: `word${i}`, startMs: t, endMs: t + wordMs });
    t += wordMs + gapMs;
  }
  return out;
};

{
  const inline = extractInlineProsody({ words: words(60), durationMs: 24_000 });
  const m = buildLiveDeliveryMetrics(inline);
  assert(/Pace 150 wpm, on pace/.test(m.paceLabel), `on-pace label: ${m.paceLabel}`);
  assert(/130-165/.test(m.paceLabel), "band shown");
  assert(m.fillerLabel === "No fillers", m.fillerLabel);
  assert(m.pauseLabel === "No long pauses", String(m.pauseLabel));
}
{
  const fast = buildLiveDeliveryMetrics(extractInlineProsody({ words: words(60), durationMs: 18_000 }));
  assert(/fast/.test(fast.paceLabel), fast.paceLabel);
  const slow = buildLiveDeliveryMetrics(extractInlineProsody({ words: words(40), durationMs: 24_000 }));
  assert(/unhurried/.test(slow.paceLabel), slow.paceLabel);
}
{
  // A 600ms gap = pause; 1600ms = long pause.
  const w = words(10);
  w[5] = { ...w[5]!, startMs: w[4]!.endMs + 1600, endMs: w[4]!.endMs + 1850 };
  for (let i = 6; i < 10; i++) w[i] = { word: `word${i}`, startMs: w[i - 1]!.endMs + 100, endMs: w[i - 1]!.endMs + 350 };
  const m = buildLiveDeliveryMetrics(extractInlineProsody({ words: w, durationMs: 10_000 }));
  assert(/1 pause, 1 over 1\.5s/.test(String(m.pauseLabel)), String(m.pauseLabel));
}
{
  // Synthesized baseline (no word timings) → pause line suppressed, never faked.
  const inline = extractInlineProsody({ words: words(30), durationMs: 12_000 });
  const m = buildLiveDeliveryMetrics({ ...inline, pauseDataAvailable: false });
  assert(m.pauseLabel === null, "no measured pauses = no pause chip");
}
{
  assert(describePitchVariety(null, null, null) === null, "no pitch = no phrase");
  assert(describePitchVariety(0.2, 1, true) === "Pitch stayed flat", "flat");
  assert(describePitchVariety(3.4, 0.9, true) === "Pitch stayed flat", "windowed monotone flat wins");
  assert(describePitchVariety(3.4, 0.9, false) === "Pitch varied well", "std-derived monotone ignored (same rule as the core)");
  assert(describePitchVariety(2.2, 0.2, true) === "Pitch moved a little", "mid");
  assert(describePitchVariety(3.4, 0.2, true) === "Pitch varied well", "varied");
  for (const s of ["Pitch stayed flat", "Pitch moved a little", "Pitch varied well"]) assert(!s.includes("—"), "no em-dash");
}
console.log(`✓ all ${passed} live-metrics assertions pass`);
