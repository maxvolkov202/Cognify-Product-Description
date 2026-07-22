/**
 * Grading Engine V2 — Arm B (grouped fan-out) unit tests.
 *
 * The three LLM calls can't run headless, so these cover the pure seams:
 * per-pass parsing + coverage checks, the synthesis-failure fallback, config
 * resolution, scope rendering, and — critically — that a fanned-out result
 * merges back into the exact full scoringResponseSchema contract the
 * single-call path produces (so downstream stays arm-agnostic).
 *
 * Run: npx tsx tests/score-arm-b.test.ts
 */

import { __armBForTests } from "@/lib/ai/score-arm-b";
import { parseAndValidate } from "@/lib/ai/score-shared";
import type { SkillDimension } from "@/types/domain";

const {
  parseScoringPass,
  parseDeliveryToneDecomp,
  deriveSynthesisFallback,
  resolveArmBConfig,
  renderSynthesisScope,
  synthesisPassSchema,
  CONTENT_SCOPE,
  CONTENT_SCOPE_LEAN,
  DELIVERY_SCOPE_LEAN,
  CONTENT_SCOPE_HOLISTIC,
  DELIVERY_SCOPE_HOLISTIC,
  CONTENT_DIMS,
  DELIVERY_DIMS,
} = __armBForTests;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const TRANSCRIPT =
  "Trust is the foundation of every relationship, and three behaviors build it. First, consistency.";

function contentJson(scores?: Partial<Record<SkillDimension, number>>) {
  const s = { clarity: 82, structure: 74, conciseness: 68, thinking_quality: 80, ...scores };
  return JSON.stringify({
    dimensions: CONTENT_DIMS.map((d) => ({
      dimension: d,
      score: s[d],
      signals: ["x"],
      feedback: `feedback for ${d}`,
      subSkill: null,
    })),
  });
}
function deliveryJson() {
  return JSON.stringify({
    dimensions: DELIVERY_DIMS.map((d) => ({
      dimension: d,
      score: d === "delivery" ? 78 : 65,
      signals: [],
      feedback: `voice ${d}`,
    })),
  });
}

// ── parseScoringPass: happy path returns dims in expected order ──
{
  const dims = parseScoringPass(contentJson(), CONTENT_DIMS);
  check("content pass parses", dims != null);
  check(
    "returns the four content dims in order",
    dims?.map((d) => d.dimension).join(",") === CONTENT_DIMS.join(","),
    dims?.map((d) => d.dimension).join(","),
  );
  check("scores preserved", dims?.[0]?.score === 82, `${dims?.[0]?.score}`);
}

// ── parseScoringPass: ignores extra dims, enforces coverage ──
{
  // A content call that (wrongly) also emitted tone → tone is ignored, the
  // four content dims still parse.
  const withExtra = JSON.parse(contentJson());
  withExtra.dimensions.push({ dimension: "tone", score: 40, signals: [] });
  const dims = parseScoringPass(JSON.stringify(withExtra), CONTENT_DIMS);
  check("extra dims ignored, still 4", dims?.length === 4, `${dims?.length}`);

  // Missing a required dimension → null (caller falls back).
  const missing = JSON.parse(contentJson());
  missing.dimensions = missing.dimensions.filter(
    (d: { dimension: string }) => d.dimension !== "structure",
  );
  check(
    "incomplete coverage → null",
    parseScoringPass(JSON.stringify(missing), CONTENT_DIMS) === null,
  );

  check("malformed JSON → null", parseScoringPass("not json", CONTENT_DIMS) === null);
  check(
    "fenced JSON still parses",
    parseScoringPass("```json\n" + contentJson() + "\n```", CONTENT_DIMS) != null,
  );
}

// ── deriveSynthesisFallback: weakest dim drives coachFocus ──
{
  const dims = [
    ...parseScoringPass(contentJson({ conciseness: 41 }), CONTENT_DIMS)!,
    ...parseScoringPass(deliveryJson(), DELIVERY_DIMS)!,
  ];
  const env = deriveSynthesisFallback(dims);
  check("fallback validates against synthesis schema", synthesisPassSchema.safeParse(env).success);
  check(
    "coachFocus targets the weakest dimension (conciseness)",
    env.coachFocus.dimension === "conciseness",
    env.coachFocus.dimension,
  );
  check("fallback never fabricates a strongerVersion", env.strongerVersion === null);
  check(
    "headlineTone is band-appropriate (directive mid-band)",
    ["blunt", "directive"].includes(env.headlineTone),
    env.headlineTone,
  );
  check("nextRepHint within 60 chars", env.nextRepHint.length <= 60);
}

