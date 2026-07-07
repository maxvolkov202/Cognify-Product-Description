import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Cognify AI provider shim — provider-peer dispatch with cross-provider
 * fallback.
 *
 * Both Anthropic and OpenAI are treated as canonical serving paths.
 * `SCORING_PROVIDER` (env: "anthropic" | "openai", default "anthropic")
 * selects the primary. The non-primary serves as fallback when the
 * primary fails an eligibility check (timeouts, 5xx, 429, credit /
 * auth, network) AND the appropriate API key is configured for it.
 *
 * Call sites use `anthropic.messages.create(params)` — the export name
 * is legacy but the shape is provider-agnostic.
 *
 * Model tagging (so /ops + telemetry can detect which provider answered):
 *   - Anthropic served as primary: `<anthropic-model-id>` (unprefixed)
 *   - Anthropic served as fallback: `anthropic-fallback:<model-id>`
 *   - OpenAI served as primary:    `openai:<model-id>`
 *   - OpenAI served as fallback:   `openai-fallback:<model-id>` (legacy tag preserved)
 *
 * The `MODEL_VERSIONS` export stays Anthropic-flavored for back-compat with
 * stored `model_version` columns, but the live model on each response is
 * carried in `response.model` with the tags above.
 *
 * Latency tradeoff: the wrapper adds zero overhead on the happy path —
 * only inspects errors. A failing primary + successful fallback costs
 * one extra HTTP round-trip.
 */

const apiKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
// Speed-first default. Benchmarked 2026-05-21 against the actual scoring
// prompt shape (~25KB system, ~3KB user, 4000 max_tokens, 2 successive
// calls to measure prompt-cache benefit):
//   gpt-4o         5.6s cold / 9.2s warm — winner on raw latency
//   gpt-4.1-nano   7.3s cold / 6.5s warm — 25x cheaper than 4o, similar speed
//   gpt-4.1-mini   7.3s / 8.3s          — slower in practice (was prior default)
//   gpt-4o-mini    8.3s / 8.8s
//   gpt-4.1       11.7s / 8.2s
//   gpt-5-mini    14.1s / 18.9s         — reasoning model, wrong shape for live scoring
// gpt-4o is the speed-first choice (matches Anthropic Haiku 4.5's
// speed-first philosophy on the primary side). For cost-first non-live
// scoring, set OPENAI_FALLBACK_MODEL=gpt-4.1-nano in env — same latency,
// 25x cheaper, quality TBD against the calibration harness.
const openaiFallbackModel =
  process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o";

// Phase 14 — per-ROLE OpenAI models, mirroring the Anthropic MODELS map
// so provider choice never collapses the scoring/framework distinction.
// Call sites keep passing the Anthropic-flavored ids from MODELS as the
// stable ROLE KEY; when OpenAI serves (primary or fallback) the id is
// resolved through this map. OPENAI_FALLBACK_MODEL stays honored as the
// both-roles default for back-compat.
const OPENAI_MODELS: Record<"scoring" | "framework", string> = {
  scoring: process.env.OPENAI_SCORING_MODEL ?? openaiFallbackModel,
  framework: process.env.OPENAI_FRAMEWORK_MODEL ?? openaiFallbackModel,
};

/** Map an Anthropic-flavored role-key model id → the OpenAI model that
 *  plays the same role. Unknown ids get the scoring default (safe: it is
 *  the speed-first choice). */
function openaiModelForRole(anthropicModelId: string): string {
  if (anthropicModelId === MODELS.framework) return OPENAI_MODELS.framework;
  return OPENAI_MODELS.scoring;
}

