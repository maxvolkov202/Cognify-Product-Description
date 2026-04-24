import { anthropic, MODELS } from "./claude";
import type { SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";

export type WeeklyRepSummary = {
  weekStartISO: string;
  weekEndISO: string;
  repCount: number;
  averageComposite: number;
  /** Per-dimension avg for the week + delta vs the prior week. Deltas
   *  > 0 = improvement; < 0 = regression. Dimensions with no data
   *  resolve to avg: null. */
  dimensions: {
    dimension: SkillDimension;
    avg: number | null;
    delta: number | null;
  }[];
  /** Top archetype the user handled well this week, if any pressure
   *  reps exist. */
  bestArchetype: { name: string; avg: number } | null;
  /** The dimension with the lowest week-avg. */
  weakestDimension: SkillDimension | null;
};

export type WeeklyNarrative = {
  paragraph: string;
  hookStat: string;
  nextFocus: string;
};

/**
 * Generate a one-paragraph weekly recap grounded in the user's rep data.
 * Called on-demand from /progress and cached in localStorage for the
 * current week (server would cache in DB; that's a separate migration).
 *
 * Tone: coaching, second-person, concrete. Hard-ruled against generic
 * encouragement ("keep it up", "great job") and against fabricated
 * stats — the model must only reference numbers that appear in the
 * input summary.
 */
export async function generateWeeklyNarrative(
  summary: WeeklyRepSummary,
): Promise<WeeklyNarrative> {
  if (summary.repCount === 0) {
    return {
      paragraph:
        "No reps logged this week — the gym's waiting. A single rep starts the trend; five builds the habit.",
      hookStat: "0 reps",
      nextFocus: "Run a Daily Workout today.",
    };
  }

  const dimensionLines = summary.dimensions
    .filter((d) => d.avg !== null)
    .map((d) => {
      const label = DIMENSION_LABELS[d.dimension];
      const deltaStr =
        d.delta !== null
          ? d.delta > 0
            ? `(+${d.delta} vs prev week)`
            : d.delta < 0
              ? `(${d.delta} vs prev week)`
              : "(flat vs prev week)"
          : "";
      return `- ${label}: ${Math.round(d.avg as number)}/100 ${deltaStr}`;
    })
    .join("\n");

  const system = `You are Cognify's weekly recap writer. Produce exactly one paragraph (2-4 sentences, max 65 words) for the user based on the summary below.

Rules:
- Second-person, coaching tone. Plainspoken.
- Ground in concrete numbers from the summary. Never invent stats.
- Lead with the biggest movement (positive OR negative — be honest).
- If a dimension dropped, name it without sugar-coating.
- If a pressure archetype crushed, say which one.
- Close with one sentence of forward guidance pointing at the weakest dimension.
- BANNED phrases: "great job", "keep it up", "amazing", "you're doing great", "proud of you", "way to go", generic encouragement.
- BANNED patterns: filler adjectives ("really", "very", "quite"), hype verbs ("crushed" is OK if literal, "smashed" is not).

Return ONLY valid JSON matching this exact schema, no prose before or after:

{
  "paragraph": string (2-4 sentences, ≤65 words),
  "hookStat": string (≤40 chars — the single most attention-grabbing stat),
  "nextFocus": string (≤80 chars — one-sentence direction for next week)
}`;

  const userPrompt = `WEEK: ${summary.weekStartISO} to ${summary.weekEndISO}
REPS: ${summary.repCount}
WEEK COMPOSITE: ${summary.averageComposite}/100

Dimensions:
${dimensionLines}

${
  summary.bestArchetype
    ? `Best pressure archetype: ${summary.bestArchetype.name} (avg ${summary.bestArchetype.avg}/100)`
    : `No pressure reps logged this week.`
}

${
  summary.weakestDimension
    ? `Weakest dimension: ${DIMENSION_LABELS[summary.weakestDimension]}`
    : ""
}`;

  const response = await anthropic.messages.create({
    model: MODELS.scoring,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new Error("Weekly narrative: no JSON in model response");
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
    paragraph?: string;
    hookStat?: string;
    nextFocus?: string;
  };
  if (
    typeof parsed.paragraph !== "string" ||
    typeof parsed.hookStat !== "string" ||
    typeof parsed.nextFocus !== "string"
  ) {
    throw new Error("Weekly narrative: response missing required fields");
  }
  return {
    paragraph: parsed.paragraph,
    hookStat: parsed.hookStat,
    nextFocus: parsed.nextFocus,
  };
}
