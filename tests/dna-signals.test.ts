/**
 * DNA Ch.11 + Ch.12 + Ch.13 invariants — pure-function unit tests.
 *
 * Covers:
 *   - Text-signal extractors are pure + produce sensible numbers
 *   - Sub-skill mapper covers every sub-skill, scores stay in [0,100]
 *   - encode / decode round-trip for both legacy + v3.1.0 jsonb shapes
 *   - rubric-anchors has all 5 bands × 6 dims = 30 entries
 *
 * Run: npx tsx tests/dna-signals.test.ts
 */

import {
  extractAllTextSignals,
  extractClaritySignals,
  extractStructureSignals,
  extractConcisenessSignals,
  extractThinkingQualitySignals,
  mapSignalsToSubSkillScores,
  toScoresOnly,
  encodeDimensionSignals,
  decodeDimensionSignals,
} from "@/lib/scoring/signals";
import {
  RUBRIC_ANCHORS,
  BAND_RANGES,
  renderAnchorsForDimension,
} from "@/lib/scoring/rubric-anchors";
import { ALL_SUB_SKILLS, SUB_SKILL_TO_DIMENSION } from "@/types/sub-skills";
import { SKILL_DIMENSIONS } from "@/types/domain";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}

function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

// Realistic transcripts spanning the score range (lifted from
// scripts/calibration/reference-reps.json — same band labels apply).
const POOR_TRANSCRIPT =
  "Uh, hello, hello? Is this thing on. Um yeah so basically the product is, like, you know, it's a thing that does, um, automation, sort of? Uh, that's, that's it I guess.";
const POOR_DURATION_MS = 18_000;

const STRONG_TRANSCRIPT =
  "We cut your monthly close from five days to one. Here's how. We ingest your bank feeds, match them against your ledger, and flag the exceptions. Three of your peers are running it now and they've reclaimed 40 hours per close. The CFO at one of them said it was the highest-ROI tool she signed last year. Want me to share their case study and book 15 minutes?";
const STRONG_DURATION_MS = 35_000;

const JARGON_STACK_TRANSCRIPT =
  "An API is an ABI surface mediated by an opaque transport. The endpoints expose typed contracts via serialization layers, and the client orchestrates request lifecycles against a stateless backend. RPC versus REST is the dichotomy.";
const JARGON_STACK_DURATION_MS = 16_000;

const SHALLOW_ORG_TRANSCRIPT =
  "First, four-day work weeks are good. Because productivity. Second, they help retention. Because retention. Third, they signal modernity. Because modernity. Therefore, four-day work weeks make sense. Because sense.";
const SHALLOW_ORG_DURATION_MS = 18_000;

// ————————————————————————————————————————————————————————————————
// Ch.11a — Per-dimension extractors are pure
// ————————————————————————————————————————————————————————————————
section("Ch.11a — extractors are deterministic");

{
  const a1 = extractClaritySignals({
    transcript: POOR_TRANSCRIPT,
    durationMs: POOR_DURATION_MS,
  });
  const a2 = extractClaritySignals({
    transcript: POOR_TRANSCRIPT,
    durationMs: POOR_DURATION_MS,
  });
  assert(
    JSON.stringify(a1) === JSON.stringify(a2),
    "extractClaritySignals: same input → same output",
  );

  const b1 = extractStructureSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const b2 = extractStructureSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    JSON.stringify(b1) === JSON.stringify(b2),
    "extractStructureSignals: same input → same output",
  );

  const c1 = extractConcisenessSignals({
    transcript: POOR_TRANSCRIPT,
    durationMs: POOR_DURATION_MS,
  });
  const c2 = extractConcisenessSignals({
    transcript: POOR_TRANSCRIPT,
    durationMs: POOR_DURATION_MS,
  });
  assert(
    JSON.stringify(c1) === JSON.stringify(c2),
    "extractConcisenessSignals: same input → same output",
  );

  const d1 = extractThinkingQualitySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const d2 = extractThinkingQualitySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    JSON.stringify(d1) === JSON.stringify(d2),
    "extractThinkingQualitySignals: same input → same output",
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.11a — Signals correlate with quality across reference reps
// ————————————————————————————————————————————————————————————————
section("Ch.11a — signals correlate with quality");

