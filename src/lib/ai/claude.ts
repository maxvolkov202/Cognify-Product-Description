import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Cognify AI provider shim — transparent OpenAI fallback for Anthropic.
 *
 * Every call site does `anthropic.messages.create(params)` against the
 * exported `anthropic` object below. The shim wraps the real Anthropic
 * SDK in a try/catch that, on a credit-balance / billing / 4xx-5xx
 * error AND when an OPENAI_API_KEY is configured, retries the same
 * call through OpenAI's chat completions API. The response is
 * translated BACK into Anthropic's `messages.create` response shape so
 * call sites don't need to know which provider answered.
 *
 * Tagging: fallback responses set `model = "openai-fallback:<model>"`
 * so the /ops calibration cron + any future telemetry can spot
 * fallback usage as distinct from real Anthropic responses. Existing
 * `MODEL_VERSIONS` stays Anthropic-flavored for back-compat with stored
 * `model_version` columns.
 *
 * Latency tradeoff: the fallback path adds one round-trip when
 * Anthropic fails fast. When Anthropic is healthy, the fallback adds
 * zero overhead — the wrapper only inspects errors.
 */

const apiKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const openaiFallbackModel = process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o";

// Phase 1 — explicit per-call timeouts. Without these, a slow upstream
// could block the scoring route for the full Vercel maxDuration (60s).
// Defaults tuned against the Phase 0 baseline (39 KB prompts, ~8000 input
// tokens):
//   Anthropic: 5s — credit_balance + auth errors return in <500ms; real
//     responses take 2-4s on Haiku 4.5. 5s leaves headroom for slow
//     responses without letting a genuinely stuck call drag the user.
//   OpenAI:    12s — gpt-4o on a 39KB prompt typically returns in 5-7s
//     but tail can reach 10s+ before slowing. 12s catches truly stuck
//     calls without clipping healthy responses. After Phase 3 (slim
//     knowledge → ~10KB prompt) we can tighten this back to ~6s.
// Tunable via env so we can adjust without a redeploy.
const ANTHROPIC_TIMEOUT_MS = parseInt(
  process.env.SCORING_ANTHROPIC_TIMEOUT_MS ?? "5000",
  10,
);
const OPENAI_TIMEOUT_MS = parseInt(
  process.env.SCORING_OPENAI_TIMEOUT_MS ?? "12000",
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
 *    - Anthropic SDK APIError with status >= 500 (server-side errors,
 *      genuinely transient — fallback is the right move)
 *    - status === 429 (rate-limited; OpenAI has separate quota)
 *    - status === 401/403 + credit/auth message (the original credit
 *      lapse case the fallback was built for)
 *    - Network errors (ECONNREFUSED / ETIMEDOUT / fetch failed) —
 *      same connectivity layer is unlikely to fix on retry, but
 *      OpenAI is on different infra so worth one attempt
 *
 *  NOT fallback-eligible:
 *    - 400 invalid_request (our request is malformed; OpenAI will
 *      error the same way)
 *    - 422 (Anthropic-specific validation)
 *    - any non-Error throw (programmer bug, not a provider failure)
 *
 *  Combined with `maxRetries: 0` on both SDKs (set at construction
 *  time), this prevents the compounding storm CTO scan flagged. */
function shouldFallback(err: unknown): boolean {
  if (!realOpenAI) return false;
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  const status = (err as { status?: number }).status;

  // Credit/billing/auth — the original case.
  if (msg.includes("credit balance")) return true;
  if (msg.includes("credit_balance_too_low")) return true;
  if (msg.includes("organization_not_found")) return true;
  if (msg.includes("authentication_error")) return true;

  // 5xx + rate-limited only — server-side errors where another
  // provider is meaningfully different.
  if (typeof status === "number") {
    if (status >= 500) return true;
    if (status === 429) return true;
    // 4xx other than 429: our request is the problem; OpenAI will
    // also reject. Don't waste the call.
    return false;
  }

  // Network errors — different infra is worth one attempt.
  if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("EAI_AGAIN")) return true;

  return false;
}

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
    model: openaiFallbackModel,
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
 *  `response.content[0].text` keep working. */
