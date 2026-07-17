import { z } from "zod";
import { anthropic, MODELS, MODEL_VERSIONS } from "./claude";
import {
  loadProgressionFor,
  renderBlocks,
  type KnowledgeBlock,
} from "./knowledge";
import {
  SKILL_DIMENSIONS,
  type SkillDimension,
} from "@/types/domain";

// Shape the client sends when asking for a rep-to-rep comparison.
// Keeps payload compact — we don't need the full scoring object, just
// the levers that drive comparison.
export type RepSummary = {
  composite: number;
  dimensions: { dimension: SkillDimension; score: number }[];
  topWeakness: {
    dimension: SkillDimension | "structural_adherence";
    title: string;
    body: string;
    quote: string | null;
    suggestedRewrite: string | null;
  } | null;
  transcript: string;
};

export type ProgressionInput = {
  previous: RepSummary;
  current: RepSummary;
  promptText: string;
};

const improvementSchema = z.object({
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  delta: z.number(),
  observation: z.string().max(320),
  quoteNow: z.string().max(240).nullable(),
});

const stillNeedsWorkSchema = z.object({
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  score: z.number(),
  observation: z.string().max(320),
  nextAction: z.string().max(240),
});

const progressionResponseSchema = z.object({
  improvements: z.array(improvementSchema).min(0).max(3),
  stillNeedsWork: z.array(stillNeedsWorkSchema).min(1).max(3),
  narrative: z.string().max(600),
});

export type ProgressionResponse = z.infer<typeof progressionResponseSchema>;

const systemPrompt = `You are the progression analyst for Cognify. You compare two consecutive reps in the same workout session and produce a tight, coaching-grade read of what *specifically* improved and what *specifically* still needs work.

Your job is not to restate dimension scores. Your job is to translate the numbers into coach talk grounded in the actual transcript. Every observation must be anchored to something observable in the current rep — a quote, a specific moment, a concrete pattern — never generic.

You will receive:
  - Previous rep: composite, per-dimension scores, top weakness callout, transcript
  - Current rep: composite, per-dimension scores, top weakness callout, transcript
  - The prompt both reps addressed
  - Per-dimension PROGRESSION DOCS explaining what improvement looks like across score bands (only for dimensions that moved)

Return ONLY valid JSON matching this schema — no prose, no markdown fences:

{
  "improvements": [
    {
      "dimension": "clarity" | "structure" | "conciseness" | "thinking_quality" | "delivery" | "tone",
      "delta": <current - previous, integer>,
      "observation": "Specific coaching note on what got better, anchored to a quote or moment from the current rep.",
      "quoteNow": "verbatim phrase from the current transcript that exemplifies the improvement" | null
    }
  ],
  "stillNeedsWork": [
    {
      "dimension": "...",
      "score": <current score for this dimension>,
      "observation": "Specific coaching note on what is still weak, anchored to the current rep.",
      "nextAction": "One concrete thing to try in the next rep."
    }
  ],
  "narrative": "2-3 sentence summary — what changed, what's next. Coaching tone. No jargon."
}

RULES (strict):
  - \`improvements\`: only include dimensions that moved by +5 or more. Up to 3. If nothing moved enough, return an empty array.
  - \`stillNeedsWork\`: 1-3 dimensions that are the current weakest (by absolute score, not delta). Do not list a dimension in BOTH improvements and stillNeedsWork.
  - \`observation\` must quote or paraphrase an actual moment in the current transcript. Never generic.
  - \`nextAction\` must be a single concrete behavior — something the user could literally try saying. Not "improve structure".
  - \`narrative\` must acknowledge specifics and be TIGHT — max ~500 characters, 2-3 sentences. Not "you improved overall" — more like "You cut hedging in half and your opening landed cleaner. Structure is still your biggest lever — try a 'three things' frame on the next rep."`;

