import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[ai] ANTHROPIC_API_KEY is not set. Claude calls will fail.");
}

export const anthropic = new Anthropic({
  apiKey: apiKey ?? "missing",
});

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