// Phase 14 — ONE provider knob for EVERY AI path (scoring, prompt gen,
// prep plans, narratives, talking points). `AI_PROVIDER` is canonical;
// `SCORING_PROVIDER` remains a legacy alias (it used to govern only the
// scoring path while everything else stayed Anthropic-primary — that
// asymmetry meant "openai mode" still burned a dead Anthropic round-trip
// on every non-scoring call). Values: "anthropic" (default) | "openai".
const rawProvider = (
  process.env.AI_PROVIDER ??
  process.env.SCORING_PROVIDER ??
  "anthropic"
)
  .trim()
  .toLowerCase();
const PRIMARY_PROVIDER: "anthropic" | "openai" =
  rawProvider === "openai" ? "openai" : "anthropic";
if (rawProvider !== PRIMARY_PROVIDER && process.env.NODE_ENV !== "test") {
  console.warn(
    `[ai] AI_PROVIDER="${rawProvider}" not recognized — falling back to "anthropic". Valid values: "anthropic" | "openai".`,
  );
}
type Provider = "anthropic" | "openai";

// Phase 1 — explicit per-call timeouts. Without these, a slow upstream
// could block the scoring route for the full Vercel maxDuration (60s).
// Defaults tuned against measured latency on the scoring path (26 KB
// prompt after Phase 3 slim, ~8000 input tokens, 4000 max_tokens):
//   Anthropic: 5s — credit_balance + auth errors return in <500ms; real
//     responses take 2-4s on Haiku 4.5. 5s leaves headroom for slow
//     responses without letting a genuinely stuck call drag the user.
//   OpenAI:    15s — gpt-4o (the default fallback) on the scoring prompt
//     returns in 5-9s cold, faster with cache. 15s catches truly stuck
//     calls without clipping healthy responses. If switching to a slower
//     model like gpt-4.1-mini, bump to 25-30s; if switching to a faster
//     model like gpt-4.1-nano, tighten to 10s.
// Tunable via env so we can adjust without a redeploy.
const ANTHROPIC_TIMEOUT_MS = parseInt(
  process.env.SCORING_ANTHROPIC_TIMEOUT_MS ?? "5000",
  10,
);
const OPENAI_TIMEOUT_MS = parseInt(
  process.env.SCORING_OPENAI_TIMEOUT_MS ?? "15000",
  10,
);

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[ai] ANTHROPIC_API_KEY is not set. Claude calls will fail.");
}
if (!openaiKey && process.env.NODE_ENV !== "test") {
  console.warn(
    "[ai] OPENAI_API_KEY not set — fallback to OpenAI is disabled. " +
      "Claude failures will surface to callers as-is.",
  );
}

// CTO-scan C3 — maxRetries: 0 on BOTH SDKs so a single user request
// never compounds into N upstream calls. The wrapper's own fallback
// path is the only retry layer; SDK-internal retries would multiply
// against it.
const realAnthropic = new Anthropic({
  apiKey: apiKey ?? "missing",
  maxRetries: 0,
});

const realOpenAI: OpenAI | null = openaiKey
  ? new OpenAI({ apiKey: openaiKey, maxRetries: 0 })
  : null;

/** Errors we should fall back ON.
 *
 *  CTO-scan C3: the previous "any Error" predicate was too wide — it
 *  meant a transient network blip would silently spend an OpenAI call
 *  per attempt with no per-IP rate cap. Tightened to a small allowlist
 *  of error shapes that are TRULY provider-side failures and where
 *  fallback is meaningfully better than failing:
 *
 *    - SDK APIError with status >= 500 (server-side errors,
 *      genuinely transient — fallback is the right move)
 *    - status === 429 (rate-limited; the other provider has separate quota)
 *    - status === 401/403 + credit/auth message (the original credit
 *      lapse case the fallback was built for)
 *    - Network errors (ECONNREFUSED / ETIMEDOUT / fetch failed) —
 *      same connectivity layer is unlikely to fix on retry, but
 *      the other provider is on different infra so worth one attempt
 *
 *  NOT fallback-eligible:
 *    - 400 invalid_request (our request is malformed; other provider will
 *      error the same way)
 *    - 422 (validation)
 *    - any non-Error throw (programmer bug, not a provider failure)
 *
 *  Symmetric: applies to both Anthropic-failed and OpenAI-failed paths.
 *  Combined with `maxRetries: 0` on both SDKs (set at construction time),
 *  this prevents the compounding storm CTO scan flagged. */