// ── merge round-trip: fanned-out result → full scoringResponseSchema ──
{
  const contentDims = parseScoringPass(contentJson(), CONTENT_DIMS)!;
  const deliveryDims = parseScoringPass(deliveryJson(), DELIVERY_DIMS)!;
  const dims6 = [...contentDims, ...deliveryDims];
  const synthesis = {
    headline: "You front-loaded the point, then let the middle drift.",
    coachFocus: {
      dimension: "conciseness" as SkillDimension,
      subSkill: null,
      behavior: "You restated the same idea three ways.",
      why: "Repetition dilutes the one line the listener should keep.",
      action: "Cut the second and third restatements on your retry.",
    },
    strongerVersion: null,
    headlineTone: "praise" as const,
    nextRepHint: "cut the restatements",
  };
  const merged = {
    dimensions: dims6.map((d) => ({
      dimension: d.dimension,
      score: d.score,
      signals: d.signals ?? [],
      ...(d.feedback ? { feedback: d.feedback } : {}),
      subSkill: d.subSkill ?? null,
    })),
    ...synthesis,
  };
  const { validated, sanitizedCoachFocus } = parseAndValidate(
    JSON.stringify(merged),
    TRANSCRIPT,
  );
  check("merged object satisfies the full schema", validated.dimensions.length === 6);
  check(
    "all six dimensions present after merge",
    new Set(validated.dimensions.map((d) => d.dimension)).size === 6,
  );
  check("coachFocus survives sanitization", sanitizedCoachFocus.dimension === "conciseness");
}

// ── resolveArmBConfig: env knob flips determinism ──
{
  const saved = process.env.FF_ARM_B_DELIVERY_MODE;
  delete process.env.FF_ARM_B_DELIVERY_MODE;
  const def = resolveArmBConfig();
  check(
    "default = deterministic delivery + thinking blend",
    def.deliveryMode === "deterministic" && def.thinkingMode === "blend",
  );
  process.env.FF_ARM_B_DELIVERY_MODE = "llm";
  const llm = resolveArmBConfig();
  check(
    "FF_ARM_B_DELIVERY_MODE=llm → all-LLM",
    llm.deliveryMode === "llm" && llm.thinkingMode === "llm",
  );
  if (saved === undefined) delete process.env.FF_ARM_B_DELIVERY_MODE;
  else process.env.FF_ARM_B_DELIVERY_MODE = saved;
}

// ── Arm C: parseDeliveryToneDecomp ──
{
  const good = JSON.stringify({
    delivery: { score: 76, signals: ["rate 150"], feedback: "steady pace" },
    toneObservations: [
      { subSkill: "directness", level: "strong", evidence: "led with the ask" },
      { subSkill: "authority", level: "present" },
      { subSkill: "assertiveness", level: "weak", evidence: "hedged the close" },
    ],
    toneFeedback: "Confident open, softer landing.",
  });
  const parsed = parseDeliveryToneDecomp(good);
  check("decomp parses delivery score", parsed?.deliveryScore === 76, `${parsed?.deliveryScore}`);
  check("decomp keeps 3 observations", parsed?.observations.length === 3, `${parsed?.observations.length}`);
  check("decomp carries tone feedback", parsed?.toneFeedback === "Confident open, softer landing.");

  // Unknown tone sub-skills are dropped but valid ones survive.
  const mixed = JSON.stringify({
    delivery: { score: 60 },
    toneObservations: [
      { subSkill: "directness", level: "present" },
      { subSkill: "made_up_skill", level: "strong" },
    ],
  });
  check("decomp drops unknown observations", parseDeliveryToneDecomp(mixed)?.observations.length === 1);

  // Missing delivery → null (fall back).
  check(
    "decomp with no delivery → null",
    parseDeliveryToneDecomp(JSON.stringify({ toneObservations: [{ subSkill: "directness", level: "strong" }] })) === null,
  );
  // No usable observations → null.
  check(
    "decomp with no observations → null",
    parseDeliveryToneDecomp(JSON.stringify({ delivery: { score: 70 }, toneObservations: [] })) === null,
  );
  check("decomp malformed → null", parseDeliveryToneDecomp("garbage") === null);
}

// ── renderSynthesisScope: carries all six decided scores ──
{
  const dims6 = [
    ...parseScoringPass(contentJson(), CONTENT_DIMS)!,
    ...parseScoringPass(deliveryJson(), DELIVERY_DIMS)!,
  ];
  const scope = renderSynthesisScope(dims6);
  check("scope names the synthesis pass", scope.includes("SYNTHESIS PASS"));
  check("scope lists decided scores", scope.includes("DECIDED SCORES"));
  check(
    "scope carries every dimension",
    ["clarity", "structure", "conciseness", "thinking_quality", "delivery", "tone"].every(
      (d) => scope.includes(d),
    ),
  );
}

