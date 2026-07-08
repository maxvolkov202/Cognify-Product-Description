/**
 * PRD v3 Phase 1 — Coach's Focus contract tests.
 *
 * Pure-function assertions over src/lib/ai/coach-focus.ts:
 *   • deriveCoachFocus prefers the nextRepFocus bullet matching
 *     primaryFocusDimension, falls back sensibly, nulls on empty scores
 *   • deriveImplementationVerdict thresholds (generous per Owen C10)
 *   • softenScoreDelta display rules
 *
 * Run: npx tsx tests/coach-focus.test.ts
 */

import {
  COACHING_TECHNIQUES,
  deriveCoachFocus,
  deriveImplementationVerdict,
  isCoachingTechnique,
  softenScoreDelta,
} from "@/lib/ai/coach-focus";
import type { RepScore } from "@/types/domain";

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

function mkScore(partial: Partial<RepScore>): RepScore {
  return {
    composite: 70,
    dimensions: [],
    callouts: [],
    modelVersion: "test",
    rubricVersion: "test",
    ...partial,
  };
}

const bullet = (dimension: string, text: string, subSkill?: string) => ({
  text,
  dimension: dimension as never,
  subSkill: (subSkill ?? null) as never,
  quote: null,
  transcriptStart: null,
  transcriptEnd: null,
});

section("deriveCoachFocus");
{
  // Prefers the bullet matching primaryFocusDimension.
  const s1 = mkScore({
    primaryFocusDimension: "structure",
    nextRepFocus: [
      { ...bullet("clarity", "Simplify your opening."), exampleLine: null },
      {
        ...bullet("structure", "Lead with the answer.", "bottom_line_discipline"),
        exampleLine: null,
      },
    ],
  });
  const f1 = deriveCoachFocus(s1);
  assert(f1?.dimension === "structure", "matches primaryFocusDimension bullet");
  assert(f1?.subSkill === "bottom_line_discipline", "carries the hidden skill");
  assert(f1?.text === "Lead with the answer.", "carries the bullet text");

  // Falls back to the first bullet when no dimension match.
  const s2 = mkScore({
    primaryFocusDimension: "tone",
    nextRepFocus: [
      { ...bullet("clarity", "Simplify your opening."), exampleLine: null },
    ],
  });
  const f2 = deriveCoachFocus(s2);
  assert(f2?.dimension === "clarity", "falls back to first bullet");

  // Bare-dimension fallback when no bullets at all.
  const s3 = mkScore({ primaryFocusDimension: "thinking_quality" });
  const f3 = deriveCoachFocus(s3);
  assert(
    f3?.dimension === "thinking_quality" && f3.text.length > 0,
    "bare-dimension fallback produces a focus",
  );

  // Null when the score has nothing to focus on (mock fallback shape).
  const f4 = deriveCoachFocus(mkScore({}));
  assert(f4 === null, "null when no focus data");

  // structural_adherence never becomes a focus — but it must not VOID
  // the focus either (Phase 12 F-5: framework-heavy reps where the model
  // picked it as primary silently lost the card/retry/ledger).
  const f5 = deriveCoachFocus(
    mkScore({ primaryFocusDimension: "structural_adherence" as never }),
  );
  assert(f5 === null, "structural_adherence with no other signal → null");

  // …redirects to the first non-structural bullet when one exists.
  const f6 = deriveCoachFocus(
    mkScore({
      primaryFocusDimension: "structural_adherence" as never,
      nextRepFocus: [
        { ...bullet("conciseness", "Cut the preamble."), exampleLine: null },
      ],
    }),
  );
  assert(
    f6?.dimension === "conciseness" && f6.text === "Cut the preamble.",
    "structural_adherence primary redirects to first core bullet",
  );

  // …or to the weakest scored core dimension when there are no bullets.
  const f7 = deriveCoachFocus(
    mkScore({
      primaryFocusDimension: "structural_adherence" as never,
      dimensions: [
        { dimension: "clarity", score: 71, feedback: "" },
        { dimension: "tone", score: 48, feedback: "" },
        { dimension: "structural_adherence", score: 20, feedback: "" },
      ] as never,
    }),
  );
  assert(
    f7?.dimension === "tone",
    "structural_adherence primary falls back to weakest core dimension",
  );
}