function shouldFallback(err: unknown, fallbackClientReady: boolean): boolean {
  if (!fallbackClientReady) return false;
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  const status = (err as { status?: number }).status;

  // Credit/billing/auth — the original case.
  if (msg.includes("credit balance")) return true;
  if (msg.includes("credit_balance_too_low")) return true;
  if (msg.includes("organization_not_found")) return true;
  if (msg.includes("authentication_error")) return true;
  if (msg.includes("insufficient_quota")) return true;

  // 5xx + rate-limited only — server-side errors where another
  // provider is meaningfully different.
  if (typeof status === "number") {
    if (status >= 500) return true;
    if (status === 429) return true;
    // 4xx other than 429: our request is the problem; the other provider
    // will also reject. Don't waste the call.
    return false;
  }

  // Network errors — different infra is worth one attempt.
  if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("EAI_AGAIN")) return true;

  return false;
}

// ── Phase 14 — dead-provider circuit breaker ────────────────────────────
// A provider with a lapsed key / dead org fails IDENTICALLY on every call,
// yet each request still paid the failed round-trip (latency + log noise)
// before falling back. Hard key-level failures open the breaker for a
// cooldown window during which dispatch skips straight to the peer.
// In-memory per process — serverless instances each learn independently,
// which is exactly the isolation we want. Transient failures (5xx / 429 /
// timeouts) deliberately do NOT trip it.
const BREAKER_THRESHOLD = 2;
const BREAKER_COOLDOWN_MS = parseInt(
  process.env.AI_BREAKER_COOLDOWN_MS ?? "120000",
  10,
);

type BreakerState = {
  consecutiveHardFailures: number;
  openUntil: number;
  lastReason: string | null;
};
const breaker: Record<Provider, BreakerState> = {
  anthropic: { consecutiveHardFailures: 0, openUntil: 0, lastReason: null },
  openai: { consecutiveHardFailures: 0, openUntil: 0, lastReason: null },
};

/** Key-level failures that will repeat on every call until a human acts. */
function isHardKeyFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  return (
    msg.includes("credit balance") ||
    msg.includes("credit_balance_too_low") ||
    msg.includes("organization_not_found") ||
    msg.includes("authentication_error") ||
    msg.includes("insufficient_quota") ||
    msg.includes("invalid x-api-key") ||
    msg.includes("Incorrect API key")
  );
}

function breakerOpen(provider: Provider): boolean {
  return Date.now() < breaker[provider].openUntil;
}

function recordProviderOutcome(provider: Provider, err: unknown | null): void {
  const state = breaker[provider];
  if (err == null) {
    state.consecutiveHardFailures = 0;
    state.openUntil = 0;
    state.lastReason = null;
    return;
  }
  if (!isHardKeyFailure(err)) return;
  state.consecutiveHardFailures += 1;
  state.lastReason =
    err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160);
  if (
    state.consecutiveHardFailures >= BREAKER_THRESHOLD &&
    !breakerOpen(provider)
  ) {
    state.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.warn(
      `[ai] ${provider} breaker OPEN for ${Math.round(BREAKER_COOLDOWN_MS / 1000)}s after ${state.consecutiveHardFailures} hard key failures: ${state.lastReason}`,
    );
  }
}

/** Test-only introspection/reset (pure in-memory state). */
export const __breakerForTests = {
  state: breaker,
  reset(): void {
    for (const p of ["anthropic", "openai"] as const) {
      const s = breaker[p];
      s.consecutiveHardFailures = 0;
      s.openUntil = 0;
      s.lastReason = null;
    }
  },
  isHardKeyFailure,
  recordProviderOutcome,
  breakerOpen,
  openaiModelForRole: (id: string) => openaiModelForRole(id),
};

