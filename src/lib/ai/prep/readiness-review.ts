import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/claude";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
  type SkillDimension,
} from "@/types/domain";

/**
 * PRD v3 Phase 5 — Readiness Review generation (PRD §7.9).
 *
 * Answers ONE question: "How prepared am I for my upcoming event?"
 * Structure: Overall Communication Score → Coach Feedback (the single
 * highest-impact focus) → Core Skill Breakdown (why / did well /
 * improve, expandable) → Readiness Summary.
 *
 * The overall score is computed DETERMINISTICALLY from the session's
 * dimension evidence (weighted average) — the model writes the words,
 * never the number. Model failure falls back to a deterministic review
 * composed from the scores; the user always gets a review.
 */

export type ReadinessEvidence = {
  event: {
    title: string;
    eventType: string;
    description: string;
    contextSummary?: string | null;
  };
  mode: "guided" | "simulation";
  /** Per-dimension averages across the session's reps (post-alias). */
  dimensionAverages: Partial<Record<SkillDimension, number>>;
  /** Guided mode: per-moment outcomes for specificity. */
  moments?: {
    title: string;
    attempts: number;
    bestComposite: number | null;
  }[];
  /** Simulation mode: transcript excerpt + top callouts for grounding. */
  transcriptExcerpt?: string | null;
  callouts?: { dimension: string; title: string; body: string }[];
};

export type ReadinessReviewContent = {
  overallScore: number | null;
  coachFeedback: string;
  coreSkills: Partial<
    Record<SkillDimension, { score: number; why: string; well: string; improve: string }>
  >;
  readinessSummary: string;
};

const reviewSchema = z.object({
  coachFeedback: z.string().min(1).max(400),
  readinessSummary: z.string().min(1).max(700),
  coreSkills: z.record(
    z.string(),
    z.object({
      why: z.string().min(1).max(300),
      well: z.string().min(1).max(300),
      improve: z.string().min(1).max(300),
    }),
  ),
});