function translateFromOpenAI(
  resp: OpenAI.Chat.ChatCompletion,
): Anthropic.Messages.Message {
  const text = resp.choices[0]?.message?.content ?? "";
  const finishReason = resp.choices[0]?.finish_reason;
  const stopReason: Anthropic.Messages.StopReason =
    finishReason === "length"
      ? "max_tokens"
      : finishReason === "tool_calls"
        ? "tool_use"
        : "end_turn";
  return {
    id: resp.id,
    type: "message",
    role: "assistant",
    // Tag prefix lets /ops + telemetry detect fallback usage at a glance.
    model: `openai-fallback:${resp.model}`,
    content: [{ type: "text", text, citations: [] }],
    stop_reason: stopReason,
    stop_sequence: null,
    container: null,
    stop_details: null,
    usage: {
      input_tokens: resp.usage?.prompt_tokens ?? 0,
      output_tokens: resp.usage?.completion_tokens ?? 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
      service_tier: null,
      cache_creation: null,
      inference_geo: null,
    },
  };
}

/** Wrapped messages.create. Tries Anthropic first; on credit / auth /
 *  network / 4xx / 5xx error and OPENAI_API_KEY present, retries via
 *  OpenAI and returns an Anthropic-shaped response. Successful
 *  Anthropic calls have zero overhead. */
