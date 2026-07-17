/**
 * Grading v3 (Phase 3, D22) — v4 scoring contract tests (pure).
 *
 * Covers: schema parse of the unified-pass output, provider-quirk
 * normalization (the gpt-4o omission class), Stronger Version
 * substring validation, coach-focus sub-skill mismatch stripping, and
 * the feedback-doc build/apply round trip.
 *
 * Run: npx tsx tests/grading-v3-contract.test.ts
 */

import {
  scoringResponseSchema,
  normalizeProviderQuirks,
  sanitizeCoachFocus,
  sanitizeStrongerVersion,
  sanitizeDimSubSkill,
  containsBannedPhrase,
} from "@/lib/ai/score";
import {
  buildFeedbackDoc,
  applyFeedbackDoc,
} from "@/lib/scoring/feedback-doc";
import type { RepScore } from "@/types/domain";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) pass++;
  else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

const TRANSCRIPT =
  "Trust is the foundation of every relationship, and three specific behaviors build it. " +
  "First, consistency — showing up the same way whether it's easy or hard.";

function validResponse() {
  return {
    dimensions: [
      "clarity",
      "structure",
      "conciseness",
      "thinking_quality",
      "delivery",
      "tone",
    ].map((d) => ({
      dimension: d,
      score: 70,
      signals: ["signal"],
      feedback: `Your ${d} held together; one tightening pass would lift it.`,
      subSkill: null,
    })),
    headline: "You had the point — you buried it under two setups.",
    coachFocus: {
      dimension: "structure",
      subSkill: "bottom_line_discipline",
      behavior: "You opened with background instead of the answer.",
      why: "Listeners decide in the first sentence whether to track you.",
      action: "Open your retry with the conclusion in one sentence.",
    },
    strongerVersion: {
      quote: "Trust is the foundation of every relationship",
      rewrite:
        "Trust decides whether anything else you say lands — and three behaviors build it.",
    },
    headlineTone: "directive",
    nextRepHint: "lead with the answer",
    implementationReview: null,
  };
}

// ————————————————————————————————————————————————————————————————
section("schema parses the v4 unified-pass output");
{
  const parsed = scoringResponseSchema.safeParse(validResponse());
  assert(parsed.success, `valid v4 response parses (${parsed.success ? "" : JSON.stringify(parsed.error.issues[0])})`);
}

section("provider-quirk normalization (gpt-4o omission class)");
{
  const quirky = validResponse() as Record<string, unknown>;
  delete quirky.strongerVersion; // omitted entirely → undefined
  (quirky.coachFocus as Record<string, unknown>).subSkill = "Bottom-Line Discipline"; // label not id
  (quirky.dimensions as Record<string, unknown>[])[0]!.feedback = null; // null instead of absent
  delete (quirky.dimensions as Record<string, unknown>[])[1]!.subSkill; // omitted
  const normalized = normalizeProviderQuirks(quirky);
  const parsed = scoringResponseSchema.safeParse(normalized);
  assert(parsed.success, `quirky response parses after normalization (${parsed.success ? "" : JSON.stringify(parsed.error.issues[0])})`);
  if (parsed.success) {
    assert(parsed.data.strongerVersion === null, "omitted strongerVersion → null");
    assert(
      parsed.data.coachFocus.subSkill === "bottom_line_discipline",
      `label maps to id (got ${parsed.data.coachFocus.subSkill})`,
    );
    assert(
      parsed.data.dimensions[0]!.feedback === undefined,
      "feedback:null coerced to absent",
    );
    assert(
      parsed.data.dimensions[1]!.subSkill === null,
      "omitted dimension subSkill → null",
    );
  }
}

section("strongerVersion with empty quote object → null (not a parse failure)");
{
  const quirky = validResponse() as Record<string, unknown>;
  quirky.strongerVersion = { quote: "", rewrite: "something" };
  const parsed = scoringResponseSchema.safeParse(normalizeProviderQuirks(quirky));
  assert(parsed.success && parsed.data.strongerVersion === null, "degenerate strongerVersion nulled");
}