/** Weighted overall from measured dims. Null when nothing measured. */
export function computeReadinessScore(
  dimensionAverages: Partial<Record<SkillDimension, number>>,
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  for (const dim of SKILL_DIMENSIONS) {
    const v = dimensionAverages[dim];
    if (v == null || !Number.isFinite(v)) continue;
    const w = DIMENSION_WEIGHTS[dim] ?? 0;
    weighted += v * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return null;
  return Math.round((weighted / totalWeight) * 10) / 10;
}

const systemPrompt = `You are Cognify's readiness coach. A user just finished preparing for a real communication event. Write their Readiness Review.

VOICE: a sharp, warm coach the night before the event. Direct, specific, confident. Never generic filler ("great job overall!"). Reference the actual event and, where provided, the actual moments/transcript.

RULES
1. coachFeedback: THE single highest-impact improvement before the real event. One focus only (2-3 sentences). Not a list.
2. readinessSummary: 3-5 sentences — overall preparedness, primary strength, the one improvement opportunity, and a confidence statement for walking into the event.
3. coreSkills: for EACH dimension key provided in the evidence, write { why, well, improve } — why: what drove that score (1-2 sentences); well: what they did well; improve: what to sharpen before the event. Ground in the transcript/moments where available.
4. Use the dimension keys EXACTLY as given (e.g. "thinking_quality"). Do not invent dimensions.
5. Scores are provided — never contradict them (a 55 is not "excellent").

OUTPUT: ONLY valid JSON:
{
  "coachFeedback": "...",
  "readinessSummary": "...",
  "coreSkills": { "<dim>": { "why": "...", "well": "...", "improve": "..." } }
}`;

export async function generateReadinessReview(
  evidence: ReadinessEvidence,
): Promise<{ review: ReadinessReviewContent; source: "model" | "fallback" }> {
  const overallScore = computeReadinessScore(evidence.dimensionAverages);
  const measuredDims = SKILL_DIMENSIONS.filter(
    (d) => evidence.dimensionAverages[d] != null,
  );
  if (measuredDims.length === 0) {
    return {
      review: fallbackReview(evidence, overallScore),
      source: "fallback",
    };
  }

  const userPrompt = [
    `EVENT: ${evidence.event.title} (${evidence.event.eventType})`,
    `EVENT DESCRIPTION: ${evidence.event.description}`,
    evidence.event.contextSummary
      ? `EVENT CONTEXT: ${evidence.event.contextSummary.slice(0, 4000)}`
      : null,
    `PREPARATION MODE: ${evidence.mode === "guided" ? "Guided Practice (moment by moment)" : "Full Simulation (uninterrupted run-through)"}`,
    `OVERALL SCORE (computed): ${overallScore ?? "n/a"}`,
    `CORE SKILL SCORES:\n${measuredDims
      .map((d) => `- ${d}: ${Math.round(evidence.dimensionAverages[d]!)}`)
      .join("\n")}`,
    evidence.moments?.length
      ? `MOMENTS PRACTICED:\n${evidence.moments
          .map(
            (m) =>
              `- ${m.title}: ${m.attempts} attempt${m.attempts === 1 ? "" : "s"}${m.bestComposite != null ? `, best ${Math.round(m.bestComposite)}` : ""}`,
          )
          .join("\n")}`
      : null,
    evidence.callouts?.length
      ? `KEY COACHING CALLOUTS:\n${evidence.callouts
          .slice(0, 6)
          .map((c) => `- [${c.dimension}] ${c.title}: ${c.body}`)
          .join("\n")}`
      : null,
    evidence.transcriptExcerpt
      ? `TRANSCRIPT EXCERPT:\n${evidence.transcriptExcerpt.slice(0, 8000)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.framework,
      max_tokens: 1800,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { review: fallbackReview(evidence, overallScore), source: "fallback" };
    }
    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");
    const validated = reviewSchema.parse(JSON.parse(cleaned));

    const coreSkills: ReadinessReviewContent["coreSkills"] = {};
    for (const dim of measuredDims) {
      const entry = validated.coreSkills[dim];
      const score = Math.round(evidence.dimensionAverages[dim]!);
      coreSkills[dim] = entry
        ? { score, ...entry }
        : fallbackDimEntry(dim, score);
    }
    return {
      review: {
        overallScore,
        coachFeedback: validated.coachFeedback,
        readinessSummary: validated.readinessSummary,
        coreSkills,
      },
      source: "model",
    };
  } catch {
    return { review: fallbackReview(evidence, overallScore), source: "fallback" };
  }
}

// ── Deterministic fallback ──────────────────────────────────────────────

function band(score: number): "strong" | "solid" | "developing" {
  if (score >= 80) return "strong";
  if (score >= 60) return "solid";
  return "developing";
}

function fallbackDimEntry(dim: SkillDimension, score: number) {
  const label = DIMENSION_LABELS[dim];
  const b = band(score);
  return {
    score,
    why: `Your ${label} averaged ${score} across this preparation session.`,
    well:
      b === "strong"
        ? `${label} is a genuine strength — it held up consistently across your reps.`
        : `You showed flashes of solid ${label.toLowerCase()} in your stronger reps.`,
    improve:
      b === "strong"
        ? `Keep it — don't let event nerves rush what's already working.`
        : `Give ${label.toLowerCase()} one focused rep before the event — it's your fastest available gain.`,
  };
}

export function fallbackReview(
  evidence: ReadinessEvidence,
  overallScore: number | null,
): ReadinessReviewContent {
  const measured = SKILL_DIMENSIONS.filter(
    (d) => evidence.dimensionAverages[d] != null,
  );
  const coreSkills: ReadinessReviewContent["coreSkills"] = {};
  let weakest: { dim: SkillDimension; score: number } | null = null;
  let strongest: { dim: SkillDimension; score: number } | null = null;
  for (const dim of measured) {
    const score = Math.round(evidence.dimensionAverages[dim]!);
    coreSkills[dim] = fallbackDimEntry(dim, score);
    if (!weakest || score < weakest.score) weakest = { dim, score };
    if (!strongest || score > strongest.score) strongest = { dim, score };
  }
  const eventName = evidence.event.title;
  const coachFeedback = weakest
    ? `Before ${eventName}, put one more focused rep into ${DIMENSION_LABELS[weakest.dim]} — it scored ${weakest.score}, your biggest available gain. One deliberate practice pass there moves the whole performance.`
    : `Run one more full rep before ${eventName} — reps, not review, are what move readiness.`;
  const readinessSummary = [
    overallScore != null
      ? `You're walking into ${eventName} with an overall readiness of ${Math.round(overallScore)}.`
      : `You've put real preparation into ${eventName}.`,
    strongest
      ? `${DIMENSION_LABELS[strongest.dim]} is your anchor — lean on it.`
      : null,
    weakest && strongest && weakest.dim !== strongest.dim
      ? `${DIMENSION_LABELS[weakest.dim]} is the one thing to sharpen before the real thing.`
      : null,
    `You've done the work most people skip — trust the reps.`,
  ]
    .filter(Boolean)
    .join(" ");
  return { overallScore, coachFeedback, coreSkills, readinessSummary };
}