async function messagesCreateWithFallback(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Messages.Message> {
  try {
    return (await realAnthropic.messages.create(
      params,
    )) as Anthropic.Messages.Message;
  } catch (err) {
    if (!shouldFallback(err) || !realOpenAI) {
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ai] Anthropic call failed — falling back to OpenAI ${openaiFallbackModel}. Reason:`,
      errMsg.slice(0, 200),
    );
    const openaiParams = translateToOpenAI(params);
    const openaiResp = await realOpenAI.chat.completions.create(openaiParams);
    return translateFromOpenAI(openaiResp);
  }
}

/**
 * Phase 0 — telemetry-bearing variant of messagesCreateWithFallback.
 * Returns the same Anthropic-shaped response PLUS a metrics object
 * capturing what actually happened upstream so the scoring path can
 * write a scoring_telemetry row at request end.
 *
 * Why a separate function rather than overloading `create`: most call
 * sites (framework gen, weekly narrative, talking points, prompt gen,
 * etc.) don't care about metrics — keeping `create` unchanged means
 * those paths stay zero-overhead and we don't have to update them.
 * Only the scoring path uses this variant.
 *
 * The metrics object DOES NOT include validation/sanitization timing
 * — that happens in scoreRep after this returns, so scoreRep wraps
 * its own timing around the validation step and merges.
 */
export type AnthropicCallMetrics = {
  /** Final model that answered. 'openai-fallback:<model>' on fallback. */
  modelUsed: string;
  /** Wall-clock time of the upstream call (anthropic OR openai, includes
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
  /** Whether the OpenAI fallback fired. When true, the wrapper consumed
   *  both an Anthropic failure AND an OpenAI call. */
  fallbackFired: boolean;
  /** Phase 1 — when fallback fired but ultimately succeeded, the route
   *  handler's catch never sees what caused the original Anthropic
   *  failure. Capture it here so telemetry can show "fallback fired
   *  because of <reason>" without joining log lines. Trimmed to ~300
   *  chars at write time. Null when no fallback fired. */
  underlyingAnthropicError: string | null;
  /** Phase 1 — Anthropic call wall-clock specifically (vs modelDurationMs
   *  which spans the full wrapper including fallback). Useful for
   *  distinguishing "Anthropic was slow then OpenAI saved us" from
   *  "Anthropic returned an error fast and OpenAI took the time". */
  anthropicDurationMs: number;
  /** Phase 1 — OpenAI call wall-clock when fallback fired. Null otherwise. */
  openaiDurationMs: number | null;
};

export type AnthropicCallResult = {
  response: Anthropic.Messages.Message;
  metrics: AnthropicCallMetrics;
};

/**
 * Phase 1 — wrap a promise in an AbortController timeout. Rejects with
 * an AbortError if the timeout fires first. The categorizer recognizes
 * AbortError → "timeout" so telemetry buckets these correctly.
 *
 * Both Anthropic and OpenAI SDKs accept `{ signal }` in their request
 * options, so the abort is honored upstream (the HTTP request is
 * actually cancelled, not just our promise dropped).
 */
function withTimeout<T>(
  start: () => Promise<T>,
  timeoutMs: number,
  label: string,
): { promise: Promise<T>; signal: AbortSignal } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  const promise = start().finally(() => clearTimeout(timer));
  return { promise, signal: controller.signal };
}

async function messagesCreateWithMetrics(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  promptSizeBytes?: number,
): Promise<AnthropicCallResult> {
  const wrapperStart = Date.now();
  let fallbackFired = false;
  let underlyingAnthropicError: string | null = null;
  let anthropicDurationMs = 0;
  let openaiDurationMs: number | null = null;

  let response: Anthropic.Messages.Message;
  const anthropicController = new AbortController();
  const anthropicTimer = setTimeout(() => {
    anthropicController.abort();
  }, ANTHROPIC_TIMEOUT_MS);

  try {
    const anthropicStart = Date.now();
    try {
      response = (await realAnthropic.messages.create(params, {
        signal: anthropicController.signal,
      })) as Anthropic.Messages.Message;
    } finally {
      clearTimeout(anthropicTimer);
      anthropicDurationMs = Date.now() - anthropicStart;
    }
  } catch (err) {
    // Recognize SDK abort as a timeout-shaped error so shouldFallback +
    // the categorizer treat it consistently.
    const isAbort =
      anthropicController.signal.aborted ||
      (err instanceof Error && err.name === "AbortError") ||
      /\babort(ed)?\b/i.test(err instanceof Error ? err.message : String(err));
    if (isAbort) {
      underlyingAnthropicError = `anthropic timeout after ${ANTHROPIC_TIMEOUT_MS}ms`;
    } else {
      underlyingAnthropicError =
        err instanceof Error ? err.message : String(err);
    }

    // Only fall back when the error class warrants it. For timeouts we
    // explicitly DO want to fall back (OpenAI may be healthy when
    // Anthropic stalls), so extend shouldFallback's allow-list to
    // include abort-shaped errors.
    const fallbackEligible = isAbort || shouldFallback(err);
    if (!fallbackEligible || !realOpenAI) {
      throw err;
    }

    fallbackFired = true;
    console.warn(
      `[ai] Anthropic call failed — falling back to OpenAI ${openaiFallbackModel}. Reason:`,
      (underlyingAnthropicError ?? "").slice(0, 200),
    );

    const openaiController = new AbortController();
    const openaiTimer = setTimeout(() => {
      openaiController.abort();
    }, OPENAI_TIMEOUT_MS);
    const openaiStart = Date.now();
    try {
      const openaiParams = translateToOpenAI(params);
      const openaiResp = await realOpenAI.chat.completions.create(
        openaiParams,
        { signal: openaiController.signal },
      );
      response = translateFromOpenAI(openaiResp);
    } catch (openaiErr) {
      // BOTH providers failed. Wrap the OpenAI error with the original
      // Anthropic cause so the route handler's catch + telemetry write
      // can show "both providers failed" + the actual reason on each.
      // Without this wrap, only the OpenAI error would survive, hiding
      // why the call ever fell back in the first place.
      const openaiIsAbort =
        openaiController.signal.aborted ||
        (openaiErr instanceof Error && openaiErr.name === "AbortError") ||
        /\babort(ed)?\b/i.test(
          openaiErr instanceof Error ? openaiErr.message : String(openaiErr),
        );
      const openaiSummary = openaiIsAbort
        ? `openai timeout after ${OPENAI_TIMEOUT_MS}ms`
        : openaiErr instanceof Error
          ? openaiErr.message
          : String(openaiErr);
      const combinedMsg = `both providers failed | anthropic: ${underlyingAnthropicError ?? "?"} | openai: ${openaiSummary}`;
      const wrapped = new Error(combinedMsg);
      // Preserve abort-ness on the wrapper so categorizer correctly
      // assigns failure_reason=timeout when OpenAI was the abort cause.
      if (openaiIsAbort) wrapped.name = "AbortError";
      throw wrapped;
    } finally {
      clearTimeout(openaiTimer);
      openaiDurationMs = Date.now() - openaiStart;
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
    underlyingAnthropicError,
    anthropicDurationMs,
    openaiDurationMs,
  };

  // Single structured log line per call — grep-friendly in Vercel logs
  // and lets us correlate without joining the telemetry table.
  console.log(
    `[ai] call: model=${metrics.modelUsed} promptBytes=${metrics.promptSizeBytes ?? "?"} ` +
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

// Silence unused-import warnings — `withTimeout` is exported for
// potential streaming use in Phase 5.
void withTimeout;

/**
 * The public `anthropic` export. Preserves the
 * `anthropic.messages.create(...)` shape every call site already uses,
 * but routes through the fallback wrapper above. Streaming is NOT
 * wrapped (Cognify doesn't stream from Anthropic in any current call
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
