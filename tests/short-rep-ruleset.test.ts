/**
 * Grading plan WS3 — short-rep ruleset (plan §4).
 * Run: npx tsx tests/short-rep-ruleset.test.ts
 */
import { isBelowScoringFloor } from "@/lib/workout/pause";
import { scorePacing, scoreThinkingQualityDeterministic } from "@/lib/scoring/deterministic";
import type { SignalBundle } from "@/lib/scoring/signals/audio";
import { renderRateLine, RATE_LINE_MIN_MS } from "@/lib/ai/score-shared";
import { DIMENSION_RUBRIC } from "@/lib/scoring/rubric";
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── §4.2 silent floor ──
{
  check("4 words / 2 s → below floor", isBelowScoringFloor({ transcript: "yes no maybe so", durationMs: 2000 }).belowFloor);
  check("4 words / 6 s → scored (floor needs BOTH)", !isBelowScoringFloor({ transcript: "yes no maybe so", durationMs: 6000 }).belowFloor);
  check("12 words / 2.5 s → scored", !isBelowScoringFloor({ transcript: "one two three four five six seven eight nine ten eleven twelve", durationMs: 2500 }).belowFloor);
  check("6 s / 12-word rep (plan verify case) → scored", !isBelowScoringFloor({ transcript: "a b c d e f g h i j k l", durationMs: 6000 }).belowFloor);
  check("explicit wordCount wins", isBelowScoringFloor({ transcript: "lots of words here really", wordCount: 2, durationMs: 1000 }).belowFloor);
  check("empty → below floor", isBelowScoringFloor({ transcript: "", durationMs: 500 }).belowFloor);
}

// ── §4.6 scorePacing: no under-budget dock, over-budget still docks ──
const base: SignalBundle = {
  wordCount: 40, durationMs: 15_000, timeBudgetMs: 60_000, wpm: 160,
  fillerCount: 0, fillerRate: 0, hedgeCount: 0, hedgeRate: 0, timeBudgetRatio: 0.25,
  longPauseCount: 0, stallCount: 0, pauseP50Ms: 300, pauseP95Ms: 800, restartCount: 0,
  quartileWpm: [160, 160, 160, 160], quartileWpmVariance: 0, finalQuartileDelta: 0,
};
{
  const short = scorePacing(base);
  check("25% of budget → no penalty (92)", short.score === 92, String(short.score));
  check("no 'under budget' reason", !short.signals.some((s) => /under budget/i.test(s)));
  const over = scorePacing({ ...base, timeBudgetRatio: 1.3, durationMs: 78_000 });
  check("30% over budget still docks", over.score < 92 && over.signals.some((s) => /over time budget/i.test(s)), String(over.score));
  const full = scorePacing({ ...base, timeBudgetRatio: 1.0, durationMs: 60_000 });
  check("short rep == full-length rep on identical fluency", short.score === full.score);
}

// ── §4.7 thinking: pause penalties scale with duration ──
{
  const long = scoreThinkingQualityDeterministic({ ...base, durationMs: 60_000, longPauseCount: 6, stallCount: 0 });
  const short = scoreThinkingQualityDeterministic({ ...base, durationMs: 10_000, longPauseCount: 1, stallCount: 0 });
  check("60 s / 6 pauses docks the cap (85-15=70)", long.score === 70, String(long.score));
  check("10 s / 1 pause docks ~0.5, not 3", short.score >= 84, String(short.score));
  const stallShort = scoreThinkingQualityDeterministic({ ...base, durationMs: 10_000, stallCount: 1 });
  const stallLong = scoreThinkingQualityDeterministic({ ...base, durationMs: 60_000, stallCount: 1 });
  check("stall penalty smaller on the short rep", stallShort.score > stallLong.score);
  check("hedge penalty unchanged by duration", scoreThinkingQualityDeterministic({ ...base, durationMs: 10_000, hedgeRate: 2 }).score === scoreThinkingQualityDeterministic({ ...base, durationMs: 60_000, hedgeRate: 2 }).score);
}

// ── §4.5 rate line ──
{
  check("< 8 s → n/a", renderRateLine("one two three", 5_000).includes("MEASURED RATE: n/a"));
  check("n/a line tells the model not to dock", /do not grade delivery on rate/.test(renderRateLine("x", 5_000)));
  check("≥ 8 s → wpm", /MEASURED RATE: ~\d+ wpm \(well-paced ~130-165\)/.test(renderRateLine("one two three four five six seven eight nine ten eleven twelve", 8_000)));
  check("threshold constant is 8 s", RATE_LINE_MIN_MS === 8_000);
  // Byte-stability for reference reps: the ≥ 8 s line is unchanged from before WS3.
  check("legacy line bytes unchanged", renderRateLine("a b c d e f g h i j", 10_000) === "REP DURATION: 10.0s · MEASURED RATE: ~60 wpm (well-paced ~130-165)");
}

// ── §4.3 no under-budget language left in rubric / anchors / slim MDs ──
{
  const rubricText = JSON.stringify(DIMENSION_RUBRIC);
  const anchors = readFileSync("src/lib/scoring/rubric-anchors.ts", "utf8");
  const md = readFileSync("src/lib/ai/knowledge/skills/conciseness.md", "utf8") + readFileSync("src/lib/ai/knowledge/skills/delivery.md", "utf8");
  const bad = /within (±)?\d+% of (the )?(time )?budget|under[- ]time|under budget|under-spoken|significantly (over or )?under|finishes within (the )?(time )?budget/i;
  check("rubric.ts clean", !bad.test(rubricText), rubricText.match(bad)?.[0]);
  check("rubric-anchors.ts clean", !bad.test(anchors), anchors.match(bad)?.[0]);
  check("skill MDs clean", !bad.test(md), md.match(bad)?.[0]);
  check("over-budget signal kept (conciseness)", /past where the content runs out|keeps talking past/i.test(rubricText + md));
}

console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all short-rep-ruleset tests pass");
else process.exitCode = 1;
