import { z } from "zod";
import { anthropic, MODELS } from "./claude";
import { resolveKnowledge, renderBlocks } from "./knowledge";
import type { VerticalId, PersonaId } from "@/lib/onboarding/constants";

/**
 * Cognify Talking Points Generator — team spec v2-beta.1
 *
 * Generates a dynamically-composed thinking structure for a Build a Rep
 * scenario. NOT a script. NOT a named framework. The user sees sections
 * with 1-3 bullets each — a scaffold they can hold in their head while
 * speaking.
 *
 * Critical rule from the team spec:
 *   "The system should NOT be limited to fixed frameworks"
 *   "NEVER name the framework in your output"
 *
 * The framework library (frameworks/*.md) is used as GROUNDING CONTEXT
 * for Claude, not as a UI taxonomy. Claude draws on the library to
 * understand what a good structure looks like, then composes a fresh
 * one tailored to the scenario. The user never sees "SCQA" or "BLUF" —
 * they see something like "Problem / Impact / Solution" for their
 * specific situation.
 */

const talkingPointSectionSchema = z.object({
  header: z.string().min(1).max(40),
  bullets: z.array(z.string().min(1).max(140)).min(1).max(4),
});

const talkingPointsSchema = z.object({
  sections: z.array(talkingPointSectionSchema).min(2).max(6),
});

export type TalkingPointsSection = {
  header: string;
  bullets: string[];
};

export type TalkingPoints = {
  sections: TalkingPointsSection[];
};

export type GenerateTalkingPointsInput = {
  scenario: string;
  context?: string;
  audience?: string;
  keyPoints?: string[];
  vertical?: VerticalId;
  personas?: readonly PersonaId[];
  /** Specific named stakeholder the user is speaking to (e.g. "Judge",
   *  "CFO", "Defense attorney"). Drives sharper structure tailoring than
   *  the generic personas list. */
  stakeholder?: string;
  /** The user's own role in this scenario (e.g. "sales rep", "attorney",
   *  "founder"). Helps Claude calibrate the register. */
  userRole?: string;
  /** The desired outcome from the conversation. Explicit "ask" or goal. */
  desiredOutcome?: string;
  /** Emotional / relational stakes — e.g. "this person and I work together
   *  every day, the relationship matters more than winning this point". */
  emotionalStakes?: string;
  /** Time pressure — e.g. "need a decision in 60 seconds", "this is a
   *  long-form 1:1", "two minutes max". */
  timePressure?: string;
  /** Tone preference — e.g. "warm but firm", "strictly professional",
   *  "empathetic", "persuasive but not salesy". */
  tonePreference?: string;
};

const systemPrompt = `You are Cognify's talking-points generator. Given a user's scenario and context, compose a short thinking structure they can hold in their head while speaking live.

CRITICAL RULES
1. NEVER label the structure with a framework name (no "SCQA", "BLUF", "CDI", "PSPA", "STAR", etc). The user sees your structure, not the taxonomy.
2. Output 2-6 sections. Each section has a SHORT header (1-4 words) and 1-3 concise bullets.
3. Bullets are SHORT phrases, not sentences. NO paragraphs. NO script-like phrasing. NO "AI-sounding" text.
4. The structure must adapt to what the scenario actually needs. A recommendation looks different from an objection response looks different from a status update. Use the knowledge base as inspiration, not as a menu.

STRUCTURE PATTERNS (use as inspiration, pick what fits — DO NOT name them)
  - Recommendation: Insight → Implication → Action
  - Objection handling: Acknowledge → Clarify → Response
  - Status update: Progress → Plans → Problems
  - Explanation: Concept → Example → Takeaway
  - Argument: Position → Reasoning → Support
  - Recap: What happened → Key points → Next steps
  - Decision: Context → Decision → Impact
  - Persuasion: Problem → Solution → Proof → Ask
  - Default fallback: Problem → Impact → Solution

VERTICAL ADAPTATION
  - Sales: outcome-oriented, buyer-focused, problem→value first
  - Consulting: logical, structured, recommendation-driven
  - Finance: precise, decision-oriented, numbers-forward
  - Healthcare: clear, calm, patient-centered, empathetic
  - Law: logical, defensible, position-first
  - Education: step-by-step, grounded, example-forward
  - Leadership: direct, practical, people-focused, action-oriented
  - Other: use the scenario context to decide

CONTEXT HANDLING
  - If context is detailed, distill the strongest 3-6 points into bullets across sections.
  - If context is vague, still produce a usable structure. Don't refuse.
  - If the user names an audience, subtly adjust tone and register.
  - If too many ideas are in the context, prioritize the most important.
  - If no context is given, generate from the scenario alone.

OUTPUT
Return ONLY valid JSON matching this exact shape, no prose:

{
  "sections": [
    { "header": "short label", "bullets": ["short phrase", "short phrase"] }
  ]
}

Two to six sections. Each section one to three bullets. Short phrases, not sentences.`;

