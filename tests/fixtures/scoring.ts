/**
 * Cognify Scoring Fixtures — v2-beta.1
 *
 * Hand-crafted rep fixtures that exercise the deterministic scoring
 * layer. Each fixture has expected score ranges; verifyFixture()
 * returns pass/fail for each range check.
 *
 * These fixtures are NOT a test-runner invocation (the project has no
 * Vitest/Jest installed yet). They're importable data + a verification
 * function. A future `npm run test:scoring` can wire verifyAllFixtures()
 * into a real test runner. See docs/BACKLOG.md → "Test infrastructure".
 *
 * To run manually in Node:
 *   npx tsx tests/fixtures/scoring.ts
 *
 * (requires tsx or similar TS loader).
 */

import { extractSignals, type WordTiming } from "@/lib/scoring/signals";
import {
  scorePacing,
  scoreConfidenceDeterministic,
} from "@/lib/scoring/deterministic";

export type RepFixture = {
  name: string;
  description: string;
  transcript: string;
  words: WordTiming[];
  durationMs: number;
  timeBudgetMs: number;
  expectedPacing: [number, number];
  expectedConfidence: [number, number];
};

/**
 * Build a word-timing array from a transcript + duration.
 * Evenly distributes words across the duration with small gaps.
 * Used for hand-crafted fixtures where we don't have real Deepgram data.
 */