// ————————————————————————————————————————————————————————————————
section("sanitizeStrongerVersion — verbatim grounding");
{
  const ok = sanitizeStrongerVersion({
    strongerVersion: {
      quote: "trust is the foundation of every relationship",
      rewrite: "Trust decides whether anything else lands.",
    },
    transcript: TRANSCRIPT,
  });
  assert(ok !== null, "case-insensitive verbatim quote survives");

  const fabricated = sanitizeStrongerVersion({
    strongerVersion: {
      quote: "I promise to always deliver on time",
      rewrite: "whatever",
    },
    transcript: TRANSCRIPT,
  });
  assert(fabricated === null, "fabricated quote discards the whole strongerVersion");

  const whitespace = sanitizeStrongerVersion({
    strongerVersion: {
      quote: "three  specific   behaviors build it",
      rewrite: "ok",
    },
    transcript: TRANSCRIPT,
  });
  assert(whitespace !== null, "whitespace-collapsed match survives");

  assert(
    sanitizeStrongerVersion({ strongerVersion: null, transcript: TRANSCRIPT }) === null,
    "null passes through",
  );
}

section("sanitizeCoachFocus — composition + mismatch strip");
{
  const cf = sanitizeCoachFocus({
    dimension: "structure",
    subSkill: "bottom_line_discipline",
    behavior: "You opened with background.",
    why: "Listeners decide fast.",
    action: "Open with the conclusion.",
  });
  assert(cf.text === "Open with the conclusion.", "text composes from action");
  assert(cf.subSkill === "bottom_line_discipline", "matching subSkill kept");

  const mismatched = sanitizeCoachFocus({
    dimension: "structure",
    subSkill: "jargon_translation", // clarity skill on a structure focus
    behavior: "b",
    why: "w",
    action: "a",
  });
  assert(mismatched.subSkill === null, "cross-dimension subSkill strips to null");
}

section("sanitizeDimSubSkill");
{
  assert(
    sanitizeDimSubSkill("clarity", "jargon_translation") === "jargon_translation",
    "matching dim keeps the id",
  );
  assert(
    sanitizeDimSubSkill("tone", "jargon_translation") === null,
    "mismatched dim strips",
  );
  assert(sanitizeDimSubSkill("tone", "not_a_skill") === null, "unknown id strips");
  assert(sanitizeDimSubSkill("tone", null) === null, "null passes");
}

section("banned-phrase detector");
{
  assert(containsBannedPhrase("Great job on the open!"), "detects banned praise filler");
  assert(!containsBannedPhrase("You led with the answer."), "clean copy passes");
}

// ————————————————————————————————————————————————————————————————
section("feedback-doc build/apply round trip");
{
  const score: RepScore = {
    composite: 72,
    dimensions: [
      {
        dimension: "clarity",
        score: 70,
        signals: [],
        feedback: "Clear once you got moving.",
        subSkill: "concreteness",
      },
      { dimension: "tone", score: 60, signals: [] },
    ],
    callouts: [],
    modelVersion: "openai:gpt-4o",
    rubricVersion: "v3.0.0",
    headline: "Solid bones.",
    headlineTone: "directive",
    nextRepHint: "land the open",
    coachFocus: {
      dimension: "clarity",
      subSkill: "concreteness",
      behavior: "b",
      why: "w",
      action: "a",
      text: "a",
    },
    strongerVersion: { quote: "q", rewrite: "r" },
    feedbackVersion: "v4.0.0",
  };
  const doc = buildFeedbackDoc(score);
  assert(doc !== null, "doc builds for a v4 score");
  assert(doc?.version === "v4.0.0", "doc carries the feedback version");
  assert(
    doc?.skillFeedback?.clarity?.feedback === "Clear once you got moving.",
    "per-skill feedback keyed by dimension",
  );

  // Reconstruct a lossy score (as getRepResult does) and re-apply.
  const lossy: RepScore = {
    composite: 72,
    dimensions: [
      { dimension: "clarity", score: 70, signals: [] },
      { dimension: "tone", score: 60, signals: [] },
    ],
    callouts: [],
    modelVersion: "openai:gpt-4o",
    rubricVersion: "v3.0.0",
  };
  const restored = applyFeedbackDoc(lossy, doc);
  assert(restored.headline === "Solid bones.", "headline restored");
  assert(
    restored.strongerVersion?.rewrite === "r",
    "strongerVersion restored",
  );
  assert(
    restored.dimensions[0]!.feedback === "Clear once you got moving.",
    "per-skill feedback restored onto the dimension",
  );
  assert(restored.nextRepHint === "land the open", "nextRepHint restored");

  const mockDoc = buildFeedbackDoc({
    ...lossy,
    modelVersion: "mock-fallback-v1",
    headline: "canned",
  });
  assert(mockDoc === null, "mock-fallback scores build no doc");
  assert(
    applyFeedbackDoc(lossy, null) === lossy,
    "applying a null doc is identity",
  );
}

// ————————————————————————————————————————————————————————————————
console.log(`\n${"═".repeat(60)}`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all grading-v3 contract tests pass`);
