/**
 * Phase 13 — mascot voice tests.
 *
 * Run: npx tsx tests/mascot-voice.test.ts
 *
 * Covers:
 *  - formatVoice() interpolation (slot replacement + missing-slot literal)
 *  - timeOfDayFor() boundary cases
 *  - scoreBandKeyFor() boundary cases
 *  - deltaBandFor() decision matrix
 *  - Every voice bucket has ≥4 variants (DoD requirement)
 *  - High-frequency buckets (walkingComments, scoreReactions) have ≥8
 *  - Day-comparison templates exist for all 4 banner variants
 */

import {
  formatVoice,
  timeOfDayFor,
  scoreBandKeyFor,
  deltaBandFor,
} from "@/content/mascot/pick";
import {
  idleGreeting,
  walkingComments,
  scoreReactions,
  dayCompleteCelebrations,
  freezeConsumed,
  partialDay,
  fullDay,
  errorFallbacks,
  atStationIntroGeneric,
} from "@/content/mascot/voice";
import { dayComparisonTemplates } from "@/content/banners/day-comparison";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function assert(cond: unknown, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}
function section(label: string) {
  console.log(`\n── ${label} ──`);
}

// ─── formatVoice ─────────────────────────────────────────────────────────
section("formatVoice");
{
  assert(
    formatVoice("Hi {firstName}", {}, "Max") === "Hi Max",
    "firstName slot interpolates",
  );
  assert(
    formatVoice("Score {composite}", { composite: 82 }) === "Score 82",
    "numeric slot interpolates",
  );
  assert(
    formatVoice("Hi {firstName}", {}) === "Hi {firstName}",
    "missing slot left literal",
  );
  assert(
    formatVoice(
      "Last {dim} ({days}d ago): {composite}.",
      { dim: "Clarity", days: 6, composite: 64 },
    ) === "Last Clarity (6d ago): 64.",
    "multi-slot template",
  );
}

// ─── timeOfDayFor ───────────────────────────────────────────────────────
section("timeOfDayFor");
{
  const at = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return timeOfDayFor(d);
  };
  assert(at(7) === "morning", "7am → morning");
  assert(at(12) === "afternoon", "noon → afternoon");
  assert(at(18) === "evening", "6pm → evening");
  assert(at(23) === "late-night", "11pm → late-night");
  assert(at(2) === "late-night", "2am → late-night");
}

// ─── scoreBandKeyFor ────────────────────────────────────────────────────
section("scoreBandKeyFor");
{
  assert(scoreBandKeyFor(20) === "poor", "20 → poor");
  assert(scoreBandKeyFor(50) === "below", "50 → below");
  assert(scoreBandKeyFor(70) === "ok", "70 → ok");
  assert(scoreBandKeyFor(85) === "strong", "85 → strong");
  assert(scoreBandKeyFor(95) === "excellent", "95 → excellent");
  assert(scoreBandKeyFor(null) === "ok", "null → ok (safe default)");
}

// ─── deltaBandFor ───────────────────────────────────────────────────────
section("deltaBandFor");
{
  assert(deltaBandFor(70, null) === "first-ever", "no prior → first-ever");
  assert(deltaBandFor(85, 65) === "breakthrough", "+20 → breakthrough");
  assert(deltaBandFor(75, 70) === "improvement", "+5 → improvement");
  assert(deltaBandFor(70, 70) === "flat", "0 → flat");
  assert(deltaBandFor(60, 70) === "regression", "-10 → regression");
  assert(deltaBandFor(null, 70) === "flat", "no today → flat");
}

// ─── Bucket cardinalities ───────────────────────────────────────────────
section("bucket cardinalities");
{
  for (const tod of ["morning", "afternoon", "evening", "late-night"] as const) {
    assert(
      idleGreeting[tod].length >= 4,
      `idleGreeting.${tod} has ≥4 variants (got ${idleGreeting[tod].length})`,
    );
  }
  for (const feel of ["neutral", "strong-rep", "weak-rep"] as const) {
    assert(
      walkingComments[feel].length >= 8,
      `walkingComments.${feel} has ≥8 (got ${walkingComments[feel].length})`,
    );
  }
  for (const band of ["poor", "below", "ok", "strong", "excellent"] as const) {
    for (const k of ["firstOfDay", "lateInDay"] as const) {
      assert(
        scoreReactions[band][k].length >= 4,
        `scoreReactions.${band}.${k} has ≥4 (got ${scoreReactions[band][k].length})`,
      );
    }
  }
  for (const band of [
    "first-ever",
    "regression",
    "flat",
    "improvement",
    "breakthrough",
  ] as const) {
    assert(
      dayCompleteCelebrations[band].length >= 4,
      `dayCompleteCelebrations.${band} has ≥4`,
    );
  }
  assert(freezeConsumed.length >= 4, "freezeConsumed ≥4");
  assert(partialDay.length >= 4, "partialDay ≥4");
  assert(fullDay.length >= 4, "fullDay ≥4");
  assert(atStationIntroGeneric.length >= 4, "atStationIntroGeneric ≥4");
  for (const reason of [
    "no_transcript",
    "too_short",
    "scoring_failed",
    "timeout",
    "unknown",
  ] as const) {
    assert(
      errorFallbacks[reason].length >= 2,
      `errorFallbacks.${reason} has ≥2`,
    );
  }
}

// ─── Day-comparison templates exist ─────────────────────────────────────
section("day-comparison templates");
{
  for (const key of [
    "firstEver",
    "previousExists",
    "previousStrong",
    "previousWeak",
  ] as const) {
    const t = dayComparisonTemplates[key];
    assert(typeof t === "string" && t.length > 0, `${key} template exists`);
  }
}

// ─── Voice rule: ≤12 words per line (Max's design brief constraint) ────
section("≤12 words per line (excluding {firstName}-inflated lines)");
{
  function wordCount(s: string): number {
    return s
      .replace(/\{\w+\}/g, "X") // collapse slots
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }
  function check(label: string, lines: readonly string[]) {
    for (const line of lines) {
      const wc = wordCount(line);
      assert(
        wc <= 12,
        `[${label}] "${line}" is ${wc} words (limit 12)`,
      );
    }
  }
  for (const tod of Object.keys(idleGreeting) as Array<
    keyof typeof idleGreeting
  >) {
    check(`idleGreeting.${tod}`, idleGreeting[tod]);
  }
  for (const feel of Object.keys(walkingComments) as Array<
    keyof typeof walkingComments
  >) {
    check(`walkingComments.${feel}`, walkingComments[feel]);
  }
  for (const band of Object.keys(scoreReactions) as Array<
    keyof typeof scoreReactions
  >) {
    check(`scoreReactions.${band}.firstOfDay`, scoreReactions[band].firstOfDay);
    check(`scoreReactions.${band}.lateInDay`, scoreReactions[band].lateInDay);
  }
  for (const band of Object.keys(dayCompleteCelebrations) as Array<
    keyof typeof dayCompleteCelebrations
  >) {
    check(`dayCompleteCelebrations.${band}`, dayCompleteCelebrations[band]);
  }
  check("freezeConsumed", freezeConsumed);
  check("partialDay", partialDay);
  check("fullDay", fullDay);
  check("atStationIntroGeneric", atStationIntroGeneric);
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all mascot-voice tests pass`);
