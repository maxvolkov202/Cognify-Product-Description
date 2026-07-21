// Grading Engine V2 — model pricing for the eval bench.
//
// USD per 1M tokens. No pricing helper existed in the repo; the bench
// needs one to turn the token counts scoring_telemetry already captures
// into a per-rep cost per arm.
//
// Rates (verified 2026-07 against the claude-api pricing skill + OpenAI):
//   claude-haiku-4-5: $1.00 in / $5.00 out. Anthropic cache read ~0.1x
//     base input; cache write 1.25x (5-min TTL). → read $0.10, write $1.25.
//   gpt-4o:           $2.50 in / $10.00 out. OpenAI cached input $1.25;
//     no separate cache-write premium (auto prefix caching). → read $1.25.
//   mock-fallback:    free (no LLM call was made).
//
// Update these when provider pricing changes; the bench prints the rates
// it used so a stale table is visible in the report.

export const MODEL_PRICING = {
  // $ per 1M tokens
  "claude-haiku-4-5": { in: 1.0, out: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet": { in: 3.0, out: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus": { in: 5.0, out: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
  "gpt-4o": { in: 2.5, out: 10.0, cacheRead: 1.25, cacheWrite: 0.0 },
  "mock-fallback": { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 },
};

/** Strip the provider tag the shim prepends ("openai:", "openai-fallback:",
 *  "anthropic-fallback:", "anthropic:") so "openai-fallback:gpt-4o" and
 *  "gpt-4o" resolve to the same family. */
export function stripProviderTag(modelUsed) {
  if (!modelUsed) return "";
  const colon = modelUsed.indexOf(":");
  return colon === -1 ? modelUsed : modelUsed.slice(colon + 1);
}

/** Resolve a pricing row by longest-prefix match on the bare model id.
 *  e.g. "claude-haiku-4-5-20251001" → the "claude-haiku-4-5" row. Returns
 *  null when nothing matches (caller decides whether that's fatal). */
export function priceFor(modelUsed) {
  const bare = stripProviderTag(modelUsed);
  let best = null;
  let bestLen = -1;
  for (const key of Object.keys(MODEL_PRICING)) {
    if (bare.startsWith(key) && key.length > bestLen) {
      best = MODEL_PRICING[key];
      bestLen = key.length;
    }
  }
  return best;
}

/**
 * USD cost of one scoring_telemetry row from its token counts. Prices
 * cache-read and cache-write (cache_creation) separately from fresh input
 * so cold (first-rep) vs warm (steady-state) costs are honest.
 *
 * @param {object} row - { modelUsed, inputTokens, outputTokens,
 *                         cacheReadTokens, cacheCreationTokens }
 * @returns {{usd:number, breakdown:object, priced:boolean}}
 */
export function computeUsd(row) {
  const p = priceFor(row.modelUsed);
  if (!p) {
    return { usd: 0, breakdown: {}, priced: false };
  }
  const per1M = (tokens, rate) => ((tokens ?? 0) / 1_000_000) * rate;
  const breakdown = {
    input: per1M(row.inputTokens, p.in),
    output: per1M(row.outputTokens, p.out),
    cacheRead: per1M(row.cacheReadTokens, p.cacheRead),
    cacheWrite: per1M(row.cacheCreationTokens, p.cacheWrite),
  };
  const usd =
    breakdown.input +
    breakdown.output +
    breakdown.cacheRead +
    breakdown.cacheWrite;
  return { usd, breakdown, priced: true };
}