function buildUserPrompt(input: ProgressionInput): string {
  const movedDimensions = SKILL_DIMENSIONS.filter((d) => {
    const prev = input.previous.dimensions.find((x) => x.dimension === d)?.score ?? 0;
    const curr = input.current.dimensions.find((x) => x.dimension === d)?.score ?? 0;
    return Math.abs(curr - prev) >= 3;
  });

  const progressionBlocks: KnowledgeBlock[] = movedDimensions
    .map((d) => loadProgressionFor(d))
    .filter((b): b is KnowledgeBlock => b !== null);

  const progressionText = renderBlocks(progressionBlocks);

  const renderRep = (rep: RepSummary, label: string) =>
    [
      `${label} REP:`,
      `  composite: ${rep.composite}`,
      `  dimensions:`,
      ...rep.dimensions.map(
        (d) => `    ${d.dimension}: ${Math.round(d.score)}`,
      ),
      rep.topWeakness
        ? `  top weakness last time: [${rep.topWeakness.dimension}] ${rep.topWeakness.title} — ${rep.topWeakness.body}${
            rep.topWeakness.quote ? `\n    quote: "${rep.topWeakness.quote}"` : ""
          }`
        : `  top weakness: (none flagged)`,
      `  transcript:\n"""\n${rep.transcript}\n"""`,
    ].join("\n");

  return [
    `PROMPT BOTH REPS ADDRESSED:\n${input.promptText}`,
    "",
    renderRep(input.previous, "PREVIOUS"),
    "",
    renderRep(input.current, "CURRENT"),
    "",
    progressionBlocks.length > 0
      ? `PROGRESSION KNOWLEDGE (for dimensions that moved):\n${progressionText}`
      : `No dimensions moved by ≥3 points — focus the comparison on stability and current weaknesses.`,
  ].join("\n");
}

export async function analyzeProgression(
  input: ProgressionInput,
): Promise<ProgressionResponse & { modelVersion: string }> {
  const userPrompt = buildUserPrompt(input);

  const { response, metrics } = await anthropic.messages.createWithMetrics({
    model: MODELS.scoring,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Progression response had no text");
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Progression response was not valid JSON. Got: ${textBlock.text.slice(0, 500)}`,
    );
  }

  const validated = progressionResponseSchema.parse(parsed);

  return {
    ...validated,
    // Grading v3 — record the model that actually served the call
    // (provider-aware), not the hardcoded Anthropic constant; with
    // OpenAI primary the old constant misattributed every progression
    // row to claude.
    modelVersion: metrics.modelUsed ?? MODEL_VERSIONS.scoring,
  };
}

// Deterministic fallback used when the Claude call fails or the API key
// is absent. Returns a usable (if less-coached) comparison so the UI never
// renders blank.
export function fallbackProgression(
  input: ProgressionInput,
): ProgressionResponse & { modelVersion: string } {
  const deltas = SKILL_DIMENSIONS.map((d) => {
    const prev = input.previous.dimensions.find((x) => x.dimension === d)?.score ?? 0;
    const curr = input.current.dimensions.find((x) => x.dimension === d)?.score ?? 0;
    return { dimension: d, prev, curr, delta: Math.round(curr - prev) };
  });

  const improvements = deltas
    .filter((x) => x.delta >= 5)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((x) => ({
      dimension: x.dimension,
      delta: x.delta,
      observation: `${x.dimension} moved from ${Math.round(x.prev)} to ${Math.round(x.curr)} (+${x.delta}). AI coaching unavailable — configure an AI provider key to unlock rich comparison.`,
      quoteNow: null,
    }));

  const stillNeedsWork = deltas
    .filter((x) => !improvements.find((i) => i.dimension === x.dimension))
    .sort((a, b) => a.curr - b.curr)
    .slice(0, 2)
    .map((x) => ({
      dimension: x.dimension,
      score: Math.round(x.curr),
      observation: `${x.dimension} is currently ${Math.round(x.curr)}. Add ANTHROPIC_API_KEY for a coached read.`,
      nextAction: "Review the scoring rubric for this dimension in /progress.",
    }));

  const compositeDelta = Math.round(
    input.current.composite - input.previous.composite,
  );
  const narrative =
    compositeDelta >= 5
      ? `Composite up ${compositeDelta} points from last rep. Progression analysis is running in fallback mode — set ANTHROPIC_API_KEY for coached commentary.`
      : compositeDelta <= -5
        ? `Composite dropped ${Math.abs(compositeDelta)} points. Fallback mode — coached commentary disabled.`
        : `Composite held steady. Fallback mode — coached commentary disabled.`;

  return {
    improvements,
    stillNeedsWork,
    narrative,
    modelVersion: "progression-fallback-v1",
  };
}
