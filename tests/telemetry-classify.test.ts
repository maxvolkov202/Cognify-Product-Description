/**
 * Grading audit WS1 — failure classification + credits detection.
 * Run: npx tsx tests/telemetry-classify.test.ts
 */
import { categorizeFailure, resolveFallbackReason } from "@/lib/scoring/telemetry";
import { isProviderCreditsError } from "@/lib/ai/claude";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const withStatus = (msg: string, status: number) =>
  Object.assign(new Error(msg), { status });

// ── provider_credits ──
{
  const openai = withStatus(
    "429 You have no credits remaining. Add credits to continue.",
    429,
  );
  check("OpenAI no-credits → provider_credits", categorizeFailure(openai) === "provider_credits");
  check("isProviderCreditsError(openai)", isProviderCreditsError(openai));
  const anthropic = withStatus(
    "400 Your credit balance is too low to access the Anthropic API.",
    400,
  );
  check("Anthropic credit balance → provider_credits", categorizeFailure(anthropic) === "provider_credits");
  const quota = new Error("insufficient_quota: You exceeded your current quota");
  check("insufficient_quota → provider_credits", categorizeFailure(quota) === "provider_credits");
  // The 08-24 shape: both providers failed, primary for credits, fallback timed out.
  const both = Object.assign(
    new Error(
      "both providers failed | openai: 429 You have no credits remaining | anthropic: anthropic timeout after 20000ms",
    ),
    { name: "AbortError" },
  );
  check(
    "combined abort still classifies as timeout (first-match)",
    categorizeFailure(both) === "timeout",
    categorizeFailure(both),
  );
}

// ── existing buckets unchanged ──
{
  check("plain 429 → rate_limit_429", categorizeFailure(withStatus("Too many requests", 429)) === "rate_limit_429");
  check("rate limit text → rate_limit_429", categorizeFailure(new Error("rate limit exceeded")) === "rate_limit_429");
  check("5xx → network_error", categorizeFailure(withStatus("boom", 503)) === "network_error");
  check("timed out → timeout", categorizeFailure(new Error("anthropic timeout after 35000ms; timed out")) === "timeout");
  check("ZodError → validation_failed", categorizeFailure(Object.assign(new Error("x"), { name: "ZodError" })) === "validation_failed");
  check("max_tokens → truncated", categorizeFailure(new Error("stop_reason max_tokens")) === "truncated");
  check("nothing → unknown", categorizeFailure(new Error("???")) === "unknown");
  check("null → unknown", categorizeFailure(null) === "unknown");
  check("not credits", !isProviderCreditsError(new Error("fetch failed")));
}

// ── resolveFallbackReason ──
{
  check("no fallback → none", resolveFallbackReason({ fallbackFired: false, modelUsed: "gpt-4o" }) === "none");
  check(
    "anthropic tag",
    resolveFallbackReason({ fallbackFired: true, modelUsed: "anthropic-fallback:claude-haiku-4-5" }) === "anthropic_fallback_used",
  );
  check(
    "openai tag",
    resolveFallbackReason({ fallbackFired: true, modelUsed: "openai-fallback:gpt-4o" }) === "openai_fallback_used",
  );
}

console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all telemetry-classify tests pass");
else process.exitCode = 1;