{
  // Hedge rate: poor rep has many ("sort of", "I guess"), strong rep has none.
  const poorHedge = extractConcisenessSignals({
    transcript: POOR_TRANSCRIPT,
    durationMs: POOR_DURATION_MS,
  }).hedgeRatePerMinute;
  const strongHedge = extractConcisenessSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  }).hedgeRatePerMinute;
  assert(
    poorHedge > strongHedge,
    `hedge rate: poor (${poorHedge}/min) > strong (${strongHedge}/min)`,
  );

  // Jargon: jargon-stacked rep has VERY high jargon (target <1, actual ~15).
  const jargonStacked = extractClaritySignals({
    transcript: JARGON_STACK_TRANSCRIPT,
    durationMs: JARGON_STACK_DURATION_MS,
  }).jargonRatePerMinute;
  assert(
    jargonStacked >= 5,
    `jargon-stacked rep clarity.jargonRatePerMinute=${jargonStacked} ≥ 5`,
  );

  // Strong business pitch should NOT trigger the jargon detector — CFO/ROI
  // are 3-letter acronyms intentionally exempted.
  const strongJargon = extractClaritySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  }).jargonRatePerMinute;
  assert(
    strongJargon <= 3,
    `strong-pitch clarity.jargonRatePerMinute=${strongJargon} ≤ 3 (acronym exemption)`,
  );

  // Shallow-but-organized rep should have visible transitions
  // ("First/Second/Third/Therefore") AND zero counterargument markers.
  const shallowStruct = extractStructureSignals({
    transcript: SHALLOW_ORG_TRANSCRIPT,
    durationMs: SHALLOW_ORG_DURATION_MS,
  });
  assert(
    shallowStruct.transitionMarkerCount >= 4,
    `shallow-organized transitionMarkerCount=${shallowStruct.transitionMarkerCount} ≥ 4`,
  );
  const shallowTQ = extractThinkingQualitySignals({
    transcript: SHALLOW_ORG_TRANSCRIPT,
    durationMs: SHALLOW_ORG_DURATION_MS,
  });
  assert(
    shallowTQ.counterargumentMarkers === 0,
    `shallow-organized counterargumentMarkers=${shallowTQ.counterargumentMarkers} === 0`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.11a — Composer returns valid bundle with meta
// ————————————————————————————————————————————————————————————————
section("Ch.11a — extractAllTextSignals composer");

{
  const bundle = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(typeof bundle.clarity === "object", "bundle.clarity present");
  assert(typeof bundle.structure === "object", "bundle.structure present");
  assert(typeof bundle.conciseness === "object", "bundle.conciseness present");
  assert(
    typeof bundle.thinking_quality === "object",
    "bundle.thinking_quality present",
  );
  assert(
    bundle.meta.wordCount > 0 && bundle.meta.durationMinutes > 0,
    "bundle.meta has positive wordCount + durationMinutes",
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.11b — Sub-skill mapper covers every sub-skill, scores in [0,100]
// ————————————————————————————————————————————————————————————————
section("Ch.11b — sub-skill mapper coverage + bounds");

{
  const signals = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const dimMap = {
    clarity: 80,
    structure: 78,
    conciseness: 75,
    thinking_quality: 72,
    delivery: 70,
    tone: 70,
  };
  const map = mapSignalsToSubSkillScores(signals, dimMap);

  // Every sub-skill in ALL_SUB_SKILLS is covered.
  for (const subSkill of ALL_SUB_SKILLS) {
    assert(
      map[subSkill] != null,
      `sub-skill "${subSkill}" populated in mapper output`,
    );
  }

  // Every score in [0, 100].
  for (const [k, v] of Object.entries(map)) {
    if (!v) continue;
    assert(
      v.score >= 0 && v.score <= 100,
      `sub-skill ${k}.score=${v.score} in [0,100]`,
    );
  }

  // toScoresOnly strips the signalSource trail.
  const slim = toScoresOnly(map);
  assert(
    Object.keys(slim).length === ALL_SUB_SKILLS.length,
    `toScoresOnly returns ${Object.keys(slim).length} entries (expected ${ALL_SUB_SKILLS.length})`,
  );

  // Sub-skill values match the underlying mapper score.
  for (const [k, score] of Object.entries(slim)) {
    assert(
      score === map[k as keyof typeof map]!.score,
      `toScoresOnly preserves ${k} score`,
    );
  }
}

// ————————————————————————————————————————————————————————————————
// Ch.11b — Mapper differentiates poor / strong / jargon-stacked reps
// ————————————————————————————————————————————————————————————————
section("Ch.11b — mapper differentiates rep quality");

{
  const dimFallbacks = {
    clarity: 50,
    structure: 50,
    conciseness: 50,
    thinking_quality: 50,
    delivery: 50,
    tone: 50,
  };
  const poorSignals = extractAllTextSignals({
    transcript: POOR_TRANSCRIPT,
    durationMs: POOR_DURATION_MS,
  });
  const strongSignals = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const jargonSignals = extractAllTextSignals({
    transcript: JARGON_STACK_TRANSCRIPT,
    durationMs: JARGON_STACK_DURATION_MS,
  });

  const poorMap = mapSignalsToSubSkillScores(poorSignals, dimFallbacks);
  const strongMap = mapSignalsToSubSkillScores(strongSignals, dimFallbacks);
  const jargonMap = mapSignalsToSubSkillScores(jargonSignals, dimFallbacks);

  // word_choice: jargon-stacked < poor < strong (since strong has 0 jargon
  // and jargon-stacked has ~15/min).
  assert(
    jargonMap.word_choice!.score < strongMap.word_choice!.score,
    `word_choice: jargon-stacked (${jargonMap.word_choice!.score}) < strong (${strongMap.word_choice!.score})`,
  );

  // hedging_awareness: poor < strong (poor has 6.67/min hedges, strong 0).
  assert(
    poorMap.hedging_awareness!.score < strongMap.hedging_awareness!.score,
    `hedging_awareness: poor (${poorMap.hedging_awareness!.score}) < strong (${strongMap.hedging_awareness!.score})`,
  );

  // claim_support: poor (0% support) < strong (≥0.5).
  assert(
    poorMap.claim_support!.score <= strongMap.claim_support!.score,
    `claim_support: poor (${poorMap.claim_support!.score}) ≤ strong (${strongMap.claim_support!.score})`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.11c — Storage encode/decode round-trips both shapes
// ————————————————————————————————————————————————————————————————
section("Ch.11c — encode/decode round-trip");

{
  // Legacy path: no subSkillScores → string[] shape preserved.
  const narratives = ["jargon rate 0", "tight close"];
  const encodedLegacy = encodeDimensionSignals(narratives);
  assert(
    Array.isArray(encodedLegacy),
    "encode without subSkillScores → array (legacy shape)",
  );
  const decodedLegacy = decodeDimensionSignals(encodedLegacy);
  assert(
    decodedLegacy.subSkillScores === undefined &&
      JSON.stringify(decodedLegacy.narratives) === JSON.stringify(narratives),
    "decode legacy: narratives preserved, no subSkillScores",
  );

  // Ch.11c path: object shape with both fields.
  const subSkillScores = { word_choice: 80, signposting: 65 };
  const encodedNew = encodeDimensionSignals(narratives, subSkillScores);
  assert(
    !Array.isArray(encodedNew) && typeof encodedNew === "object",
    "encode with subSkillScores → object shape",
  );
  const decodedNew = decodeDimensionSignals(encodedNew);
  assert(
    decodedNew.subSkillScores != null &&
      decodedNew.subSkillScores.word_choice === 80 &&
      decodedNew.subSkillScores.signposting === 65,
    "decode v3.1: subSkillScores preserved",
  );
  assert(
    JSON.stringify(decodedNew.narratives) === JSON.stringify(narratives),
    "decode v3.1: narratives preserved",
  );

  // Robust to malformed: non-array non-object input → empty narratives.
  const decodedNull = decodeDimensionSignals(null);
  assert(
    decodedNull.narratives.length === 0 &&
      decodedNull.subSkillScores === undefined,
    "decode null → empty narratives, no subSkillScores",
  );

  // Empty subSkillScores object → encoder falls back to legacy shape.
  const encodedEmpty = encodeDimensionSignals(narratives, {});
  assert(
    Array.isArray(encodedEmpty),
    "encode with empty subSkillScores → array (legacy fallback)",
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.13 — Rubric anchors complete: 6 dims × 5 bands = 30 entries
// ————————————————————————————————————————————————————————————————
section("Ch.13 — rubric-anchors completeness");

{
  for (const dim of SKILL_DIMENSIONS) {
    const anchors = RUBRIC_ANCHORS[dim];
    assert(
      anchors.length === 5,
      `rubric-anchors[${dim}] has 5 entries (got ${anchors.length})`,
    );
    for (let i = 0; i < anchors.length; i++) {
      assert(
        typeof anchors[i] === "string" && anchors[i]!.length > 0,
        `rubric-anchors[${dim}][${i}] is non-empty string`,
      );
    }
  }
  assert(BAND_RANGES.length === 5, `BAND_RANGES has 5 entries`);
  // Render returns lines for every band.
  const rendered = renderAnchorsForDimension("clarity");
  assert(
    rendered.split("\n").length === 5,
    `renderAnchorsForDimension("clarity") returns 5 lines`,
  );
}

// ————————————————————————————————————————————————————————————————
// Sub-skill consistency: every sub-skill in ALL_SUB_SKILLS has a
// dimension mapping, and every dim has at least one sub-skill.
// ————————————————————————————————————————————————————————————————
section("Sub-skill <-> dimension mapping consistency");

{
  for (const subSkill of ALL_SUB_SKILLS) {
    const dim = SUB_SKILL_TO_DIMENSION[subSkill];
    assert(
      (SKILL_DIMENSIONS as readonly string[]).includes(dim),
      `sub-skill "${subSkill}" maps to a known dim (got ${dim})`,
    );
  }
  // Every dim has ≥1 sub-skill.
  const seenDims = new Set<string>();
  for (const subSkill of ALL_SUB_SKILLS) {
    seenDims.add(SUB_SKILL_TO_DIMENSION[subSkill]);
  }
  for (const dim of SKILL_DIMENSIONS) {
    assert(seenDims.has(dim), `dimension "${dim}" has at least one sub-skill`);
  }
}

// ————————————————————————————————————————————————————————————————
// Summary
// ————————————————————————————————————————————————————————————————
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