export async function generateTalkingPoints(
  input: GenerateTalkingPointsInput,
): Promise<TalkingPoints> {
  // Load the framework library + matched domain as grounding context.
  // Claude uses these to understand what good structure looks like,
  // but never names them in the output — see the system prompt.
  const knowledgeBlocks = resolveKnowledge({
    stage: "framework_gen",
    domainHint: inferDomainHint(input),
  });
  const knowledgeText = renderBlocks(knowledgeBlocks);

  const userPrompt = [
    `SCENARIO: ${input.scenario}`,
    input.audience ? `AUDIENCE: ${input.audience}` : null,
    input.stakeholder
      ? `SPECIFIC STAKEHOLDER THEY ARE SPEAKING TO: ${input.stakeholder}`
      : null,
    input.userRole ? `USER'S ROLE IN THIS SCENARIO: ${input.userRole}` : null,
    input.desiredOutcome
      ? `DESIRED OUTCOME: ${input.desiredOutcome}`
      : null,
    input.emotionalStakes
      ? `EMOTIONAL / RELATIONAL STAKES: ${input.emotionalStakes}`
      : null,
    input.timePressure ? `TIME PRESSURE: ${input.timePressure}` : null,
    input.tonePreference ? `TONE PREFERENCE: ${input.tonePreference}` : null,
    input.keyPoints?.length
      ? `KEY POINTS:\n${input.keyPoints.map((p) => `- ${p}`).join("\n")}`
      : null,
    input.context ? `ADDITIONAL CONTEXT:\n${input.context}` : null,
    input.vertical ? `USER VERTICAL: ${input.vertical}` : null,
    input.personas && input.personas.length > 0
      ? `USER TYPICALLY COMMUNICATES WITH: ${input.personas.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control: { type: "ephemeral" };
  }> = [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (knowledgeText) {
    systemBlocks.push({
      type: "text",
      text: `KNOWLEDGE BASE — framework definitions as inspiration. You draw on these to understand what good structure looks like, but you NEVER name them in your output. The user sees your composed structure, not framework labels:\n\n${knowledgeText}`,
      cache_control: { type: "ephemeral" },
    });
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.framework,
      max_tokens: 1024,
      system: systemBlocks,
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return defaultTalkingPoints();
    }

    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    const parsed = JSON.parse(cleaned);
    const validated = talkingPointsSchema.parse(parsed);
    return validated;
  } catch {
    // Any failure (API error, JSON parse, schema validation) falls back
    // to the default structure. The team spec is explicit: never return
    // a blank state — always return a usable structure.
    return defaultTalkingPoints();
  }
}

/**
 * The always-works fallback. Problem / Impact / Solution is the team
 * spec's named default for when no strong structure can be inferred.
 */
export function defaultTalkingPoints(): TalkingPoints {
  return {
    sections: [
      {
        header: "Problem",
        bullets: ["What's happening", "Why it matters now"],
      },
      {
        header: "Impact",
        bullets: ["Who it affects", "What breaks if we ignore it"],
      },
      {
        header: "Solution",
        bullets: [
          "What you're proposing",
          "The next step you want",
        ],
      },
    ],
  };
}

/**
 * Infer a domain hint from the scenario text + vertical. This routes
 * which domain MD (cold-calling, exec-briefing, etc.) gets loaded as
 * additional grounding for Claude.
 */
function inferDomainHint(
  input: GenerateTalkingPointsInput,
): string | undefined {
  const text =
    `${input.scenario} ${input.context ?? ""} ${input.audience ?? ""}`.toLowerCase();

  // Explicit scenario-text matches take priority
  if (/cold[- ]call|\bsdr\b|prospect|outreach|b2b sale/.test(text))
    return "cold-calling";
  if (
    /\bexec\b|c-?suite|\bboard\b|\bceo\b|\bcfo\b|briefing|executive/.test(text)
  )
    return "exec-briefing";
  if (
    /feedback|performance review|tough conversation|radical candor|\b1:1\b|direct report/.test(
      text,
    )
  )
    return "tough-feedback";
  if (/interview|behavioral|leadership principle|tell me about a time/.test(text))
    return "behavioral-interview";
  if (/\bted\b|keynote|storytell|narrat|public speak|presentation/.test(text))
    return "storytelling";
  if (/impromptu|unexpected|on the spot|table topic|spontaneous/.test(text))
    return "impromptu";
  if (/negotiat|deal term|pricing negotiation|contract|walk away/.test(text))
    return "negotiation";

  // Fall back to vertical-based defaults
  if (input.vertical === "sales") return "cold-calling";
  if (input.vertical === "consulting") return "exec-briefing";
  if (input.vertical === "leadership") return "tough-feedback";

  return undefined;
}
