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
// Summary
// ————————————————————————————————————————————————————————————————
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
