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

section("near-dupe guard is symmetric");
{
  // A candidate that EXTENDS an existing prompt dilutes its own overlap
  // ratio below the candidate-side threshold. Both real bank survivors.
  const out = qaFilterPrompts(
    [
      "What's worth fighting for in a friendship?",
      "Is honesty always the right call in a relationship?",
    ],
    ["What's worth fighting for?", "Is honesty always the right call?"],
  );
  assert(
    out.length === 0,
    `extensions of existing prompts are rejected (got ${JSON.stringify(out)})`,
  );
}

section("short existing prompts don't veto everything");
{
  // The reverse direction must not let a terse stub reject unrelated
  // candidates that happen to contain its words.
  const out = qaFilterPrompts(
    ["What's the point of learning a language you'll rarely speak?"],
    ["What's the point?"],
  );
  assert(out.length === 1, `short-stub containment is not a dupe (got ${out.length})`);
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
    full.includes(
      "USER VERTICAL (bias topics toward, don't force — vertical-flavored, never vertical-locked): sales",
    ),
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

section("generation-unit pack fields render (Phase 2A.1)");
{
  const exercise: PromptGenExercise = {
    slug: "establishing-stakes",
    name: "Establishing Stakes",
    dimension: "thinking_quality",
    rule: "Make what could be lost, gained, or changed clear early.",
    why: null,
    objective: "Train stakes-first personal storytelling.",
    promptRules: null,
    hiddenSkills: null,
    application: "storytelling",
    responseWindow: { minSec: 60, maxSec: 120 },
    coachInsight:
      "A story becomes interesting when the listener understands why the moment mattered.",
    scoringLens: "Evaluate whether the listener understands why the story mattered.",
    retryObjective: "Make the stakes clear within the first 20 seconds.",
    commonFailureModes: [
      "Spending too long on setup before anything matters",
      "Ending with a vague lesson",
    ],
    secondaryCoreSkills: ["structure", "clarity"],
  };
  const rendered = buildGenUserPrompt({ exercise, existingTexts: [], count: 5 });
  assert(
    rendered.includes("COACH'S INSIGHT (shown before speaking): A story becomes"),
    "coach insight renders",
  );
  assert(
    rendered.includes("SCORING LENS (how the response is evaluated): Evaluate whether"),
    "scoring lens renders",
  );
  assert(
    rendered.includes("RETRY OBJECTIVE: Make the stakes clear"),
    "retry objective renders",
  );
  assert(
    rendered.includes("COMMON FAILURE MODES") &&
      rendered.includes("- Spending too long on setup before anything matters"),
    "common failure modes render as bullets",
  );
  assert(
    rendered.includes("SECONDARY CORE SKILLS: structure, clarity"),
    "secondary core skills render",
  );
  assert(
    rendered.includes("STORYTELLING RULES:"),
    "per-application Lab Engine rules render for storytelling",
  );
  assert(
    rendered.includes("RESPONSE WINDOW: 60-120 seconds"),
    "response window renders",
  );

  const coreExercise: PromptGenExercise = {
    ...exercise,
    application: null,
    coachInsight: null,
    scoringLens: null,
    retryObjective: null,
    commonFailureModes: null,
    secondaryCoreSkills: null,
  };
  const bare = buildGenUserPrompt({
    exercise: coreExercise,
    existingTexts: [],
    count: 5,
  });
  assert(
    !bare.includes("COACH'S INSIGHT") &&
      !bare.includes("SCORING LENS") &&
      !bare.includes("RETRY OBJECTIVE") &&
      !bare.includes("COMMON FAILURE MODES") &&
      !bare.includes("SECONDARY CORE SKILLS") &&
      !bare.includes("RULES:"),
    "unauthored pack fields render nothing (calibration-style conditional rendering)",
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