// ── lean-split scopes: leaner output + the clarity-regression fix ──
{
  // Content pass drops the `signals` field and asks for ONE sentence...
  check(
    "lean content scope drops the signals output field",
    !CONTENT_SCOPE_LEAN.includes(`"signals":["..."]`) &&
      !CONTENT_SCOPE_LEAN.includes(`"signals": ["..."]`),
  );
  check(
    "lean content scope asks for 1 sentence of feedback",
    CONTENT_SCOPE_LEAN.includes("ONE tight sentence"),
  );
  // ...and critically REMOVES the 'spend full budget on rich feedback' line
  // that drove the grouped-fanout clarity regression, replacing it with an
  // explicit anti-compression guard.
  check(
    "base content scope had the rich-feedback pressure",
    CONTENT_SCOPE.includes("full token budget on rich"),
  );
  check(
    "lean content scope removes the rich-feedback pressure",
    !CONTENT_SCOPE_LEAN.includes("full token budget on rich"),
  );
  check(
    "lean content scope carries an anti-compression guard",
    CONTENT_SCOPE_LEAN.includes("NEVER pull a score down") ||
      CONTENT_SCOPE_LEAN.includes("must NEVER pull a score down"),
  );
  check(
    "lean content scope still names the four content dims",
    ["clarity", "structure", "conciseness", "thinking_quality"].every((d) =>
      CONTENT_SCOPE_LEAN.includes(d),
    ),
  );
  check(
    "lean delivery scope drops signals + asks 1 sentence",
    !DELIVERY_SCOPE_LEAN.includes(`"signals":["..."]`) &&
      DELIVERY_SCOPE_LEAN.includes('"feedback":"1 sentence"'),
  );
}

// ── holistic-split scopes: the fan-out CALIBRATION fix ──
{
  // The base delivery scope ISOLATES the tone pass from content — this is the
  // calibration loss the holistic arm fixes.
  check(
    "base delivery scope forbids content reasoning (the loss)",
    __armBForTests.DELIVERY_SCOPE.includes("never the argument's content"),
  );
  // The holistic delivery scope must NOT carry that isolation, and must
  // explicitly license reading the transcript for tone evidence.
  check(
    "holistic delivery scope removes the content-isolation ban",
    !DELIVERY_SCOPE_HOLISTIC.includes("never the argument's content") &&
      !DELIVERY_SCOPE_HOLISTIC.includes("reason ONLY about voice"),
  );
  check(
    "holistic delivery scope licenses transcript cues for tone",
    /transcript/i.test(DELIVERY_SCOPE_HOLISTIC) &&
      /phrasing|word-choice|word choice/i.test(DELIVERY_SCOPE_HOLISTIC),
  );
  check(
    "holistic delivery scope still emits ONLY delivery + tone",
    DELIVERY_SCOPE_HOLISTIC.includes('"delivery"|"tone"') &&
      DELIVERY_SCOPE_HOLISTIC.includes("Do NOT include content dimensions"),
  );
  // Holistic content scope: keeps the anti-nitpick guard (like lean) but NOT
  // the rich-feedback pressure that drove grouped-fanout's clarity blowup.
  check(
    "holistic content scope drops the rich-feedback pressure",
    !CONTENT_SCOPE_HOLISTIC.includes("full token budget on rich"),
  );
  check(
    "holistic content scope carries an anti-nitpick guard",
    /do not hunt for nitpicks/i.test(CONTENT_SCOPE_HOLISTIC),
  );
  check(
    "holistic content scope names the four content dims + emits only them",
    ["clarity", "structure", "conciseness", "thinking_quality"].every((d) =>
      CONTENT_SCOPE_HOLISTIC.includes(d),
    ) && CONTENT_SCOPE_HOLISTIC.includes("Do NOT include delivery, tone"),
  );
  // Both holistic passes emit the SAME JSON shape as the base scopes, so the
  // existing parser round-trips them unchanged.
  check(
    "parser round-trips a holistic content pass",
    parseScoringPass(contentJson(), CONTENT_DIMS) != null,
  );
  check(
    "parser round-trips a holistic delivery pass",
    parseScoringPass(deliveryJson(), DELIVERY_DIMS) != null,
  );
}

console.log("\n════════════════════════════════════════════════════════════");
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail === 0) console.log("  ✓ all score-arm-b tests pass");
else process.exitCode = 1;
