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

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[ai] ANTHROPIC_API_KEY is not set. Claude calls will fail.");
}
if (!openaiKey && process.env.NODE_ENV !== "test") {
  console.warn(
    "[ai] OPENAI_API_KEY not set — fallback to OpenAI is disabled. " +
      "Claude failures will surface to callers as-is.",
  );
}

const realAnthropic = new Anthropic({
  apiKey: apiKey ?? "missing",
});

const realOpenAI: OpenAI | null = openaiKey
  ? new OpenAI({ apiKey: openaiKey })
  : null;

/** Errors we should fall back ON. Credit-balance + auth + 4xx/5xx
 *  errors all qualify; ZodError-style validation errors don't (those
 *  are bugs in our request, not provider failures). */
function shouldFallback(err: unknown): boolean {
  if (!realOpenAI) return false;
  if (err instanceof Error) {
    const msg = err.message ?? "";
    if (msg.includes("credit balance")) return true;
    if (msg.includes("credit_balance_too_low")) return true;
    if (msg.includes("Your credit balance is too low")) return true;
    if (msg.includes("organization_not_found")) return true;
    if (msg.includes("authentication_error")) return true;
    // Most Anthropic SDK errors carry a `status` property when they
    // came from the wire. 4xx + 5xx → fallback. Network errors → also
    // fallback (retry on a different provider beats hard-failing).
    const status = (err as { status?: number }).status;
    if (typeof status === "number" && status >= 400) return true;
    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) return true;
    if (msg.includes("fetch failed")) return true;
  }
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
 * The public `anthropic` export. Preserves the
 * `anthropic.messages.create(...)` shape every call site already uses,
 * but routes through the fallback wrapper above. Streaming is NOT
 * wrapped (Cognify doesn't stream from Anthropic in any current call
 * site); a streaming consumer would need to extend this shim.
 */
export const anthropic = {
  messages: {
    create: messagesCreateWithFallback,
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
