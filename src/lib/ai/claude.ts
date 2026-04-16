import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[ai] ANTHROPIC_API_KEY is not set. Claude calls will fail.");
}

export const anthropic = new Anthropic({
  apiKey: apiKey ?? "missing",
});

export const MODELS = {
  scoring: process.env.ANTHROPIC_SCORING_MODEL ?? "claude-sonnet-4-6",
  framework: process.env.ANTHROPIC_FRAMEWORK_MODEL ?? "claude-sonnet-4-6",
} as const;

export const MODEL_VERSIONS = {
  scoring: MODELS.scoring,
  framework: MODELS.framework,
} as const;