/** Translate Anthropic `messages.create` params to OpenAI chat
 *  completions format. Lossy by necessity — Anthropic's cache_control
 *  and per-block system structure don't have OpenAI equivalents — but
 *  the prompt content is preserved end-to-end. */
function translateToOpenAI(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
  // System: Anthropic accepts string | TextBlockParam[]. Concat to one string.
  let systemContent: string | undefined;
  if (typeof params.system === "string") {
    systemContent = params.system;
  } else if (Array.isArray(params.system)) {
    systemContent = params.system
      .map((block) => {
        if (typeof block === "string") return block;
        if (block.type === "text") return block.text;
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  // Messages: Anthropic uses { role, content } where content is string |
  // ContentBlockParam[]. OpenAI uses { role, content } as string for
  // most simple cases. Translate text content; drop image / tool blocks
  // (out of scope for the score path).
  const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemContent) {
    openAiMessages.push({ role: "system", content: systemContent });
  }
  for (const m of params.messages) {
    let content: string;
    if (typeof m.content === "string") {
      content = m.content;
    } else {
      content = m.content
        .map((block) => {
          if (block.type === "text") return block.text;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    if (m.role === "user") {
      openAiMessages.push({ role: "user", content });
    } else if (m.role === "assistant") {
      openAiMessages.push({ role: "assistant", content });
    }
  }

  return {
    model: openaiModelForRole(params.model),
    max_tokens: params.max_tokens,
    messages: openAiMessages,
    // Match Anthropic's default temperature behavior for parity.
    ...(params.temperature != null
      ? { temperature: params.temperature }
      : {}),
  };
}

/** Translate OpenAI's chat completion response back into Anthropic's
 *  `messages.create` response shape so call sites that destructure
 *  `response.content[0].text` keep working.
 *
 *  `role` tags the model_used field so telemetry distinguishes
 *  "OpenAI served as primary (configured serving path)" from "OpenAI
 *  served as fallback (Anthropic failed)". The tag prefix is the
 *  hook /ops + dashboards key on. */
function translateFromOpenAI(
  resp: OpenAI.Chat.ChatCompletion,
  role: "primary" | "fallback",
): Anthropic.Messages.Message {
  const text = resp.choices[0]?.message?.content ?? "";
  const finishReason = resp.choices[0]?.finish_reason;
  const stopReason: Anthropic.Messages.StopReason =
    finishReason === "length"
      ? "max_tokens"
      : finishReason === "tool_calls"
        ? "tool_use"
        : "end_turn";
  const tag = role === "primary" ? "openai" : "openai-fallback";
  return {
    id: resp.id,
    type: "message",
    role: "assistant",
    model: `${tag}:${resp.model}`,
    content: [{ type: "text", text, citations: [] }],
    stop_reason: stopReason,
    stop_sequence: null,
    container: null,
    stop_details: null,
    usage: {
      input_tokens: resp.usage?.prompt_tokens ?? 0,
      output_tokens: resp.usage?.completion_tokens ?? 0,
      // OpenAI auto-caches prefixes >= 1024 tokens (no header needed).
      // The cached count lives at usage.prompt_tokens_details.cached_tokens.
      // Surface it through the same field the Anthropic path uses so the
      // health/stats dashboard's cache-hit rate works for both providers.
      cache_creation_input_tokens: null,
      cache_read_input_tokens:
        (
          resp.usage as { prompt_tokens_details?: { cached_tokens?: number } }
        )?.prompt_tokens_details?.cached_tokens ?? null,
      server_tool_use: null,
      service_tier: null,
      cache_creation: null,
      inference_geo: null,
    },
  };
}

/** Internal: call Anthropic with timeout + abort handling. Returns the
 *  response with `model` set to the unprefixed Anthropic model id (when
 *  served as primary) or `anthropic-fallback:<id>` (when served as
 *  fallback). Throws on any error (caller decides whether to fall back). */
async function callAnthropicOnce(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  role: "primary" | "fallback",
  timeoutMs: number = ANTHROPIC_TIMEOUT_MS,
): Promise<{ response: Anthropic.Messages.Message; durationMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const start = Date.now();
  try {
    const response = (await realAnthropic.messages.create(params, {
      signal: controller.signal,
    })) as Anthropic.Messages.Message;
    const tagged: Anthropic.Messages.Message =
      role === "fallback"
        ? { ...response, model: `anthropic-fallback:${response.model}` }
        : response;
    return { response: tagged, durationMs: Date.now() - start };
  } catch (err) {
    const isAbort =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError") ||
      /\babort(ed)?\b/i.test(err instanceof Error ? err.message : String(err));
    if (isAbort) {
      const wrapped = new Error(
        `anthropic timeout after ${timeoutMs}ms`,
      );
      wrapped.name = "AbortError";
      throw wrapped;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Internal: call OpenAI with timeout + abort handling. `role` tags the
 *  model in the translated Anthropic-shaped response. Throws on any
 *  error (caller decides whether to fall back). */
async function callOpenAIOnce(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  role: "primary" | "fallback",
  timeoutMs: number = OPENAI_TIMEOUT_MS,
): Promise<{ response: Anthropic.Messages.Message; durationMs: number }> {
  if (!realOpenAI) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const start = Date.now();
  try {
    const openaiParams = translateToOpenAI(params);
    const openaiResp = await realOpenAI.chat.completions.create(openaiParams, {
      signal: controller.signal,
    });
    return {
      response: translateFromOpenAI(openaiResp, role),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const isAbort =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError") ||
      /\babort(ed)?\b/i.test(err instanceof Error ? err.message : String(err));
    if (isAbort) {
      const wrapped = new Error(
        `openai timeout after ${timeoutMs}ms`,
      );
      wrapped.name = "AbortError";
      throw wrapped;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Phase 14 — generation-path timeouts. These calls (plans, readiness
// reviews, narratives, prompt gen) legitimately run long, but an
// unbounded upstream call can hang a server action for the platform's
// whole maxDuration. Generous, env-tunable ceilings.
const GEN_ANTHROPIC_TIMEOUT_MS = parseInt(
  process.env.AI_GEN_ANTHROPIC_TIMEOUT_MS ?? "90000",
  10,
);
const GEN_OPENAI_TIMEOUT_MS = parseInt(
  process.env.AI_GEN_OPENAI_TIMEOUT_MS ?? "120000",
  10,
);

/** Non-scoring wrapper: provider-agnostic since Phase 14.
 *
 *  Used by framework gen, weekly narrative, talking points, prompt gen,
 *  prep plans, readiness reviews. Honors the SAME AI_PROVIDER primary as
 *  the scoring path (it used to be hardcoded Anthropic-primary, so
 *  "openai mode" still burned a dead Anthropic round-trip per call),
 *  consults the dead-provider breaker, and applies generation-grade
 *  timeouts. Same eligibility rules as the scoring path; no metrics
 *  object (callers don't record telemetry rows). */
async function messagesCreateWithFallback(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Messages.Message> {
  const isOpenAIPrimary = PRIMARY_PROVIDER === "openai";
  const fallbackReady = isOpenAIPrimary ? !!apiKey : !!realOpenAI;

  const callPrimary = () =>
    isOpenAIPrimary
      ? callOpenAIOnce(params, "primary", GEN_OPENAI_TIMEOUT_MS)
      : callAnthropicOnce(params, "primary", GEN_ANTHROPIC_TIMEOUT_MS);
  const callFallback = () =>
    isOpenAIPrimary
      ? callAnthropicOnce(params, "fallback", GEN_ANTHROPIC_TIMEOUT_MS)
      : callOpenAIOnce(params, "fallback", GEN_OPENAI_TIMEOUT_MS);
  const primaryName: Provider = isOpenAIPrimary ? "openai" : "anthropic";
  const fallbackName: Provider = isOpenAIPrimary ? "anthropic" : "openai";

  // Breaker short-circuit: a provider known-dead on key-level failures
  // skips straight to the peer for the cooldown window.
  if (breakerOpen(primaryName) && fallbackReady) {
    const { response } = await callFallback();
    recordProviderOutcome(fallbackName, null);
    return response;
  }

  try {
    const { response } = await callPrimary();
    recordProviderOutcome(primaryName, null);
    return response;
  } catch (err) {
    recordProviderOutcome(primaryName, err);
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      /abort(ed)?|timed out/i.test(
        err instanceof Error ? err.message : String(err),
      );
    if ((!isAbort && !shouldFallback(err, fallbackReady)) || !fallbackReady) {
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ai] ${primaryName} call failed — falling back to ${fallbackName}. Reason:`,
      errMsg.slice(0, 200),
    );
    const { response } = await callFallback();
    recordProviderOutcome(fallbackName, null);
    return response;
  }
}

/**
 * Phase 0 — telemetry-bearing variant of the scoring-path call.
 * Provider-peer aware: tries SCORING_PROVIDER's primary, falls back to
 * the other on eligibility. Returns the same Anthropic-shaped response
 * PLUS a metrics object capturing what actually happened upstream so the
 * scoring path can write a scoring_telemetry row at request end.
 *
 * Why separate from `create`: framework gen / weekly narrative / etc.
 * don't care about metrics or which provider is canonical. Keeping
 * `create` unchanged means those paths stay zero-overhead.
 *
 * The metrics object does NOT include validation/sanitization timing —
 * that happens in scoreRep after this returns.
 */
export type AnthropicCallMetrics = {
  /** Final model that answered. Prefixed per the tagging convention at
   *  the top of this file so /ops + telemetry can detect provider role. */
  modelUsed: string;
  /** Wall-clock time of the upstream call (primary OR fallback, includes
   *  fallback overhead when fallback fired). */
  modelDurationMs: number;
  /** Prompt size we sent — sum of system blocks + user message bytes.
   *  Computed by the caller (the wrapper doesn't know what counts as
   *  "the prompt"); passed in via the recordPromptSize callback. */
  promptSizeBytes: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  /** Whether the fallback path fired (primary failed, fallback served). */
  fallbackFired: boolean;
  /** When fallback fired but ultimately succeeded, the route handler's
   *  catch never sees what caused the original primary failure. Capture
   *  it here so telemetry can show "fallback fired because of <reason>"
   *  without joining log lines. Field name kept for back-compat — under
   *  the provider-peer model this carries the PRIMARY-provider error
   *  regardless of which provider is configured as primary. Trimmed to
   *  ~300 chars at write time. Null when no fallback fired. */
  underlyingAnthropicError: string | null;
  /** Phase 1 — Anthropic call wall-clock. Set whenever Anthropic was
   *  attempted (as primary OR fallback). 0 when Anthropic wasn't
   *  attempted at all (OpenAI primary + OpenAI succeeded). */
  anthropicDurationMs: number;
  /** Phase 1 — OpenAI call wall-clock. Set whenever OpenAI was
   *  attempted (as primary OR fallback). Null when OpenAI wasn't
   *  attempted at all. */
  openaiDurationMs: number | null;
};

export type AnthropicCallResult = {
  response: Anthropic.Messages.Message;
  metrics: AnthropicCallMetrics;
};

async function messagesCreateWithMetrics(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  promptSizeBytes?: number,
): Promise<AnthropicCallResult> {
  const wrapperStart = Date.now();
  let fallbackFired = false;
  let underlyingPrimaryError: string | null = null;
  let anthropicDurationMs = 0;
  let openaiDurationMs: number | null = null;

  const isOpenAIPrimary = PRIMARY_PROVIDER === "openai";
  // For OpenAI primary, the fallback client is Anthropic (always
  // available since we constructed it). For Anthropic primary, the
  // fallback client is OpenAI (only available when OPENAI_API_KEY set).
  const fallbackReady = isOpenAIPrimary ? !!apiKey : !!realOpenAI;
  const primaryProviderName: Provider = isOpenAIPrimary
    ? "openai"
    : "anthropic";
  const fallbackProviderName: Provider = isOpenAIPrimary
    ? "anthropic"
    : "openai";
  // Phase 14 — dead-provider breaker: skip a known-dead primary for the
  // cooldown window instead of paying its failed round-trip per call.
  const skipPrimary = breakerOpen(primaryProviderName) && fallbackReady;

  let response: Anthropic.Messages.Message;
  try {
    if (skipPrimary) {
      throw new Error(
        `breaker open: ${breaker[primaryProviderName].lastReason ?? "repeated hard key failures"}`,
      );
    }
    if (isOpenAIPrimary) {
      if (!realOpenAI) {
        throw new Error(
          "AI_PROVIDER=openai but OPENAI_API_KEY is not configured",
        );
      }
      const { response: r, durationMs } = await callOpenAIOnce(
        params,
        "primary",
      );
      response = r;
      openaiDurationMs = durationMs;
    } else {
      const { response: r, durationMs } = await callAnthropicOnce(
        params,
        "primary",
      );
      response = r;
      anthropicDurationMs = durationMs;
    }
    recordProviderOutcome(primaryProviderName, null);
  } catch (primaryErr) {
    if (!skipPrimary) recordProviderOutcome(primaryProviderName, primaryErr);
    underlyingPrimaryError =
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

    const isAbort =
      (primaryErr instanceof Error && primaryErr.name === "AbortError") ||
      /\babort(ed)?\b|timed out/i.test(underlyingPrimaryError);

    const fallbackEligible =
      skipPrimary || isAbort || shouldFallback(primaryErr, fallbackReady);
    if (!fallbackEligible || !fallbackReady) {
      throw primaryErr;
    }

    fallbackFired = true;
    const primaryName = isOpenAIPrimary ? "OpenAI" : "Anthropic";
    const fallbackName = isOpenAIPrimary ? "Anthropic" : "OpenAI";
    const fallbackModel = isOpenAIPrimary
      ? params.model // Anthropic serves with the role-key id as-is
      : openaiModelForRole(params.model);
    console.warn(
      `[ai] ${primaryName} call failed — falling back to ${fallbackName} ${fallbackModel}. Reason:`,
      (underlyingPrimaryError ?? "").slice(0, 200),
    );

    try {
      if (isOpenAIPrimary) {
        const { response: r, durationMs } = await callAnthropicOnce(
          params,
          "fallback",
        );
        response = r;
        anthropicDurationMs = durationMs;
      } else {
        const { response: r, durationMs } = await callOpenAIOnce(
          params,
          "fallback",
        );
        response = r;
        openaiDurationMs = durationMs;
      }
      recordProviderOutcome(fallbackProviderName, null);
    } catch (fallbackErr) {
      recordProviderOutcome(fallbackProviderName, fallbackErr);
      // BOTH providers failed. Wrap with the primary cause so the route
      // handler's catch + telemetry write can show "both providers failed"
      // + the actual reason on each. Without this wrap, only the fallback
      // error would survive, hiding why the call ever fell back.
      const fallbackIsAbort =
        (fallbackErr instanceof Error &&
          fallbackErr.name === "AbortError") ||
        /\babort(ed)?\b|timed out/i.test(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr),
        );
      const fallbackSummary =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr);
      const primaryTag = isOpenAIPrimary ? "openai" : "anthropic";
      const fallbackTag = isOpenAIPrimary ? "anthropic" : "openai";
      const combinedMsg = `both providers failed | ${primaryTag}: ${underlyingPrimaryError ?? "?"} | ${fallbackTag}: ${fallbackSummary}`;
      const wrapped = new Error(combinedMsg);
      if (fallbackIsAbort) wrapped.name = "AbortError";
      throw wrapped;
    }
  }

  const modelDurationMs = Date.now() - wrapperStart;
  const usage = response.usage;

  const metrics: AnthropicCallMetrics = {
    modelUsed: response.model,
    modelDurationMs,
    promptSizeBytes: promptSizeBytes ?? null,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    cacheReadTokens: usage?.cache_read_input_tokens ?? null,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? null,
    fallbackFired,
    underlyingAnthropicError: underlyingPrimaryError,
    anthropicDurationMs,
    openaiDurationMs,
  };

  // Single structured log line per call — grep-friendly in Vercel logs
  // and lets us correlate without joining the telemetry table.
  console.log(
    `[ai] call: provider=${PRIMARY_PROVIDER} model=${metrics.modelUsed} promptBytes=${metrics.promptSizeBytes ?? "?"} ` +
      `cacheRead=${metrics.cacheReadTokens ?? 0} cacheCreate=${metrics.cacheCreationTokens ?? 0} ` +
      `input=${metrics.inputTokens ?? 0} output=${metrics.outputTokens ?? 0} ` +
      `anthropicMs=${metrics.anthropicDurationMs} openaiMs=${metrics.openaiDurationMs ?? "-"} ` +
      `totalMs=${metrics.modelDurationMs} fallback=${metrics.fallbackFired}` +
      (metrics.underlyingAnthropicError
        ? ` why="${metrics.underlyingAnthropicError.slice(0, 120)}"`
        : ""),
  );

  return { response, metrics };
}

/**
 * The public `anthropic` export. Preserves the
 * `anthropic.messages.create(...)` shape every call site already uses,
 * but routes through the provider-aware dispatcher above. Streaming is
 * NOT wrapped (Cognify doesn't stream from Anthropic in any current call
 * site); a streaming consumer would need to extend this shim.
 */
export const anthropic = {
  messages: {
    create: messagesCreateWithFallback,
    /** Phase 0 — telemetry-bearing variant. Use from the scoring path
     *  only. Returns `{ response, metrics }` so the caller can write a
     *  scoring_telemetry row. Other call sites should keep using
     *  `.create()` (zero-overhead, no metrics). */
    createWithMetrics: messagesCreateWithMetrics,
  },
};

/** Which provider is configured as the canonical primary for the scoring
 *  path. Exported so /ops dashboards and the health/stats endpoint can
 *  surface the active configuration. */
export const SCORING_PROVIDER_ACTIVE = PRIMARY_PROVIDER;
/** Phase 14 — canonical name; SCORING_PROVIDER_ACTIVE kept for ops
 *  back-compat. */
export const AI_PROVIDER_ACTIVE = PRIMARY_PROVIDER;

// Latency tuning (2026-04-24): scoring is on the critical path of every
// rep, so we default to Haiku 4.5 for speed. The deterministic scorer
// already owns delivery + thinking_quality; the LLM only needs to score
// clarity, structure, conciseness, tone + author 3 callouts —
// well within Haiku's accuracy band. Override via ANTHROPIC_SCORING_MODEL
// for A/B tests against Sonnet.
export const MODELS = {
  scoring: process.env.ANTHROPIC_SCORING_MODEL ?? "claude-haiku-4-5-20251001",
  framework: process.env.ANTHROPIC_FRAMEWORK_MODEL ?? "claude-sonnet-4-6",
} as const;

export const MODEL_VERSIONS = {
  scoring: MODELS.scoring,
  framework: MODELS.framework,
} as const;
