import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/claude";

/**
 * PRD v3 Phase 5 — Build a Rep Preparation Plan generation (PRD §7.5–7.8,
 * §8.4.6).
 *
 * The user describes the event ("SDR interview at Salesforce") and
 * optionally uploads context (resume, JD, deck notes). This module turns
 * that into:
 *   - inferred event type + title
 *   - recommended practice mode + Full Simulation duration
 *   - the Preparation Plan: 4–8 Critical Moments with objectives and
 *     recommended speaking times
 *
 * Same resilience contract as talking-points: NEVER return a blank
 * state. Any model/JSON/schema failure falls back to a strong generic
 * plan for the inferred event type (PRD §7.5: "If little or no context
 * is provided, Cognify should generate the most likely preparation
 * plan").
 */

export const PREP_EVENT_TYPES = [
  "interview",
  "presentation",
  "pitch",
  "toast",
  "demo",
  "meeting",
  "speech",
  "other",
] as const;
export type PrepEventType = (typeof PREP_EVENT_TYPES)[number];

const momentSchema = z.object({
  title: z.string().min(1).max(60),
  objective: z.string().min(1).max(220),
  recommendedSeconds: z.number().int().min(30).max(600),
});

const planSchema = z.object({
  title: z.string().min(1).max(80),
  eventType: z.enum(PREP_EVENT_TYPES),
  recommendedMode: z.enum(["guided", "simulation"]),
  recommendedDurationSec: z.number().int().min(60).max(1800),
  moments: z.array(momentSchema).min(4).max(8),
});

export type PreparationPlan = z.infer<typeof planSchema>;

export type GeneratePlanInput = {
  description: string;
  /** Concatenated parsed context uploads (already capped per file). */
  contextText?: string | null;
  /** Optional profile hints — weakest core skill etc. (PRD §8.4.6). */
  profileHint?: string | null;
};

const systemPrompt = `You are Cognify's Build a Rep preparation planner. A user describes a real-world communication event they must prepare for. You produce their Preparation Plan: the Critical Moments most likely to determine success.

DEFINITION (shown to users elsewhere): a Critical Moment is one part of the event that most determines how it goes — a question they'll be asked, a section they must deliver, a moment they must land.

RULES
1. 4-8 Critical Moments, in the order they'd naturally occur.
2. Each moment: a SHORT title (2-6 words, the way a coach would say it), an objective (one sentence: what a strong version accomplishes), and a recommended speaking time in seconds (30-600, realistic for that moment).
3. Moments must be PRACTICEABLE as solo spoken reps — things the user themselves says. No "listen actively" moments.
4. If context documents are provided (resume, job description, deck outline, agenda), make the moments SPECIFIC to them: name the actual company, role, product, audience, or stories from the resume where relevant.
5. If the description is thin, produce the strongest generic plan for that event type — never refuse, never ask questions.
6. eventType: one of interview | presentation | pitch | toast | demo | meeting | speech | other.
7. recommendedMode: "guided" when the event is question-driven or benefits from moment-by-moment coaching (interviews, meetings); "simulation" when flow and pacing matter most (toasts, speeches, rehearsed presentations).
8. recommendedDurationSec: the realistic total duration of the real event's spoken content (60-1800), used for Full Simulation.
9. title: a clean short name for the event ("SDR Interview — Salesforce"), max 80 chars.

OUTPUT: ONLY valid JSON, no prose:
{
  "title": "...",
  "eventType": "...",
  "recommendedMode": "guided",
  "recommendedDurationSec": 600,
  "moments": [
    { "title": "...", "objective": "...", "recommendedSeconds": 90 }
  ]
}`;

