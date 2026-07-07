/**
 * Phase 14 — provider-agnostic AI layer unit tests.
 *
 *   • per-role OpenAI model resolution (MODELS role keys → OPENAI_MODELS)
 *   • hard-key-failure classification (what may trip the breaker)
 *   • dead-provider circuit breaker open/reset semantics
 *
 * Pure in-memory — no network calls, no API keys needed.
 *
 * Run: npx tsx tests/ai-provider.test.ts
 */

import { MODELS, __breakerForTests as B } from "@/lib/ai/claude";

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

section("openaiModelForRole");
{
  const scoring = B.openaiModelForRole(MODELS.scoring);
  const framework = B.openaiModelForRole(MODELS.framework);
  const expectedScoring =
    process.env.OPENAI_SCORING_MODEL ??
    process.env.OPENAI_FALLBACK_MODEL ??
    "gpt-4o";
  const expectedFramework =
    process.env.OPENAI_FRAMEWORK_MODEL ??
    process.env.OPENAI_FALLBACK_MODEL ??
    "gpt-4o";
  assert(scoring === expectedScoring, "scoring role resolves per env chain");
  assert(
    framework === expectedFramework,
    "framework role resolves per env chain",
  );
  assert(
    B.openaiModelForRole("some-unknown-model") === expectedScoring,
    "unknown role keys default to the scoring model",
  );
}

section("isHardKeyFailure");
{
  assert(
    B.isHardKeyFailure(
      new Error(
        '400 {"type":"error","error":{"message":"Your credit balance is too low to access the Anthropic API."}}',
      ),
    ),
    "credit balance → hard",
  );
  assert(
    B.isHardKeyFailure(new Error("insufficient_quota: please check billing")),
    "insufficient_quota → hard",
  );
  assert(
    B.isHardKeyFailure(new Error("authentication_error: invalid key")),
    "authentication_error → hard",
  );
  assert(
    !B.isHardKeyFailure(new Error("500 internal server error")),
    "5xx → NOT hard (transient, must not trip the breaker)",
  );
  assert(
    !B.isHardKeyFailure(new Error("anthropic timeout after 5000ms")),
    "timeout → NOT hard",
  );
  assert(!B.isHardKeyFailure("string throw"), "non-Error → NOT hard");
}

section("circuit breaker");
{
  B.reset();
  const hard = new Error("credit_balance_too_low");

  assert(!B.breakerOpen("anthropic"), "starts closed");
  B.recordProviderOutcome("anthropic", hard);
  assert(!B.breakerOpen("anthropic"), "one hard failure stays closed");
  B.recordProviderOutcome("anthropic", hard);
  assert(B.breakerOpen("anthropic"), "second hard failure opens");
  assert(
    B.state.anthropic.lastReason?.includes("credit_balance_too_low"),
    "reason captured",
  );
  assert(!B.breakerOpen("openai"), "peer breaker independent");

  // Success resets everything.
  B.recordProviderOutcome("anthropic", null);
  assert(!B.breakerOpen("anthropic"), "success closes + resets");
  assert(
    B.state.anthropic.consecutiveHardFailures === 0,
    "failure count reset on success",
  );

  // Transient failures never accumulate.
  B.reset();
  B.recordProviderOutcome("openai", new Error("503 upstream"));
  B.recordProviderOutcome("openai", new Error("openai timeout after 15000ms"));
  B.recordProviderOutcome("openai", new Error("429 rate limited"));
  assert(
    !B.breakerOpen("openai") &&
      B.state.openai.consecutiveHardFailures === 0,
    "transient failures never trip the breaker",
  );

  B.reset();
}

console.log("\n══════════════════════════════════════════════════════════════");
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail > 0) {
  console.log("  failures:");
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
console.log("  ✓ all ai-provider tests pass");
