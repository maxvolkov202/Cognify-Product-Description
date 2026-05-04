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
import {
  ALL_EXERCISES,
  EXERCISES_BY_DIMENSION,
  primaryExerciseFor,
  getPrimaryExerciseForSubSkill,
} from "@/lib/ai/exercises";
import { planFocusWorkout } from "@/lib/ai/workout-prompts";
import {
  aggregateHumePredictions,
  HUME_EMOTION_NAMES,
  getHumeEmotionMean,
  getHumeEmotionVariance,
} from "@/lib/audio/hume-prosody";
import { hasWorkerProsody } from "@/lib/audio/prosody";

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
// Ch.16 — Exercise catalog completeness + consistency
// ————————————————————————————————————————————————————————————————
section("Ch.16 — exercise catalog");

{
  // 18 exercises (3 per dim × 6 dims) per master plan.
  assert(
    ALL_EXERCISES.length === 18,
    `ALL_EXERCISES has 18 entries (got ${ALL_EXERCISES.length})`,
  );

  // Every dim has exactly 3 exercises.
  for (const dim of SKILL_DIMENSIONS) {
    const count = EXERCISES_BY_DIMENSION[dim].length;
    assert(
      count === 3,
      `EXERCISES_BY_DIMENSION[${dim}] has 3 entries (got ${count})`,
    );
  }

  // Every exercise's dimension matches the bucket it lives in.
  for (const dim of SKILL_DIMENSIONS) {
    for (const ex of EXERCISES_BY_DIMENSION[dim]) {
      assert(
        ex.dimension === dim,
        `exercise "${ex.id}" lists dimension=${ex.dimension}, found in EXERCISES_BY_DIMENSION[${dim}]`,
      );
    }
  }

  // Every targetSubSkill on every exercise belongs to that exercise's dim.
  for (const ex of ALL_EXERCISES) {
    for (const sub of ex.targetSubSkills) {
      assert(
        SUB_SKILL_TO_DIMENSION[sub] === ex.dimension,
        `exercise "${ex.id}" targets sub-skill "${sub}" but that sub-skill belongs to dim "${SUB_SKILL_TO_DIMENSION[sub]}", not "${ex.dimension}"`,
      );
    }
  }

  // primaryExerciseFor returns deterministically without preferSubSkill.
  for (const dim of SKILL_DIMENSIONS) {
    const a = primaryExerciseFor(dim);
    const b = primaryExerciseFor(dim);
    assert(a.id === b.id, `primaryExerciseFor(${dim}) is deterministic`);
  }

  // primaryExerciseFor with preferSubSkill returns the exercise that
  // targets it (when one exists).
  const ex = primaryExerciseFor("clarity", "word_choice");
  assert(
    ex.targetSubSkills.includes("word_choice"),
    `primaryExerciseFor("clarity", "word_choice") returns an exercise that targets word_choice (got ${ex.id})`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.16b — Sub-skill → primary exercise reverse lookup
// ————————————————————————————————————————————————————————————————
section("Ch.16b — getPrimaryExerciseForSubSkill");

{
  // Every sub-skill listed in any exercise's targetSubSkills resolves
  // to an exercise.
  for (const ex of ALL_EXERCISES) {
    for (const sub of ex.targetSubSkills) {
      const owner = getPrimaryExerciseForSubSkill(sub);
      assert(
        owner != null,
        `getPrimaryExerciseForSubSkill("${sub}") returns an exercise`,
      );
      assert(
        owner!.targetSubSkills.includes(sub),
        `owner exercise for "${sub}" actually targets it (got ${owner!.id})`,
      );
    }
  }

  // Sub-skills NOT listed by any exercise return undefined. From the
  // catalog, volume_control / intellectual_honesty / repetition_control
  // aren't directly targeted by any exercise — they ride the dim's
  // holistic training. (If exercises change, this list can drift; the
  // test confirms the lookup table behaves correctly when it does.)
  const uncoveredCount = [
    "volume_control",
    "intellectual_honesty",
    "repetition_control",
  ].filter(
    (s) =>
      getPrimaryExerciseForSubSkill(s as Parameters<typeof getPrimaryExerciseForSubSkill>[0]) === undefined,
  ).length;
  assert(
    uncoveredCount >= 1,
    `at least one of {volume_control, intellectual_honesty, repetition_control} is uncovered (got ${uncoveredCount})`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.16b — planFocusWorkout drill-bank routing
// ————————————————————————————————————————————————————————————————
section("Ch.16b — planFocusWorkout preferSubSkill routes through drill bank");

{
  // Without preferSubSkill, planFocusWorkout uses the rep-type path —
  // prompt ids look like rep-type ids (no specific shape contract, but
  // not the drill bank's `tq_*` / `dl_*` / `tn_*` ids).
  const legacyPlan = planFocusWorkout({
    focusDimension: "delivery",
    count: 4,
  });
  const legacyFirstRepIds = legacyPlan.reps[0]?.promptIds ?? [];
  assert(
    legacyFirstRepIds.length > 0,
    `legacy plan first rep has prompt ids`,
  );
  const legacyHasDrillIds = legacyFirstRepIds.some((id) =>
    /^(dl|tq|tn)_/.test(id),
  );
  assert(
    !legacyHasDrillIds,
    `legacy plan does NOT contain drill-bank ids (got ${legacyFirstRepIds.slice(0, 2).join(", ")})`,
  );

  // With preferSubSkill on a drillable dim, prompts come from the
  // drill bank — ids match the dl_/tq_/tn_ pattern.
  const drillPlan = planFocusWorkout({
    focusDimension: "delivery",
    count: 4,
    preferSubSkill: "strategic_pausing",
  });
  const drillFirstRepIds = drillPlan.reps[0]?.promptIds ?? [];
  assert(
    drillFirstRepIds.length > 0,
    `drill-routed plan first rep has prompt ids`,
  );
  const drillHasDrillIds = drillFirstRepIds.every((id) => /^dl_/.test(id));
  assert(
    drillHasDrillIds,
    `drill-routed plan first rep IDs all match /^dl_/ (got ${drillFirstRepIds.join(", ")})`,
  );

  // The drill prompts should be biased toward strategic_pausing —
  // /^dl_sp_/ is the convention from delivery.ts (sp = strategic_pausing).
  const stratPausingCount = drillFirstRepIds.filter((id) =>
    /^dl_sp_/.test(id),
  ).length;
  assert(
    stratPausingCount >= 1,
    `drill-routed plan biased toward strategic_pausing (got ${stratPausingCount} / ${drillFirstRepIds.length} matching dl_sp_)`,
  );

  // Non-drillable dim with preferSubSkill — bias is ignored, falls
  // back to rep-type path. clarity isn't drillable.
  const claritySubSkill = planFocusWorkout({
    focusDimension: "clarity",
    count: 4,
    preferSubSkill: "word_choice",
  });
  const cIds = claritySubSkill.reps[0]?.promptIds ?? [];
  const cHasDrillIds = cIds.some((id) => /^(dl|tq|tn)_/.test(id));
  assert(
    !cHasDrillIds,
    `clarity (non-drillable) ignores preferSubSkill and uses rep-type path`,
  );

  // Sub-skill from a different dim than focus — ignored (defensive).
  const mismatched = planFocusWorkout({
    focusDimension: "delivery",
    count: 4,
    preferSubSkill: "word_choice", // belongs to clarity, not delivery
  });
  const mIds = mismatched.reps[0]?.promptIds ?? [];
  const mHasDrillIds = mIds.every((id) => /^dl_/.test(id));
  assert(
    !mHasDrillIds,
    `mismatched preferSubSkill (clarity sub-skill on delivery dim) does NOT trigger drill-bank routing`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.S1 — ideaDensity + wordPrecisionScore + sub-skill rewiring
// ————————————————————————————————————————————————————————————————
section("Ch.S1 — ideaDensity + wordPrecisionScore");

{
  // Determinism: same transcript → same idea density / precision score.
  const idem1 = extractClaritySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const idem2 = extractClaritySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    idem1.ideaDensity === idem2.ideaDensity,
    `S1 ideaDensity is deterministic (${idem1.ideaDensity})`,
  );
  assert(
    idem1.wordPrecisionScore === idem2.wordPrecisionScore,
    `S1 wordPrecisionScore is deterministic (${idem1.wordPrecisionScore})`,
  );

  // ideaDensity bounds: never negative, finite even on empty-ish input.
  const trivial = extractClaritySignals({
    transcript: "Hi.",
    durationMs: 1000,
  });
  assert(
    trivial.ideaDensity >= 0 && Number.isFinite(trivial.ideaDensity),
    `S1 ideaDensity stays finite & non-negative on minimal input (${trivial.ideaDensity})`,
  );

  // Concrete-vocabulary transcript scores HIGH on word precision.
  const concrete = extractClaritySignals({
    transcript:
      "I unlocked the door, walked into the kitchen, opened the fridge, picked up the milk and bread, and made breakfast on a yellow plate.",
    durationMs: 12000,
  });
  assert(
    concrete.wordPrecisionScore >= 60,
    `S1 concrete-vocabulary rep wordPrecisionScore=${concrete.wordPrecisionScore} ≥ 60`,
  );

  // Abstract-only transcript scores LOW on word precision.
  const abstract = extractClaritySignals({
    transcript:
      "We need to ensure alignment, accountability, and resilience to drive innovation, productivity, and excellence across the entire organization with integrity and purpose.",
    durationMs: 12000,
  });
  assert(
    abstract.wordPrecisionScore <= 50,
    `S1 abstract-vocabulary rep wordPrecisionScore=${abstract.wordPrecisionScore} ≤ 50`,
  );

  // Concrete > abstract on the same length transcripts (key independence
  // assertion — the precision signal is doing real work).
  assert(
    concrete.wordPrecisionScore > abstract.wordPrecisionScore,
    `S1 concrete (${concrete.wordPrecisionScore}) > abstract (${abstract.wordPrecisionScore}) on word precision`,
  );

  // ideaDensity: sentence with many distinct nouns scores HIGHER density
  // than sentence with the same idea repeated.
  const denseIdeas = extractClaritySignals({
    transcript:
      "The customer wants pricing transparency, a refund window, integration with their existing tools, and a vendor with experience in regulated industries.",
    durationMs: 10000,
  });
  const oneIdea = extractClaritySignals({
    transcript:
      "The customer wants pricing. The customer wants pricing. The customer wants pricing. The customer wants pricing.",
    durationMs: 10000,
  });
  assert(
    denseIdeas.ideaDensity > oneIdea.ideaDensity,
    `S1 dense-idea rep ideaDensity=${denseIdeas.ideaDensity} > repetitive ideaDensity=${oneIdea.ideaDensity}`,
  );

  // Stopwords are excluded from idea-density count: a transcript of
  // pure stopwords has near-zero density.
  const stopwordsOnly = extractClaritySignals({
    transcript: "The. And. Or. But. So. Yes. No.",
    durationMs: 5000,
  });
  assert(
    stopwordsOnly.ideaDensity < 0.5,
    `S1 stopword-only ideaDensity=${stopwordsOnly.ideaDensity} < 0.5`,
  );

  // wordPrecisionScore range bounds.
  assert(
    concrete.wordPrecisionScore >= 0 && concrete.wordPrecisionScore <= 100,
    `S1 wordPrecisionScore in [0,100] (${concrete.wordPrecisionScore})`,
  );
  assert(
    abstract.wordPrecisionScore >= 0 && abstract.wordPrecisionScore <= 100,
    `S1 wordPrecisionScore in [0,100] for abstract too (${abstract.wordPrecisionScore})`,
  );

  // Sub-skill rewiring: precision sub-skill is now driven by
  // wordPrecisionScore, NOT sentenceComplexityIndex.
  const concreteAll = extractAllTextSignals({
    transcript:
      "I unlocked the door, walked into the kitchen, opened the fridge, picked up the milk and bread, and made breakfast on a yellow plate.",
    durationMs: 12000,
  });
  const abstractAll = extractAllTextSignals({
    transcript:
      "We need to ensure alignment, accountability, and resilience to drive innovation, productivity, and excellence across the entire organization with integrity and purpose.",
    durationMs: 12000,
  });
  const concreteMap = mapSignalsToSubSkillScores(concreteAll, {
    clarity: 70,
    structure: 70,
    conciseness: 70,
    thinking_quality: 70,
    delivery: 70,
    tone: 70,
  });
  const abstractMap = mapSignalsToSubSkillScores(abstractAll, {
    clarity: 70,
    structure: 70,
    conciseness: 70,
    thinking_quality: 70,
    delivery: 70,
    tone: 70,
  });
  assert(
    (concreteMap.precision?.score ?? 0) > (abstractMap.precision?.score ?? 0),
    `S1 precision sub-skill differentiates concrete (${concreteMap.precision?.score}) > abstract (${abstractMap.precision?.score})`,
  );
  assert(
    concreteMap.precision?.signalSource?.startsWith("wordPrecisionScore"),
    `S1 precision sub-skill signalSource is wordPrecisionScore (was sentenceComplexityIndex pre-S1)`,
  );

  // logical_sequencing now exists as a text-driven sub-skill (was
  // dimension_fallback pre-S1).
  assert(
    concreteMap.logical_sequencing?.signalSource?.startsWith(
      "sentenceComplexityIndex",
    ),
    `S1 logical_sequencing sub-skill signalSource is sentenceComplexityIndex`,
  );

  // idea_isolation now exists as a text-driven sub-skill.
  assert(
    concreteMap.idea_isolation != null,
    `S1 idea_isolation sub-skill is text-driven (not dimension_fallback)`,
  );
  assert(
    concreteMap.idea_isolation!.signalSource?.startsWith("ideaDensity"),
    `S1 idea_isolation signalSource is ideaDensity`,
  );

  // SIGNALS block renders the new fields.
  const allSignals = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    typeof allSignals.clarity.ideaDensity === "number",
    `S1 TextSignals.clarity.ideaDensity is a number`,
  );
  assert(
    typeof allSignals.clarity.wordPrecisionScore === "number",
    `S1 TextSignals.clarity.wordPrecisionScore is a number`,
  );

  // Plurals are normalized: "cars" stems to "car" (in lexicon at 5.0).
  const plural = extractClaritySignals({
    transcript: "The cars on the streets pass houses every minute.",
    durationMs: 5000,
  });
  assert(
    plural.wordPrecisionScore >= 50,
    `S1 plural-aware lookup: 'cars/streets/houses' → wordPrecisionScore=${plural.wordPrecisionScore} ≥ 50`,
  );

  // Out-of-vocabulary tokens (proper nouns, numbers) don't dominate
  // the score — falls back to neutral 50 when no in-lex tokens present.
  const oov = extractClaritySignals({
    transcript: "Klaviyo Hubspot Marketo Bombora Pardot Drift Mailchimp Outreach.",
    durationMs: 5000,
  });
  assert(
    oov.wordPrecisionScore === 50,
    `S1 OOV-only transcript falls back to neutral 50 (got ${oov.wordPrecisionScore})`,
  );

  // Empty transcript guard: ideaDensity returns 0 (not NaN).
  const empty = extractClaritySignals({
    transcript: "",
    durationMs: 5000,
  });
  assert(
    empty.ideaDensity === 0 && Number.isFinite(empty.ideaDensity),
    `S1 empty-transcript ideaDensity=0 (not NaN)`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.S2 — logicalFlowScore + coherenceIndex Structure signals
// ————————————————————————————————————————————————————————————————
section("Ch.S2 — logicalFlowScore + coherenceIndex");

{
  // Determinism.
  const det1 = extractStructureSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const det2 = extractStructureSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    det1.logicalFlowScore === det2.logicalFlowScore,
    `S2 logicalFlowScore deterministic (${det1.logicalFlowScore})`,
  );
  assert(
    det1.coherenceIndex === det2.coherenceIndex,
    `S2 coherenceIndex deterministic (${det1.coherenceIndex})`,
  );

  // Bounds: both signals in [0,100].
  assert(
    det1.logicalFlowScore >= 0 && det1.logicalFlowScore <= 100,
    `S2 logicalFlowScore in [0,100] (${det1.logicalFlowScore})`,
  );
  assert(
    det1.coherenceIndex >= 0 && det1.coherenceIndex <= 100,
    `S2 coherenceIndex in [0,100] (${det1.coherenceIndex})`,
  );

  // Connector-led flow: rep that explicitly chains "because/therefore"
  // scores HIGHER on logicalFlowScore than rep that jumps topics.
  const connected = extractStructureSignals({
    transcript:
      "We need to raise prices. Because our costs went up. Therefore margins are squeezed. As a result, profitability fell. So we have no choice. This means we act now.",
    durationMs: 14000,
  });
  const jumpy = extractStructureSignals({
    transcript:
      "Pricing is on the agenda. The new office is great. I love coffee. The team's morale is high. Customers want refunds. Mountains are tall.",
    durationMs: 14000,
  });
  assert(
    connected.logicalFlowScore > jumpy.logicalFlowScore,
    `S2 connected (${connected.logicalFlowScore}) > jumpy (${jumpy.logicalFlowScore}) on flow`,
  );

  // Coherence: rep that introduces a topic and stays on it scores
  // HIGHER on coherenceIndex than a rep that drifts.
  const onTopic = extractStructureSignals({
    transcript:
      "The pricing decision is hard. Pricing depends on costs. Pricing also depends on competitor moves. Our pricing is currently too low. Pricing is the lever.",
    durationMs: 12000,
  });
  const drift = extractStructureSignals({
    transcript:
      "The pricing decision is hard. We had a great offsite. The mountain biking trail was new. Coffee in the kitchen tasted weird. The dog needs a walk.",
    durationMs: 12000,
  });
  assert(
    onTopic.coherenceIndex > drift.coherenceIndex,
    `S2 on-topic coherenceIndex=${onTopic.coherenceIndex} > drift=${drift.coherenceIndex}`,
  );

  // Single-sentence transcript: returns neutral 50 on flow + coherence
  // (no adjacent pairs to compare).
  const single = extractStructureSignals({
    transcript: "Just one sentence here.",
    durationMs: 4000,
  });
  assert(
    single.logicalFlowScore === 50,
    `S2 single-sentence logicalFlowScore=50 (got ${single.logicalFlowScore})`,
  );
  assert(
    single.coherenceIndex === 50,
    `S2 single-sentence coherenceIndex=50 (got ${single.coherenceIndex})`,
  );

  // Sub-skill rewiring: coherence sub-skill is now text-driven.
  const connectedAll = extractAllTextSignals({
    transcript:
      "We need to raise prices. Because our costs went up. Therefore margins are squeezed. As a result, profitability fell. So we have no choice. This means we act now.",
    durationMs: 14000,
  });
  const drifted = extractAllTextSignals({
    transcript:
      "The pricing decision is hard. We had a great offsite. The mountain biking trail was new. Coffee in the kitchen tasted weird. The dog needs a walk.",
    durationMs: 12000,
  });
  const dims: Partial<Record<"clarity" | "structure" | "conciseness" | "thinking_quality" | "delivery" | "tone", number>> = {
    clarity: 70,
    structure: 70,
    conciseness: 70,
    thinking_quality: 70,
    delivery: 70,
    tone: 70,
  };
  const connectedMap = mapSignalsToSubSkillScores(connectedAll, dims);
  const driftedMap = mapSignalsToSubSkillScores(drifted, dims);
  assert(
    connectedMap.coherence != null,
    `S2 coherence sub-skill is text-driven (was dimension_fallback)`,
  );
  assert(
    (connectedMap.coherence?.score ?? 0) > (driftedMap.coherence?.score ?? 0),
    `S2 coherence sub-skill differentiates connected (${connectedMap.coherence?.score}) > drifted (${driftedMap.coherence?.score})`,
  );
  assert(
    connectedMap.coherence?.signalSource?.includes("logicalFlow") ?? false,
    `S2 coherence signalSource includes logicalFlow + coherenceIndex`,
  );

  // argument_hierarchy now blends hierarchy markers + flow.
  assert(
    connectedMap.argument_hierarchy?.signalSource?.includes("flow") ?? false,
    `S2 argument_hierarchy signalSource now includes flow score`,
  );

  // SIGNALS-block renderer surfaces the new fields.
  const allSig = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    typeof allSig.structure.logicalFlowScore === "number",
    `S2 TextSignals.structure.logicalFlowScore is a number`,
  );
  assert(
    typeof allSig.structure.coherenceIndex === "number",
    `S2 TextSignals.structure.coherenceIndex is a number`,
  );

  // Empty transcript guard: returns 50 (single-sentence path), not NaN.
  const empty2 = extractStructureSignals({
    transcript: "",
    durationMs: 5000,
  });
  assert(
    empty2.logicalFlowScore === 50 && Number.isFinite(empty2.logicalFlowScore),
    `S2 empty-transcript logicalFlowScore=50 (not NaN)`,
  );
  assert(
    empty2.coherenceIndex === 50 && Number.isFinite(empty2.coherenceIndex),
    `S2 empty-transcript coherenceIndex=50 (not NaN)`,
  );

  // Two-sentence rep: minimum input for non-degenerate flow score.
  const twoSent = extractStructureSignals({
    transcript: "The product is launching. We are excited.",
    durationMs: 5000,
  });
  assert(
    Number.isFinite(twoSent.logicalFlowScore) &&
      twoSent.logicalFlowScore >= 0 &&
      twoSent.logicalFlowScore <= 100,
    `S2 two-sentence logicalFlowScore is finite in [0,100] (${twoSent.logicalFlowScore})`,
  );

  // Repeated-noun overlap drives high topic continuity.
  const repeatedNoun = extractStructureSignals({
    transcript:
      "Pricing is the issue. Pricing affects everything. Pricing is on the agenda. Pricing decisions matter.",
    durationMs: 8000,
  });
  assert(
    repeatedNoun.logicalFlowScore >= 50,
    `S2 repeated-noun rep logicalFlowScore=${repeatedNoun.logicalFlowScore} ≥ 50 (overlap drives flow)`,
  );

  // Off-topic drift sentences pull coherence down even when individual
  // sentences are well-formed.
  const halfDrift = extractStructureSignals({
    transcript:
      "The pricing strategy needs revision. Costs are rising. Margins are tight. The dog needs a bath. The car broke down. The kitchen is messy.",
    durationMs: 14000,
  });
  assert(
    halfDrift.coherenceIndex < 80,
    `S2 half-drift rep coherenceIndex=${halfDrift.coherenceIndex} < 80 (drift detected)`,
  );

  // Stop-words alone do NOT count as content overlap.
  const stopwordChain = extractStructureSignals({
    transcript:
      "It is so. The is the. And the and. The is. The and the.",
    durationMs: 8000,
  });
  assert(
    stopwordChain.logicalFlowScore <= 50,
    `S2 stopword-only chain logicalFlowScore=${stopwordChain.logicalFlowScore} ≤ 50 (stopwords aren't content)`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.S3 — stoppingPointAccuracy Conciseness signal
// ————————————————————————————————————————————————————————————————
section("Ch.S3 — stoppingPointAccuracy");

{
  // Determinism + bounds.
  const det = extractConcisenessSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const det2 = extractConcisenessSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    det.stoppingPointAccuracy === det2.stoppingPointAccuracy,
    `S3 stoppingPointAccuracy deterministic (${det.stoppingPointAccuracy})`,
  );
  assert(
    det.stoppingPointAccuracy >= 0 && det.stoppingPointAccuracy <= 100,
    `S3 stoppingPointAccuracy in [0,100] (${det.stoppingPointAccuracy})`,
  );

  // Clean stop: declarative final sentence ending in period.
  const clean = extractConcisenessSignals({
    transcript:
      "We will ship the feature on Friday. The team is ready. The bottom line is, we are launching.",
    durationMs: 8000,
  });
  assert(
    clean.stoppingPointAccuracy >= 80,
    `S3 clean stop stoppingPointAccuracy=${clean.stoppingPointAccuracy} ≥ 80 (period + closing-tone marker)`,
  );

  // Trail-off: ends in "yeah" or "you know" or "so".
  const trailYeah = extractConcisenessSignals({
    transcript: "We will ship the feature soon. The team is mostly ready. So, yeah.",
    durationMs: 7000,
  });
  assert(
    trailYeah.stoppingPointAccuracy <= 50,
    `S3 trail-off-yeah stoppingPointAccuracy=${trailYeah.stoppingPointAccuracy} ≤ 50`,
  );

  const trailYouKnow = extractConcisenessSignals({
    transcript: "We are working on it and looking at the data, you know.",
    durationMs: 6000,
  });
  assert(
    trailYouKnow.stoppingPointAccuracy <= 60,
    `S3 trail-off "you know" stoppingPointAccuracy=${trailYouKnow.stoppingPointAccuracy} ≤ 60`,
  );

  // Late hedge: "kind of" / "i think" inside last 5 tokens of final
  // sentence drags the score down even if punctuation is fine.
  const lateHedge = extractConcisenessSignals({
    transcript:
      "We will ship the feature on Friday. I think the team is mostly ready, kind of.",
    durationMs: 7000,
  });
  assert(
    lateHedge.stoppingPointAccuracy < clean.stoppingPointAccuracy,
    `S3 late-hedge final sentence (${lateHedge.stoppingPointAccuracy}) < clean stop (${clean.stoppingPointAccuracy})`,
  );

  // Question / exclamation close: penalized vs declarative period.
  const questionClose = extractConcisenessSignals({
    transcript: "Why does pricing matter? Because customers reject high prices?",
    durationMs: 6000,
  });
  assert(
    questionClose.stoppingPointAccuracy < clean.stoppingPointAccuracy,
    `S3 question-close (${questionClose.stoppingPointAccuracy}) < period-close (${clean.stoppingPointAccuracy})`,
  );

  // Single-word affirmation "Yes." — short but technically clean. The
  // length penalty (-20 for <4 words) drops it below "clean" but it
  // still earns punctuation credit.
  const oneWord = extractConcisenessSignals({
    transcript: "Yes.",
    durationMs: 2000,
  });
  assert(
    oneWord.stoppingPointAccuracy < clean.stoppingPointAccuracy,
    `S3 one-word-affirmation (${oneWord.stoppingPointAccuracy}) < ≥4-word clean stop (${clean.stoppingPointAccuracy})`,
  );

  // Empty transcript: returns neutral 50 (not NaN).
  const empty3 = extractConcisenessSignals({
    transcript: "",
    durationMs: 5000,
  });
  assert(
    empty3.stoppingPointAccuracy === 50 && Number.isFinite(empty3.stoppingPointAccuracy),
    `S3 empty stoppingPointAccuracy=50 (not NaN)`,
  );

  // Sub-skill rewiring: editing_in_real_time is now text-driven.
  const cleanAll = extractAllTextSignals({
    transcript:
      "We will ship the feature on Friday. The team is ready. The bottom line is, we are launching.",
    durationMs: 8000,
  });
  const trailAll = extractAllTextSignals({
    transcript: "We will ship the feature soon. The team is mostly ready. So, yeah.",
    durationMs: 7000,
  });
  const dimsS3: Partial<Record<"clarity" | "structure" | "conciseness" | "thinking_quality" | "delivery" | "tone", number>> = {
    clarity: 70,
    structure: 70,
    conciseness: 70,
    thinking_quality: 70,
    delivery: 70,
    tone: 70,
  };
  const cleanMap = mapSignalsToSubSkillScores(cleanAll, dimsS3);
  const trailMap = mapSignalsToSubSkillScores(trailAll, dimsS3);
  assert(
    cleanMap.editing_in_real_time != null,
    `S3 editing_in_real_time sub-skill is text-driven`,
  );
  assert(
    (cleanMap.editing_in_real_time?.score ?? 0) >
      (trailMap.editing_in_real_time?.score ?? 0),
    `S3 editing_in_real_time differentiates clean (${cleanMap.editing_in_real_time?.score}) > trail (${trailMap.editing_in_real_time?.score})`,
  );
  assert(
    cleanMap.editing_in_real_time?.signalSource?.startsWith(
      "stoppingPointAccuracy",
    ),
    `S3 editing_in_real_time signalSource is stoppingPointAccuracy`,
  );

  // SIGNALS-block field exposure.
  const all = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    typeof all.conciseness.stoppingPointAccuracy === "number",
    `S3 TextSignals.conciseness.stoppingPointAccuracy is a number`,
  );

  // Multiple trail-off words in tail: still capped at -30 (single-shot
  // penalty, not stacked).
  const doubleTrail = extractConcisenessSignals({
    transcript: "I dunno. So yeah.",
    durationMs: 4000,
  });
  assert(
    doubleTrail.stoppingPointAccuracy <= 60,
    `S3 double-trail still detected: ${doubleTrail.stoppingPointAccuracy} ≤ 60`,
  );

  // Closing-tone marker bonus: "the bottom line is..." renders +10
  // even when the comparison rep is already at base ceiling. We test
  // by comparing a SHORT declarative (3 words, hits the length penalty)
  // to a SHORT declarative WITH a closing-tone marker.
  const shortNoMarker = extractConcisenessSignals({
    transcript: "Pricing matters here. We act soon.",
    durationMs: 5000,
  });
  const shortWithMarker = extractConcisenessSignals({
    transcript: "Pricing matters here. The answer is now.",
    durationMs: 5000,
  });
  assert(
    shortWithMarker.stoppingPointAccuracy > shortNoMarker.stoppingPointAccuracy,
    `S3 closing-marker bonus on short final sentence: with-marker (${shortWithMarker.stoppingPointAccuracy}) > without (${shortNoMarker.stoppingPointAccuracy})`,
  );

  // Long declarative: ≥4 words bonus fires.
  const longDecl = extractConcisenessSignals({
    transcript: "We are shipping the feature this Friday at noon Eastern time.",
    durationMs: 6000,
  });
  assert(
    longDecl.stoppingPointAccuracy >= 80,
    `S3 long declarative final sentence stoppingPointAccuracy=${longDecl.stoppingPointAccuracy} ≥ 80`,
  );

  // Trail-off detection independent of "yeah" specifically: "you know"
  // tail.
  const youKnowTail = extractConcisenessSignals({
    transcript: "We can ship it next week, you know.",
    durationMs: 5000,
  });
  assert(
    youKnowTail.stoppingPointAccuracy < longDecl.stoppingPointAccuracy,
    `S3 you-know tail (${youKnowTail.stoppingPointAccuracy}) < clean-long-decl (${longDecl.stoppingPointAccuracy})`,
  );

  // Pre-existing conciseness signals still present + correct.
  assert(
    typeof clean.hedgeRatePerMinute === "number" &&
      typeof clean.repetitionScore === "number" &&
      typeof clean.wordsPerDistinctIdea === "number",
    `S3 pre-existing conciseness signals preserved alongside stoppingPointAccuracy`,
  );

  // Bound floor / ceil math: extreme bad case ≥ 0.
  const trashy = extractConcisenessSignals({
    transcript: "Like, kind of, you know, so, yeah, um.",
    durationMs: 5000,
  });
  assert(
    trashy.stoppingPointAccuracy >= 0,
    `S3 worst-case stoppingPointAccuracy floor at 0 (${trashy.stoppingPointAccuracy})`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.S4 — originalityIndex + logicalConsistencyMarkers
// ————————————————————————————————————————————————————————————————
section("Ch.S4 — originalityIndex + logicalConsistencyMarkers");

{
  // Determinism + bounds.
  const det = extractThinkingQualitySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const det2 = extractThinkingQualitySignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    det.originalityIndex === det2.originalityIndex,
    `S4 originalityIndex deterministic (${det.originalityIndex})`,
  );
  assert(
    det.logicalConsistencyMarkers === det2.logicalConsistencyMarkers,
    `S4 logicalConsistencyMarkers deterministic (${det.logicalConsistencyMarkers})`,
  );
  assert(
    det.originalityIndex >= 0 && det.originalityIndex <= 100,
    `S4 originalityIndex in [0,100] (${det.originalityIndex})`,
  );
  assert(
    det.logicalConsistencyMarkers >= 0,
    `S4 logicalConsistencyMarkers ≥ 0 (${det.logicalConsistencyMarkers})`,
  );

  // Pure boilerplate transcript scores LOW originality.
  const boilerplate = extractThinkingQualitySignals({
    transcript:
      "We are building the platform of the future. Our innovative team leverages cutting-edge technology to drive transformative customer outcomes at scale across the entire ecosystem.",
    durationMs: 14000,
  });
  assert(
    boilerplate.originalityIndex <= 50,
    `S4 boilerplate originalityIndex=${boilerplate.originalityIndex} ≤ 50`,
  );

  // Domain-specific vivid vocabulary scores HIGH originality.
  const vivid = extractThinkingQualitySignals({
    transcript:
      "The pediatrician escalated the diagnosis after the avalanche-shaped curve in the underwriting pipeline; we triaged subprime exposures and benchmarked the trebuchet of legacy refactor against forklift-driven warehouse manifests.",
    durationMs: 14000,
  });
  assert(
    vivid.originalityIndex >= 55,
    `S4 vivid-domain originalityIndex=${vivid.originalityIndex} ≥ 55`,
  );

  // Differentiation: vivid > boilerplate.
  assert(
    vivid.originalityIndex > boilerplate.originalityIndex,
    `S4 originalityIndex differentiates vivid (${vivid.originalityIndex}) > boilerplate (${boilerplate.originalityIndex})`,
  );

  // logicalConsistencyMarkers — explicit corrections counted.
  const correctingRep = extractThinkingQualitySignals({
    transcript:
      "We grew thirty percent this quarter. Wait actually, scratch that, let me revise — it was twenty-five percent. But actually, the number was thirty when you include onboarding revenue.",
    durationMs: 14000,
  });
  assert(
    correctingRep.logicalConsistencyMarkers >= 2,
    `S4 self-correcting rep logicalConsistencyMarkers=${correctingRep.logicalConsistencyMarkers} ≥ 2`,
  );

  // Clean rep (no corrections) → 0 markers.
  const cleanRep = extractThinkingQualitySignals({
    transcript:
      "We grew thirty percent this quarter. The growth came from enterprise expansion. Our forecast for next quarter is twenty percent.",
    durationMs: 12000,
  });
  assert(
    cleanRep.logicalConsistencyMarkers === 0,
    `S4 clean rep logicalConsistencyMarkers=0 (got ${cleanRep.logicalConsistencyMarkers})`,
  );

  // Sub-skill rewiring: first_principles_reasoning is now text-driven.
  const vividAll = extractAllTextSignals({
    transcript:
      "The pediatrician escalated the diagnosis after the avalanche-shaped curve in the underwriting pipeline; we triaged subprime exposures and benchmarked the trebuchet of legacy refactor against forklift-driven warehouse manifests.",
    durationMs: 14000,
  });
  const boilerAll = extractAllTextSignals({
    transcript:
      "We are building the platform of the future. Our innovative team leverages cutting-edge technology to drive transformative customer outcomes at scale across the entire ecosystem.",
    durationMs: 14000,
  });
  const dimsS4: Partial<Record<"clarity" | "structure" | "conciseness" | "thinking_quality" | "delivery" | "tone", number>> = {
    clarity: 70,
    structure: 70,
    conciseness: 70,
    thinking_quality: 70,
    delivery: 70,
    tone: 70,
  };
  const vividMap = mapSignalsToSubSkillScores(vividAll, dimsS4);
  const boilerMap = mapSignalsToSubSkillScores(boilerAll, dimsS4);
  assert(
    vividMap.first_principles_reasoning != null,
    `S4 first_principles_reasoning sub-skill is text-driven`,
  );
  assert(
    (vividMap.first_principles_reasoning?.score ?? 0) >
      (boilerMap.first_principles_reasoning?.score ?? 0),
    `S4 first_principles_reasoning differentiates vivid (${vividMap.first_principles_reasoning?.score}) > boilerplate (${boilerMap.first_principles_reasoning?.score})`,
  );
  assert(
    vividMap.first_principles_reasoning?.signalSource?.startsWith(
      "originalityIndex",
    ),
    `S4 first_principles_reasoning signalSource is originalityIndex`,
  );

  // intellectual_honesty: self-correction count drags it DOWN even
  // when calibrated-certainty markers are present.
  const correctedAll = extractAllTextSignals({
    transcript:
      "I think we grew thirty percent. Wait actually, scratch that, let me revise — I'm not sure, my best guess is twenty-five. But actually, I take that back, I don't know.",
    durationMs: 14000,
  });
  const cleanHonestAll = extractAllTextSignals({
    transcript:
      "I think we grew thirty percent. My best guess for next quarter is twenty percent. I'm not certain on the exact number.",
    durationMs: 12000,
  });
  const correctedMap = mapSignalsToSubSkillScores(correctedAll, dimsS4);
  const cleanHonestMap = mapSignalsToSubSkillScores(cleanHonestAll, dimsS4);
  assert(
    (correctedMap.intellectual_honesty?.score ?? 100) <
      (cleanHonestMap.intellectual_honesty?.score ?? 0),
    `S4 self-correction drags intellectual_honesty: corrected (${correctedMap.intellectual_honesty?.score}) < clean (${cleanHonestMap.intellectual_honesty?.score})`,
  );
  assert(
    correctedMap.intellectual_honesty?.signalSource?.includes("corrections"),
    `S4 intellectual_honesty signalSource now includes corrections`,
  );

  // SIGNALS-block field exposure.
  const all = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  assert(
    typeof all.thinking_quality.originalityIndex === "number",
    `S4 TextSignals.thinking_quality.originalityIndex is a number`,
  );
  assert(
    typeof all.thinking_quality.logicalConsistencyMarkers === "number",
    `S4 TextSignals.thinking_quality.logicalConsistencyMarkers is a number`,
  );

  // Empty transcript guard: returns neutral 50, not NaN.
  const empty4 = extractThinkingQualitySignals({
    transcript: "",
    durationMs: 5000,
  });
  assert(
    empty4.originalityIndex === 50,
    `S4 empty originalityIndex=50 (got ${empty4.originalityIndex})`,
  );
  assert(
    empty4.logicalConsistencyMarkers === 0,
    `S4 empty logicalConsistencyMarkers=0 (got ${empty4.logicalConsistencyMarkers})`,
  );

  // Pluralization-aware DF lookup: "platforms" → "platform" (DF 0.85).
  const pluralBoiler = extractThinkingQualitySignals({
    transcript:
      "We are building platforms for enterprises. Our customers leverage solutions to drive outcomes.",
    durationMs: 8000,
  });
  assert(
    pluralBoiler.originalityIndex <= 55,
    `S4 plural-boilerplate ('platforms', 'enterprises', 'customers') originalityIndex=${pluralBoiler.originalityIndex} ≤ 55`,
  );

  // Mid-rep restart marker variant: "or rather", "i should say".
  const mildRestart = extractThinkingQualitySignals({
    transcript:
      "The team is growing. Or rather, the team has been growing. I should say, the team has been growing for two quarters.",
    durationMs: 10000,
  });
  assert(
    mildRestart.logicalConsistencyMarkers >= 2,
    `S4 mild restart markers caught: ${mildRestart.logicalConsistencyMarkers} ≥ 2`,
  );
}

// ————————————————————————————————————————————————————————————————
// Ch.S5 — Hume.ai prosody adapter + Tone sub-skill rewiring
// ————————————————————————————————————————————————————————————————
section("Ch.S5 — Hume prosody adapter + Tone sub-skill rewiring");

{
  // Helper: build a synthetic Hume window with specified emotion scores.
  function makeWindow(
    emotionMap: Record<string, number>,
    begin = 0,
    end = 4,
  ) {
    return {
      time: { begin, end },
      emotions: HUME_EMOTION_NAMES.map((name) => ({
        name,
        score: emotionMap[name] ?? 0,
      })),
    };
  }

  // Aggregation: single-window means equal the input scores.
  const single = aggregateHumePredictions([
    makeWindow({ Excitement: 0.7, Determination: 0.6 }),
  ]);
  assert(
    Math.abs(getHumeEmotionMean(single, "Excitement") - 0.7) < 0.001,
    `S5 single-window Excitement mean preserved (${getHumeEmotionMean(single, "Excitement")})`,
  );
  assert(
    single.humeWindowCount === 1,
    `S5 humeWindowCount tracks aggregated window count`,
  );
  assert(
    single.prosodyProvider === "hume.ai",
    `S5 prosodyProvider tag is hume.ai`,
  );
  assert(
    single.pitchMeanHz === null && single.rmsMean === null,
    `S5 raw DSP fields stay null (Hume doesn't populate them)`,
  );

  // Aggregation: multi-window means computed correctly.
  const multi = aggregateHumePredictions([
    makeWindow({ Excitement: 0.6 }),
    makeWindow({ Excitement: 0.4 }),
  ]);
  assert(
    Math.abs(getHumeEmotionMean(multi, "Excitement") - 0.5) < 0.001,
    `S5 multi-window Excitement mean=0.5 (got ${getHumeEmotionMean(multi, "Excitement")})`,
  );

  // Variance computed correctly: mean=0.5, scores 0.6 and 0.4, var=0.01
  assert(
    Math.abs(getHumeEmotionVariance(multi, "Excitement") - 0.01) < 0.001,
    `S5 multi-window Excitement variance=0.01 (got ${getHumeEmotionVariance(multi, "Excitement")})`,
  );

  // Variance is non-negative.
  for (const name of HUME_EMOTION_NAMES) {
    assert(
      getHumeEmotionVariance(multi, name) >= 0,
      `S5 emotion variance ≥ 0 for ${name}`,
    );
  }

  // Identical-window sequences have ~0 variance.
  const identical = aggregateHumePredictions([
    makeWindow({ Excitement: 0.5, Joy: 0.3 }),
    makeWindow({ Excitement: 0.5, Joy: 0.3 }),
    makeWindow({ Excitement: 0.5, Joy: 0.3 }),
  ]);
  assert(
    getHumeEmotionVariance(identical, "Excitement") < 0.001,
    `S5 identical-window Excitement variance ≈ 0 (got ${getHumeEmotionVariance(identical, "Excitement")})`,
  );

  // Tone sub-skill rewiring: with HUME prosody present, Tone sub-skills
  // are populated from emotion vector (NOT dimension_fallback).
  const allSig = extractAllTextSignals({
    transcript: STRONG_TRANSCRIPT,
    durationMs: STRONG_DURATION_MS,
  });
  const dimsS5: Partial<Record<"clarity" | "structure" | "conciseness" | "thinking_quality" | "delivery" | "tone", number>> = {
    clarity: 70,
    structure: 70,
    conciseness: 70,
    thinking_quality: 70,
    delivery: 70,
    tone: 70,
  };

  // Variety/expressive prosody: high Excitement/Determination/Joy
  // variance + Confidence (Determination/Pride) means.
  const expressiveProsody = {
    wordsPerMinute: 150,
    fillerCount: 0,
    fillerRatePerMinute: 0,
    pauseCount: 4,
    longPauseCount: 1,
    pauseTotalMs: 1000,
    meanPauseMs: 250,
    pitchMeanHz: null,
    pitchStdSemitones: null,
    pitchRangeSemitones: null,
    monotoneRatio: null,
    upspeakRatio: null,
    rmsMean: null,
    rmsStd: null,
    articulationScore: null,
    humeEmotionMeans: HUME_EMOTION_NAMES.map((name) => {
      if (name === "Determination" || name === "Pride" || name === "Triumph") return 0.5;
      if (name === "Calmness" || name === "Contentment") return 0.4;
      if (name === "Joy" || name === "Excitement") return 0.5;
      return 0.05;
    }),
    humeEmotionVariances: HUME_EMOTION_NAMES.map((name) => {
      if (name === "Excitement" || name === "Determination" || name === "Joy") return 0.03;
      return 0.001;
    }),
    humeWindowCount: 8,
    prosodyProvider: "hume.ai" as const,
  };
  const monotoneProsody = {
    wordsPerMinute: 150,
    fillerCount: 0,
    fillerRatePerMinute: 0,
    pauseCount: 4,
    longPauseCount: 1,
    pauseTotalMs: 1000,
    meanPauseMs: 250,
    pitchMeanHz: null,
    pitchStdSemitones: null,
    pitchRangeSemitones: null,
    monotoneRatio: null,
    upspeakRatio: null,
    rmsMean: null,
    rmsStd: null,
    articulationScore: null,
    humeEmotionMeans: HUME_EMOTION_NAMES.map((name) => {
      if (name === "Boredom" || name === "Tiredness") return 0.5;
      return 0.05;
    }),
    humeEmotionVariances: HUME_EMOTION_NAMES.map(() => 0.0005),
    humeWindowCount: 8,
    prosodyProvider: "hume.ai" as const,
  };

  const expressiveMap = mapSignalsToSubSkillScores(
    allSig,
    dimsS5,
    expressiveProsody,
  );
  const monotoneMap = mapSignalsToSubSkillScores(
    allSig,
    dimsS5,
    monotoneProsody,
  );
  const noProsodyMap = mapSignalsToSubSkillScores(allSig, dimsS5, null);

  // pitch_variation differentiates expressive vs monotone.
  assert(
    (expressiveMap.pitch_variation?.score ?? 0) >
      (monotoneMap.pitch_variation?.score ?? 0),
    `S5 pitch_variation: expressive (${expressiveMap.pitch_variation?.score}) > monotone (${monotoneMap.pitch_variation?.score})`,
  );

  // vocal_presence differentiates Determination/Pride vs absence.
  assert(
    (expressiveMap.vocal_presence?.score ?? 0) >
      (monotoneMap.vocal_presence?.score ?? 0),
    `S5 vocal_presence: expressive (${expressiveMap.vocal_presence?.score}) > monotone (${monotoneMap.vocal_presence?.score})`,
  );

  // warmth differentiates Calmness/Contentment vs absence.
  assert(
    (expressiveMap.warmth?.score ?? 0) > (monotoneMap.warmth?.score ?? 0),
    `S5 warmth: expressive (${expressiveMap.warmth?.score}) > monotone (${monotoneMap.warmth?.score})`,
  );

  // No-prosody fallback: Tone sub-skills equal the dimension Tone score
  // (70) via dimension_fallback (signalSource will be that string).
  assert(
    noProsodyMap.pitch_variation?.signalSource === "dimension_fallback",
    `S5 no-prosody falls back to dimension_fallback for Tone (got ${noProsodyMap.pitch_variation?.signalSource})`,
  );

  // With prosody, signalSource starts with "hume" (not dimension_fallback).
  assert(
    expressiveMap.pitch_variation?.signalSource?.startsWith("hume") ?? false,
    `S5 with prosody, pitch_variation signalSource starts with 'hume' (got ${expressiveMap.pitch_variation?.signalSource})`,
  );

  // Other (non-Tone) sub-skills are unaffected by prosody presence.
  assert(
    expressiveMap.word_choice?.score === noProsodyMap.word_choice?.score,
    `S5 prosody does NOT affect non-Tone sub-skills (word_choice equal)`,
  );

  // All 6 Tone sub-skills are populated when Hume prosody present.
  const toneIds = ["pitch_variation", "volume_control", "downward_inflection", "emotional_authenticity", "vocal_presence", "warmth"];
  for (const id of toneIds) {
    assert(
      expressiveMap[id as keyof typeof expressiveMap] != null,
      `S5 Tone sub-skill ${id} populated when Hume prosody present`,
    );
  }

  // hasWorkerProsody recognizes Hume-only prosody as worker-available.
  assert(
    hasWorkerProsody(expressiveProsody) === true,
    `S5 hasWorkerProsody returns true on Hume-only prosody (no raw DSP fields)`,
  );

  // hasWorkerProsody false on inline-only prosody (no worker fields).
  const inlineOnly = {
    wordsPerMinute: 150,
    fillerCount: 0,
    fillerRatePerMinute: 0,
    pauseCount: 0,
    longPauseCount: 0,
    pauseTotalMs: 0,
    meanPauseMs: 0,
    pitchMeanHz: null,
    pitchStdSemitones: null,
    pitchRangeSemitones: null,
    monotoneRatio: null,
    upspeakRatio: null,
    rmsMean: null,
    rmsStd: null,
    articulationScore: null,
  };
  assert(
    hasWorkerProsody(inlineOnly) === false,
    `S5 hasWorkerProsody returns false on inline-only prosody`,
  );
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