export async function generatePreparationPlan(
  input: GeneratePlanInput,
): Promise<{ plan: PreparationPlan; source: "model" | "fallback" }> {
  const userPrompt = [
    `EVENT DESCRIPTION: ${input.description}`,
    input.profileHint ? `COMMUNICATION PROFILE HINT: ${input.profileHint}` : null,
    input.contextText
      ? `CONTEXT DOCUMENTS (uploaded by the user — use them to personalize):\n${input.contextText.slice(0, 24_000)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.framework,
      max_tokens: 1600,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { plan: fallbackPlan(input.description), source: "fallback" };
    }
    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");
    const validated = planSchema.parse(JSON.parse(cleaned));
    return { plan: validated, source: "model" };
  } catch {
    return { plan: fallbackPlan(input.description), source: "fallback" };
  }
}

// ── Deterministic fallbacks (PRD §7.7 examples, verbatim where given) ──

type FallbackMoment = { title: string; objective: string; seconds: number };

const FALLBACK_PLANS: Record<PrepEventType, FallbackMoment[]> = {
  interview: [
    { title: "Tell Me About Yourself", objective: "A tight 90-second arc from background to why you're here, ending on this role.", seconds: 90 },
    { title: "Why This Role?", objective: "Connect what energizes you to what the role actually needs.", seconds: 75 },
    { title: "Why This Company?", objective: "Show you understand what they do and name a specific reason it matters to you.", seconds: 75 },
    { title: "A Challenge You Overcame", objective: "One concrete story with the situation, what YOU did, and the measurable result.", seconds: 120 },
    { title: "A Failure and the Lesson", objective: "Own a real failure, then land the change you made because of it.", seconds: 120 },
    { title: "Questions For The Interviewer", objective: "Two questions that prove you've thought about succeeding in the role.", seconds: 60 },
  ],
  presentation: [
    { title: "Opening", objective: "Earn attention in the first 30 seconds and preview where you're taking them.", seconds: 60 },
    { title: "Current State", objective: "Ground the room in the facts everyone must share before the argument starts.", seconds: 90 },
    { title: "The Problem", objective: "Make the cost of the problem concrete for THIS audience.", seconds: 90 },
    { title: "Recommendation", objective: "Lead with the recommendation, then the two strongest reasons.", seconds: 120 },
    { title: "Next Steps", objective: "Who does what by when — leave zero ambiguity.", seconds: 60 },
    { title: "Q&A Preparation", objective: "Answer the hardest question you hope nobody asks.", seconds: 120 },
  ],
  pitch: [
    { title: "Opening", objective: "One sentence that makes an investor lean in.", seconds: 60 },
    { title: "The Problem", objective: "Make the pain vivid and quantified — who bleeds, how much.", seconds: 90 },
    { title: "The Solution", objective: "What you built and why it wins, in plain language.", seconds: 90 },
    { title: "Market", objective: "Size the opportunity credibly — bottom-up beats hand-waving.", seconds: 90 },
    { title: "Business Model", objective: "How money flows in, and the one number that proves it works.", seconds: 90 },
    { title: "Closing & Ask", objective: "The raise, what it buys, and the milestone it reaches.", seconds: 60 },
  ],
  toast: [
    { title: "Opening", objective: "Introduce yourself and your connection — warm, brief, confident.", seconds: 45 },
    { title: "Main Story", objective: "One story about them that only you can tell, with a beginning, middle, and landing.", seconds: 120 },
    { title: "Reflection", objective: "What the story shows about who they are.", seconds: 60 },
    { title: "Message to the Couple", objective: "Speak directly to them — sincere beats clever.", seconds: 60 },
    { title: "Closing & Raise the Glass", objective: "A clean final line everyone can toast to.", seconds: 30 },
  ],
  demo: [
    { title: "Opening", objective: "Frame the demo around THEIR problem, not your product.", seconds: 60 },
    { title: "The Customer Problem", objective: "Restate the pain you heard in discovery so they feel understood.", seconds: 90 },
    { title: "Demo Narrative", objective: "Walk the workflow as a story — their team, their data, their day.", seconds: 180 },
    { title: "Value Recap", objective: "Three outcomes, each tied to something they said they need.", seconds: 60 },
    { title: "Q&A Preparation", objective: "Handle the toughest technical or pricing objection cleanly.", seconds: 90 },
  ],
  meeting: [
    { title: "Opening", objective: "State the purpose of the meeting and what you need from the room.", seconds: 30 },
    { title: "Progress", objective: "What moved since last time — outcomes, not activity.", seconds: 90 },
    { title: "Problems", objective: "The real blockers, stated plainly, with what you've tried.", seconds: 90 },
    { title: "Plans", objective: "What happens next and who owns it.", seconds: 90 },
    { title: "The Ask", objective: "The decision or resource you need before everyone leaves.", seconds: 60 },
  ],
  speech: [
    { title: "Opening", objective: "A first line that earns the room's attention without a throat-clear.", seconds: 60 },
    { title: "The Theme", objective: "The one idea this speech exists to plant.", seconds: 90 },
    { title: "The Story", objective: "The narrative that makes the theme land emotionally.", seconds: 120 },
    { title: "The Takeaway", objective: "Turn the story into something the audience can use Monday morning.", seconds: 60 },
    { title: "Closing", objective: "End on the theme — last words are remembered words.", seconds: 60 },
  ],
  other: [
    { title: "Opening", objective: "Set context fast and say why this conversation matters now.", seconds: 60 },
    { title: "Main Message", objective: "The one thing they must remember, stated first, supported second.", seconds: 120 },
    { title: "Support", objective: "Your two strongest pieces of evidence or reasoning.", seconds: 90 },
    { title: "Closing & Ask", objective: "What you want to happen next, asked for directly.", seconds: 60 },
  ],
};

export function inferEventType(description: string): PrepEventType {
  const text = description.toLowerCase();
  if (/interview|recruiter|hiring|behavioral|tell me about a time/.test(text))
    return "interview";
  if (/investor|pitch|fundrais|seed|series [a-c]|vc\b/.test(text)) return "pitch";
  if (/toast|wedding|best man|maid of honor/.test(text)) return "toast";
  if (/demo\b|product walkthrough|poc\b/.test(text)) return "demo";
  if (/standup|status|sync|1:1|qbr|quarterly|meeting|update/.test(text))
    return "meeting";
  if (/keynote|speech|talk\b|toastmaster|commencement|prepared remarks|\bremarks\b/.test(text))
    return "speech";
  if (/present|deck|slides|review board|proposal/.test(text))
    return "presentation";
  return "other";
}

/** Mode + duration defaults per event type (PRD §7.6/§7.8). */
export function fallbackPlan(description: string): PreparationPlan {
  const eventType = inferEventType(description);
  const moments = FALLBACK_PLANS[eventType];
  const total = moments.reduce((s, m) => s + m.seconds, 0);
  const simulationFirst = eventType === "toast" || eventType === "speech";
  return {
    title: defaultTitle(description, eventType),
    eventType,
    recommendedMode: simulationFirst ? "simulation" : "guided",
    recommendedDurationSec: Math.min(1800, Math.max(60, total)),
    moments: moments.map((m) => ({
      title: m.title,
      objective: m.objective,
      recommendedSeconds: m.seconds,
    })),
  };
}

const TYPE_LABEL: Record<PrepEventType, string> = {
  interview: "Interview",
  presentation: "Presentation",
  pitch: "Investor Pitch",
  toast: "Toast",
  demo: "Product Demo",
  meeting: "Meeting",
  speech: "Speech",
  other: "Communication Event",
};

function defaultTitle(description: string, eventType: PrepEventType): string {
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (trimmed.length > 0 && trimmed.length <= 80) {
    return trimmed[0]!.toUpperCase() + trimmed.slice(1);
  }
  if (trimmed.length > 80) return `${trimmed.slice(0, 77)}…`;
  return TYPE_LABEL[eventType];
}