section("coaching technique (Phase 15 I-8)");
{
  assert(
    COACHING_TECHNIQUES.length === 4 &&
      isCoachingTechnique("smaller_step") &&
      isCoachingTechnique("transcript_example") &&
      isCoachingTechnique("related_hidden_skill") &&
      isCoachingTechnique("reframe"),
    "taxonomy pinned to the four techniques",
  );
  assert(
    !isCoachingTechnique("bigger_step") && !isCoachingTechnique(null),
    "guard rejects unknown values",
  );

  // Retry-evaluated score: the implementationReview technique tag rides
  // the derived focus — this is the exact shape saveRep's ledger insert
  // persists (coachingEvents.technique = coachFocus.technique).
  const tagged = deriveCoachFocus(
    mkScore({
      primaryFocusDimension: "structure",
      implementationReview: {
        verdict: "partial",
        note: "Attempted the map but lost it mid-answer.",
        technique: "smaller_step",
      },
      nextRepFocus: [
        {
          ...bullet("structure", "Lead with the answer.", "bottom_line_discipline"),
          exampleLine: null,
        },
      ],
    }),
  );
  assert(
    tagged?.technique === "smaller_step",
    "implementationReview.technique carried onto the CoachFocus",
  );

  // First-rep score (no implementationReview) → technique null.
  const untagged = deriveCoachFocus(
    mkScore({
      primaryFocusDimension: "structure",
      nextRepFocus: [
        { ...bullet("structure", "Lead with the answer."), exampleLine: null },
      ],
    }),
  );
  assert(
    untagged !== null && untagged.technique === null,
    "no implementationReview → technique null",
  );

  // Lenient carry: junk tag on the score never leaks into the ledger.
  const junkTag = deriveCoachFocus(
    mkScore({
      primaryFocusDimension: "structure",
      implementationReview: {
        verdict: "missed",
        technique: "vibes" as never,
      },
      nextRepFocus: [
        { ...bullet("structure", "Lead with the answer."), exampleLine: null },
      ],
    }),
  );
  assert(
    junkTag?.technique === null,
    "invalid technique tag → null on the CoachFocus",
  );

  // The bare-dimension fallback path carries the tag too.
  const bare = deriveCoachFocus(
    mkScore({
      primaryFocusDimension: "tone",
      implementationReview: { verdict: "nailed", technique: "reframe" },
    }),
  );
  assert(
    bare?.technique === "reframe",
    "bare-dimension fallback carries the technique",
  );
}

section("deriveImplementationVerdict");
{
  const dims = (clarity: number) => [
    { dimension: "clarity" as const, score: clarity },
    { dimension: "structure" as const, score: 70 },
  ];
  assert(
    deriveImplementationVerdict({
      focusDimension: "clarity",
      firstDimensions: dims(60),
      retryDimensions: dims(68),
    }) === "nailed",
    "+8 on focus dim → nailed",
  );
  assert(
    deriveImplementationVerdict({
      focusDimension: "clarity",
      firstDimensions: dims(60),
      retryDimensions: dims(59),
    }) === "partial",
    "-1 on focus dim → partial (generous, C10)",
  );
  assert(
    deriveImplementationVerdict({
      focusDimension: "clarity",
      firstDimensions: dims(60),
      retryDimensions: dims(52),
    }) === "missed",
    "-8 on focus dim → missed",
  );
  assert(
    deriveImplementationVerdict({
      focusDimension: "tone",
      firstDimensions: dims(60),
      retryDimensions: dims(70),
    }) === "partial",
    "missing focus dim on either side → partial",
  );
}

section("softenScoreDelta (Owen C10)");
{
  assert(
    softenScoreDelta(6).tone === "celebrate" && softenScoreDelta(6).showNumeric,
    "+6 → numeric celebrate",
  );
  assert(
    softenScoreDelta(0).tone === "neutral" && softenScoreDelta(0).showNumeric,
    "0 → numeric neutral",
  );
  assert(
    softenScoreDelta(-2).tone === "neutral" && softenScoreDelta(-2).showNumeric,
    "-2 → small numeric, neutral",
  );
  const soft = softenScoreDelta(-9);
  assert(!soft.showNumeric && soft.tone === "soft", "-9 → number hidden, soft copy");
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all coach-focus tests pass`);
