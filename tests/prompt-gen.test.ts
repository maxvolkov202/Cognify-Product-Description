/**
 * PRD v3 Phase 8.1 — prompt-generation QA filter tests (pure).
 *
 * Run: npx tsx tests/prompt-gen.test.ts
 */

import {
  qaFilterPrompts,
  buildGenUserPrompt,
  GENERATED_PROMPT_MAX_CHARS,
  type PromptGenExercise,
} from "@/lib/ai/prompt-gen";

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

section("QA filter");
{
  const existing = [
    "Explain your favorite hobby to a coworker who has never tried it.",
  ];
  const out = qaFilterPrompts(
    [
      "Pitch a four-day work week to your skeptical department head in under a minute.",
      "short", // too short
      "x".repeat(GENERATED_PROMPT_MAX_CHARS + 1), // too long
      "Here is a prompt: talk about your weekend plans with a colleague.", // meta
      "Explain your favorite hobby to a coworker who has never tried it.", // exact dup
      "Explain your favorite hobby to a coworker who never tried it.", // near-dup
      "Line one\nline two of a broken prompt that should be rejected here.", // newline
      "Walk your new teammate through the one process everyone gets wrong in their first week.",
    ],
    existing,
  );
  assert(out.length === 2, `2 survivors (got ${out.length}: ${JSON.stringify(out)})`);
  assert(
    out[0]!.startsWith("Pitch a four-day"),
    "good prompts pass in order",
  );
  assert(
    out.every((t) => !t.includes("\n")),
    "no newlines survive",
  );
}

section("dedupe within batch");
{
  const out = qaFilterPrompts(
    [
      "Describe the moment you realized your first big project was going to fail.",
      "Describe the moment you realized your first big project was going to fail.",
    ],
    [],
  );
  assert(out.length === 1, "in-batch duplicates collapse");
}

section("whitespace normalization");
{
  const out = qaFilterPrompts(
    ["  Convince   a hesitant friend to finally take the trip they keep postponing.  "],
    [],
  );
  assert(
    out[0] === "Convince a hesitant friend to finally take the trip they keep postponing.",
    "runs of whitespace collapse and trim",
  );
}

section("user-context threading (I1)");
{
  const exercise: PromptGenExercise = {
    slug: "answer-first",
    name: "Answer First",
    dimension: "structure",
    rule: "Open with the answer, then support it.",
    why: null,
    objective: null,
    promptRules: null,
    hiddenSkills: null,
    application: null,
    responseWindow: null,
  };

  const full = buildGenUserPrompt({
    exercise,
    userContext: {
      vertical: "sales",
      communicationStage: "manager",
      goals: ["storytelling", "executive presence"],
    },
    existingTexts: [],
    count: 5,
  });
  assert(
    full.includes("USER VERTICAL (bias topics toward, don't force): sales"),
    "vertical line renders",
  );
  assert(
    full.includes("USER CAREER STAGE: manager"),
    "communication stage line renders",
  );
  assert(
    full.includes(
      "USER GOALS (bias scenarios toward, don't force): storytelling, executive presence",
    ),
    "goals line renders with all goals",
  );

  const bare = buildGenUserPrompt({ exercise, existingTexts: [], count: 5 });
  assert(
    !bare.includes("USER VERTICAL") &&
      !bare.includes("USER CAREER STAGE") &&
      !bare.includes("USER GOALS"),
    "no user context → no context lines",
  );

  const emptyGoals = buildGenUserPrompt({
    exercise,
    userContext: { vertical: null, communicationStage: null, goals: [] },
    existingTexts: [],
    count: 5,
  });
  assert(
    !emptyGoals.includes("USER GOALS") &&
      !emptyGoals.includes("USER CAREER STAGE") &&
      !emptyGoals.includes("USER VERTICAL"),
    "null/empty context values render nothing",
  );

  assert(
    full.includes("Generate 7 prompt options"),
    "count+2 extras preserved in the closing instruction",
  );
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`  ✓ all prompt-gen tests pass`);