function makeWords(transcript: string, durationMs: number): WordTiming[] {
  const tokens = transcript
    .replace(/[.,!?;:'"]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];
  const msPerWord = durationMs / tokens.length;
  return tokens.map((word, i) => ({
    word,
    startMs: Math.round(i * msPerWord),
    endMs: Math.round((i + 1) * msPerWord - 40),
  }));
}

// ——— STRONG REP —————————————————————————————————————————
// Clean, on budget, low filler, direct delivery.
const STRONG_TRANSCRIPT = `Our quarterly revenue exceeded targets by twelve percent, driven mostly by enterprise expansion. The growth came from three specific sources: mid-market adoption of our new pricing model, enterprise renewal rates hitting ninety-four percent, and two strategic wins in healthcare. My recommendation is to double down on enterprise sales investment for the fourth quarter to capture the momentum while it's still accelerating.`;

export const STRONG_REP: RepFixture = {
  name: "strong",
  description: "Clean rep: on budget, low filler, steady pacing",
  transcript: STRONG_TRANSCRIPT,
  words: makeWords(STRONG_TRANSCRIPT, 55_000),
  durationMs: 55_000,
  timeBudgetMs: 60_000,
  expectedPacing: [80, 98],
  expectedConfidence: [80, 98],
};

// ——— FILLER-HEAVY REP —————————————————————————————————————
// Fillers, hedges, and uncertainty throughout.
const FILLER_HEAVY_TRANSCRIPT = `Um so like our quarterly results uh I think they were kind of better than expected. Basically um we grew like maybe twelve percent or so. Actually um I guess the enterprise thing kind of was pretty good. Um like sort of the mid-market was good too I think. Um yeah so basically that's what happened I think honestly.`;

export const FILLER_HEAVY_REP: RepFixture = {
  name: "filler-heavy",
  description: "Fillers, hedges, and uncertainty throughout",
  transcript: FILLER_HEAVY_TRANSCRIPT,
  words: makeWords(FILLER_HEAVY_TRANSCRIPT, 45_000),
  durationMs: 45_000,
  timeBudgetMs: 60_000,
  expectedPacing: [20, 60],
  expectedConfidence: [25, 65],
};

// ——— OVER-TIME REP —————————————————————————————————————
// Good content but runs 30% over the budget.
const OVER_TIME_TRANSCRIPT = `Our quarterly revenue exceeded targets by twelve percent. The growth was driven by enterprise expansion, specifically mid-market customers adopting the new pricing model. Three specific wins were the primary contributors: a major healthcare deal, renewal rates at ninety-four percent, and expanded usage among existing accounts. I recommend doubling enterprise investment for the fourth quarter to capture the momentum. We should also increase outbound capacity, launch two new sales programs, and expand international coverage by the end of the year. Healthcare and financial services are the two verticals where we're seeing the most traction.`;

export const OVER_TIME_REP: RepFixture = {
  name: "over-time",
  description: "Good content but 30% over the time budget",
  transcript: OVER_TIME_TRANSCRIPT,
  words: makeWords(OVER_TIME_TRANSCRIPT, 78_000),
  durationMs: 78_000,
  timeBudgetMs: 60_000,
  expectedPacing: [60, 85],
  expectedConfidence: [70, 95],
};

// ——— RESTART-HEAVY REP —————————————————————————————————
// Multiple verbal restarts, working memory overflow signal.
const RESTART_TRANSCRIPT = `Our quarterly results were, wait, let me start over. Our revenue grew twelve, actually thirteen percent. Sorry, twelve percent, let me be clear. The growth was, I mean, mostly from enterprise. What I meant to say is that enterprise renewal was ninety-four percent. Scratch that, ninety-four percent is the retention rate, not renewal. I recommend, wait, what I'm trying to say is we should invest more in enterprise sales.`;

export const RESTART_HEAVY_REP: RepFixture = {
  name: "restart-heavy",
  description: "Multiple verbal restarts and corrections",
  transcript: RESTART_TRANSCRIPT,
  words: makeWords(RESTART_TRANSCRIPT, 60_000),
  durationMs: 60_000,
  timeBudgetMs: 60_000,
  expectedPacing: [78, 92],
  expectedConfidence: [55, 72],
};

// ——— OFF-TOPIC REP ——————————————————————————————————————
// Fluent speech that completely ignores the prompt. Deterministic
// pacing/confidence will be decent (speaker is articulate); the
// scoring failure is in the LLM relevance layer.
const OFF_TOPIC_TRANSCRIPT = `So I was thinking about my vacation plans for the summer. I really want to go to Italy this year, maybe the Amalfi Coast. My friend went last year and said it was incredible. The food was amazing, the weather was perfect, and the hotels were surprisingly affordable. I think if we book early enough we can get a good deal on flights too. Anyway that's what I've been thinking about lately.`;

export const OFF_TOPIC_REP: RepFixture = {
  name: "off-topic",
  description:
    "Ignores the prompt entirely — talks about vacation when asked about revenue. Exercises LLM relevance scoring.",
  transcript: OFF_TOPIC_TRANSCRIPT,
  words: makeWords(OFF_TOPIC_TRANSCRIPT, 40_000),
  durationMs: 40_000,
  timeBudgetMs: 60_000,
  expectedPacing: [55, 92],
  expectedConfidence: [55, 92],
};

// ——— LOW-EFFORT REP ——————————————————————————————————————
// Minimal, dismissive, no substance. Exercises both deterministic
// (hedges, fillers, severe under-budget) and LLM layers.
const LOW_EFFORT_TRANSCRIPT = `Yeah I don't know, um, I guess it's fine honestly. Like whatever, you know, it is what it is. I mean I don't really have much to say about it I think. Um yeah basically that's kind of it I guess.`;

export const LOW_EFFORT_REP: RepFixture = {
  name: "low-effort",
  description:
    "Minimal, dismissive response with no substance. Should score low on deterministic and LLM layers.",
  transcript: LOW_EFFORT_TRANSCRIPT,
  words: makeWords(LOW_EFFORT_TRANSCRIPT, 15_000),
  durationMs: 15_000,
  timeBudgetMs: 60_000,
  expectedPacing: [20, 55],
  expectedConfidence: [55, 70],
};

export const ALL_FIXTURES: readonly RepFixture[] = [
  STRONG_REP,
  FILLER_HEAVY_REP,
  OVER_TIME_REP,
  RESTART_HEAVY_REP,
  OFF_TOPIC_REP,
  LOW_EFFORT_REP,
];

// ——— Verification ——————————————————————————————————————

export type FixtureResult = {
  fixture: string;
  pacing: { score: number; expected: [number, number]; passed: boolean };
  confidence: { score: number; expected: [number, number]; passed: boolean };
  signals: {
    fillerRate: number;
    hedgeRate: number;
    wpm: number;
    restartCount: number;
    longPauseCount: number;
    timeBudgetRatio: number;
  };
};

export function verifyFixture(fixture: RepFixture): FixtureResult {
  const signals = extractSignals({
    words: fixture.words,
    transcript: fixture.transcript,
    durationMs: fixture.durationMs,
    timeBudgetMs: fixture.timeBudgetMs,
  });
  const pacing = scorePacing(signals);
  const confidence = scoreConfidenceDeterministic(signals);

  return {
    fixture: fixture.name,
    pacing: {
      score: pacing.score,
      expected: fixture.expectedPacing,
      passed:
        pacing.score >= fixture.expectedPacing[0] &&
        pacing.score <= fixture.expectedPacing[1],
    },
    confidence: {
      score: confidence.score,
      expected: fixture.expectedConfidence,
      passed:
        confidence.score >= fixture.expectedConfidence[0] &&
        confidence.score <= fixture.expectedConfidence[1],
    },
    signals: {
      fillerRate: signals.fillerRate,
      hedgeRate: signals.hedgeRate,
      wpm: signals.wpm,
      restartCount: signals.restartCount,
      longPauseCount: signals.longPauseCount,
      timeBudgetRatio: signals.timeBudgetRatio,
    },
  };
}

export function verifyAllFixtures(): FixtureResult[] {
  return ALL_FIXTURES.map(verifyFixture);
}

// Runnable as `npx tsx tests/fixtures/scoring.ts`
// Prints a pass/fail table to stdout. Exits 1 on any failure.
if (typeof require !== "undefined" && require.main === module) {
  const results = verifyAllFixtures();
  const allPassed = results.every(
    (r) => r.pacing.passed && r.confidence.passed,
  );
  console.log("\nCognify Scoring Fixture Verification\n");
  for (const r of results) {
    const pacingMark = r.pacing.passed ? "✓" : "✗";
    const confMark = r.confidence.passed ? "✓" : "✗";
    console.log(`  ${r.fixture}`);
    console.log(
      `    ${pacingMark} pacing:     ${r.pacing.score}  (expected ${r.pacing.expected.join("-")})`,
    );
    console.log(
      `    ${confMark} confidence: ${r.confidence.score}  (expected ${r.confidence.expected.join("-")})`,
    );
  }
  console.log("");
  console.log(allPassed ? "All fixtures passed." : "Some fixtures failed.");
  if (!allPassed && typeof process !== "undefined") {
    process.exit(1);
  }
}
