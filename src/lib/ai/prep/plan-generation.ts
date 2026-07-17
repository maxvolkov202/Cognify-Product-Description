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
  /** L4 (§7.7/§8.4.6) — the moment's Coach's Insight: 1-2 sentences,
   *  practical behavioral cue in the catalog's coach_insight voice
   *  ("what great looks like + the trap"). Optional in the schema so a
   *  model that drops it on ONE moment doesn't torch an otherwise-good
   *  personalized plan into the generic fallback; the prompt requires it
   *  and the fallback plans always carry it. */
  coachCue: z.string().min(1).max(320).optional(),
  /** L4 — one operator-facing line for the scoring evaluator, injected
   *  into the rep's eventContext as momentHint. Same optionality
   *  rationale as coachCue. */
  scoringHint: z.string().min(1).max(300).optional(),
  /** Edit #2 — when the user named their own questions/moments, the
   *  plan contains EXACTLY those plus clearly-offered extras carrying
   *  suggested:true. Suggested moments render in a separate "add if
   *  you want" rail, never mixed into the practice list. */
  suggested: z.boolean().optional(),
});

const planSchema = z.object({
  title: z.string().min(1).max(80),
  eventType: z.enum(PREP_EVENT_TYPES),
  recommendedMode: z.enum(["guided", "simulation"]),
  recommendedDurationSec: z.number().int().min(60).max(1800),
  // min is 1, not 4: when the user names two specific questions, the
  // plan is those two questions — padding to four would override their
  // stated intent (Edit #2). The prompt still asks for 4-8 when the
  // user didn't specify.
  moments: z.array(momentSchema).min(1).max(12),
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
1a. USER-NAMED MOMENTS OVERRIDE RULE 1: if the description names, lists, or quotes specific questions or moments the user wants to practice ("I want to practice X, Y and Z", numbered lists, quoted questions), the plan is EXACTLY those moments — same order, titles faithful to the user's wording (trim to title length, never reinterpret) — even if that means fewer than 4. If they name more than 9, keep the first 9. Do NOT invent additional practice moments alongside them, and NEVER mark a user-named moment "suggested". You may ALSO offer up to 3 extra moments the user might want, each carrying "suggested": true; suggested moments are shown separately as optional additions, never mixed into the practice plan.
2. Each moment: a SHORT title (2-6 words, the way a coach would say it; for user-named questions, the user's own words), an objective (one sentence: what a strong version accomplishes), a recommended speaking time in seconds (30-600, realistic for that moment), a coachCue, and a scoringHint.
2a. coachCue: 1-2 sentences of practical behavioral coaching for THIS moment: what great looks like AND the trap most people fall into. Coach's voice, second person, immediately usable ("Land the result in your first sentence. Most people bury it under three sentences of setup."). No theory names, no frameworks, no jargon, plain words, and never use em-dashes.
2b. scoringHint: ONE operator-facing line telling the evaluator what to weigh for this moment ("Weigh whether the answer ends on a concrete, quantified result; penalize setup that outweighs outcome."). Third person, about the response — never addressed to the user.
3. Moments must be PRACTICEABLE as solo spoken reps — things the user themselves says. No "listen actively" moments.
4. If context documents are provided (resume, job description, deck outline, agenda), make the moments SPECIFIC to them: name the actual company, role, product, audience, or stories from the resume where relevant.
5. If the description is thin, produce the strongest generic plan for that event type — never refuse, never ask questions.
6. eventType: one of interview | presentation | pitch | toast | demo | meeting | speech | other.
7. recommendedMode: "guided" when the event is question-driven or benefits from moment-by-moment coaching (interviews, meetings); "simulation" when flow and pacing matter most (toasts, speeches, rehearsed presentations).
8. recommendedDurationSec: the realistic total duration of the real event's spoken content (60-1800), used for Full Simulation.
9. title: a clean short name for the event ("SDR Interview at Salesforce"), max 80 chars.
10. Plain language in every user-facing field (title, objective, coachCue): simple words, no jargon, and never use em-dashes anywhere.

OUTPUT: ONLY valid JSON, no prose:
{
  "title": "...",
  "eventType": "...",
  "recommendedMode": "guided",
  "recommendedDurationSec": 600,
  "moments": [
    { "title": "...", "objective": "...", "recommendedSeconds": 90, "coachCue": "...", "scoringHint": "..." },
    { "title": "...", "objective": "...", "recommendedSeconds": 90, "coachCue": "...", "scoringHint": "...", "suggested": true }
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
      // 12 moments x (title + objective + coachCue + scoringHint) can
      // exceed the old 1600 budget once rule 1a admits user-named lists;
      // a truncated JSON would silently fall back to the generic plan.
      max_tokens: 3200,
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

type FallbackMoment = {
  title: string;
  objective: string;
  seconds: number;
  /** L4 — Coach's Insight in the catalog's coach_insight voice: what
   *  great looks like + the trap. */
  cue: string;
  /** L4 — one operator-facing line for the scoring evaluator. */
  hint: string;
};

const FALLBACK_PLANS: Record<PrepEventType, FallbackMoment[]> = {
  interview: [
    { title: "Tell Me About Yourself", objective: "A tight 90-second arc from background to why you're here, ending on this role.", seconds: 90, cue: "Great answers are an arc, not a resume readout. Three beats that each earn the next, ending on why THIS role. The trap is starting at your first job and narrating forward until time runs out.", hint: "Weigh whether the answer builds a deliberate arc that lands on this specific role; penalize chronological resume recitation with no destination." },
    { title: "Why This Role?", objective: "Connect what energizes you to what the role actually needs.", seconds: 75, cue: "Name the overlap between what you're best at and what this job needs. One concrete match beats five generic ones. The trap is describing what the role does for you instead of what you do for it.", hint: "Weigh whether the answer connects a specific personal strength to a specific need of the role; penalize purely self-directed motivation." },
    { title: "Why This Company?", objective: "Show you understand what they do and name a specific reason it matters to you.", seconds: 75, cue: "Prove you did the homework with one specific, true observation about them. Then tie it to you in a single move. The trap is compliments any candidate could say to any company.", hint: "Weigh specificity about the actual company; penalize interchangeable flattery that names nothing concrete." },
    { title: "A Challenge You Overcame", objective: "One concrete story with the situation, what YOU did, and the measurable result.", seconds: 120, cue: "Spend most of your time on what YOU did (decisions, actions, trade-offs) and end on a result someone could verify. The trap is drowning in situation setup and saying 'we' for every action.", hint: "Weigh personal agency (I, not we) and a concrete, verifiable result; penalize setup that outweighs action." },
    { title: "A Failure and the Lesson", objective: "Own a real failure, then land the change you made because of it.", seconds: 120, cue: "Own a real failure in one plain sentence, then spend your time on the behavior you changed because of it. The trap is the humble-brag ('I care too much') or blaming circumstances.", hint: "Weigh genuine ownership and a specific behavioral change afterward; penalize disguised strengths and blame-shifting." },
    { title: "Questions For The Interviewer", objective: "Two questions that prove you've thought about succeeding in the role.", seconds: 60, cue: "Ask about succeeding in the role. What the best person in this seat would do in the first six months. The trap is questions about perks, or questions the website already answers.", hint: "Weigh whether the questions show forward thinking about performing in the role; penalize logistics-only or easily-googleable questions." },
  ],
  presentation: [
    { title: "Opening", objective: "Earn attention in the first 30 seconds and preview where you're taking them.", seconds: 60, cue: "Open with the stake (why this matters to the room) then tell them exactly where you're taking them. The trap is a throat-clearing minute of agenda and apologies before anything happens.", hint: "Weigh whether the first sentences create a stake and preview the destination; penalize preamble and agenda-reading." },
    { title: "Current State", objective: "Ground the room in the facts everyone must share before the argument starts.", seconds: 90, cue: "Give the three facts everyone must agree on before your argument can start. Numbers beat adjectives here. The trap is editorializing before the room shares the same picture.", hint: "Weigh factual grounding (concrete, neutral, quantified where possible); penalize opinion mixed into what should be shared facts." },
    { title: "The Problem", objective: "Make the cost of the problem concrete for THIS audience.", seconds: 90, cue: "Price the problem in the room's own currency. Time, money, risk, whatever THEY count in. The trap is describing the problem in general terms that cost nobody in the room anything.", hint: "Weigh whether the problem's cost is made concrete for this specific audience; penalize abstract problem statements." },
    { title: "Recommendation", objective: "Lead with the recommendation, then the two strongest reasons.", seconds: 120, cue: "Say the recommendation in your first sentence, then back it with your two strongest reasons. In that order. The trap is building suspense: reasons first, ask last, room lost in the middle.", hint: "Weigh recommendation-first ordering and reason quality; penalize burying the recommendation behind the justification." },
    { title: "Next Steps", objective: "Who does what by when. Leave zero ambiguity.", seconds: 60, cue: "Name the owner, the action, and the date for each step. Three clean assignments beat ten vague intentions. The trap is 'we should align on this' with no name attached.", hint: "Weigh whether every step has an owner and a deadline; penalize ownerless, dateless intentions." },
    { title: "Q&A Preparation", objective: "Answer the hardest question you hope nobody asks.", seconds: 120, cue: "Answer the hardest question head-on in your first sentence, then support it. Dodging is visible from the back row. The trap is a soft wind-up that sounds like you're buying time.", hint: "Weigh directness of the first sentence against a hostile question; penalize hedging and deflection before the answer." },
  ],
  pitch: [
    { title: "Opening", objective: "One sentence that makes an investor lean in.", seconds: 60, cue: "Lead with the single most surprising true thing about your business. Traction, insight, or wedge. The trap is opening with your bio or 'the market is big' before anyone cares.", hint: "Weigh whether the opening earns attention with something concrete and surprising; penalize generic market-size or biography openers." },
    { title: "The Problem", objective: "Make the pain vivid and quantified. Who bleeds, how much.", seconds: 90, cue: "Name who has the problem, how often it bites, and what it costs them. One vivid, quantified case beats a survey. The trap is a problem so general no one is on the hook to fix it.", hint: "Weigh specificity of who suffers and the quantified cost; penalize vague universal pain statements." },
    { title: "The Solution", objective: "What you built and why it wins, in plain language.", seconds: 90, cue: "Describe what you built the way a customer would describe it to a friend. Plain words, cause and effect. The trap is feature-listing and jargon that hides what it actually does.", hint: "Weigh plain-language clarity of what the product does and why it wins; penalize jargon and feature laundry lists." },
    { title: "Market", objective: "Size the opportunity credibly. Bottom-up beats hand-waving.", seconds: 90, cue: "Build the number bottom-up (customers × price × share you can actually win) and show your arithmetic. The trap is quoting a trillion-dollar TAM you can't defend one follow-up question deep.", hint: "Weigh credibility of the sizing logic (bottom-up beats cited TAM); penalize undefended top-down numbers." },
    { title: "Business Model", objective: "How money flows in, and the one number that proves it works.", seconds: 90, cue: "Walk the money: who pays, how much, how often. Then land the one number that proves the machine works. The trap is describing pricing without unit economics.", hint: "Weigh whether the revenue mechanics are concrete and anchored to one proof-point number; penalize models with no economics." },
    { title: "Closing & Ask", objective: "The raise, what it buys, and the milestone it reaches.", seconds: 60, cue: "State the raise, what it buys, and the milestone it gets you to. Three facts, one breath. The trap is ending on 'happy to chat more' instead of an ask.", hint: "Weigh whether the close contains an explicit ask tied to a milestone; penalize endings with no concrete ask." },
  ],
  toast: [
    { title: "Opening", objective: "Introduce yourself and your connection. Warm, brief, confident.", seconds: 45, cue: "One sentence of who you are, one of why you're the person holding the mic. Then move. The trap is apologizing for public speaking or explaining the whole friendship timeline.", hint: "Weigh warmth and economy of the self-introduction; penalize apologies and over-long backstory." },
    { title: "Main Story", objective: "One story about them that only you can tell, with a beginning, middle, and landing.", seconds: 120, cue: "Tell ONE story only you can tell, with a beginning, a turn, and a landing line you know in advance. The trap is stitching four half-stories together and finding the ending live.", hint: "Weigh whether it's a single complete story with a deliberate landing; penalize multi-anecdote rambles." },
    { title: "Reflection", objective: "What the story shows about who they are.", seconds: 60, cue: "Say plainly what the story proves about who they are. One quality, named without irony. The trap is undercutting the sincere beat with another joke.", hint: "Weigh whether the reflection lands one sincere, specific quality; penalize deflecting into humor." },
    { title: "Message to the Couple", objective: "Speak directly to them. Sincere beats clever.", seconds: 60, cue: "Turn to them and use their names. Say the true thing you'd want them to remember in ten years. The trap is performing for the room instead of talking to the two people it's for.", hint: "Weigh direct second-person address and sincerity; penalize playing to the audience over the couple." },
    { title: "Closing & Raise the Glass", objective: "A clean final line everyone can toast to.", seconds: 30, cue: "End on one short line the whole room can repeat with a glass in the air. Rehearse it word-for-word. The trap is three false endings before the real one.", hint: "Weigh whether the close is a single clean, toastable line; penalize trailing or multiple endings." },
  ],
  demo: [
    { title: "Opening", objective: "Frame the demo around THEIR problem, not your product.", seconds: 60, cue: "Open with their problem in their words and promise what they'll see solved in the next few minutes. The trap is starting with your company story and a tour of the login page.", hint: "Weigh whether the framing centers the customer's stated problem; penalize product-first or company-history openers." },
    { title: "The Customer Problem", objective: "Restate the pain you heard in discovery so they feel understood.", seconds: 90, cue: "Replay the pain exactly as they described it. Their words, their numbers, their consequences. The trap is generalizing to 'teams like yours' and losing the feeling of being heard.", hint: "Weigh fidelity to the customer's specific stated pain; penalize generic industry-pain paraphrases." },
    { title: "Demo Narrative", objective: "Walk the workflow as a story. Their team, their data, their day.", seconds: 180, cue: "Narrate a day in their team's life with the product. Every click should answer 'so what for them'. The trap is touring features left-to-right because that's the menu order.", hint: "Weigh story structure anchored to the customer's workflow and outcomes; penalize feature-tour sequencing with no narrative." },
    { title: "Value Recap", objective: "Three outcomes, each tied to something they said they need.", seconds: 60, cue: "Close the loop: three outcomes, each tied by name to something they told you they need. The trap is reciting your favorite features instead of their stated needs.", hint: "Weigh whether each recap point maps to a stated customer need; penalize seller-priority feature recaps." },
    { title: "Q&A Preparation", objective: "Handle the toughest technical or pricing objection cleanly.", seconds: 90, cue: "Answer the objection straight, concede what's true, then anchor back to the value that survives it. The trap is getting defensive or answering a softer question than the one asked.", hint: "Weigh directness and honest concession before reframing; penalize defensiveness and question-dodging." },
  ],
  meeting: [
    { title: "Opening", objective: "State the purpose of the meeting and what you need from the room.", seconds: 30, cue: "First sentence: why we're here. Second: what you need from the room by the end. The trap is small-talking into the agenda and asking for the decision only when time's up.", hint: "Weigh whether purpose and the needed outcome are stated up front; penalize openings that defer the ask." },
    { title: "Progress", objective: "What moved since last time. Outcomes, not activity.", seconds: 90, cue: "Report what changed in the world, not what you worked on. Outcomes with numbers where you have them. The trap is a busy-list that proves effort but not movement.", hint: "Weigh outcome-orientation (what changed, quantified); penalize activity lists without results." },
    { title: "Problems", objective: "The real blockers, stated plainly, with what you've tried.", seconds: 90, cue: "Name the real blocker in one plain sentence, then what you've already tried. That's what makes help possible. The trap is softening the problem until nobody realizes you're asking for help.", hint: "Weigh plain, unsoftened problem statements paired with attempted fixes; penalize vagueness that obscures the blocker." },
    { title: "Plans", objective: "What happens next and who owns it.", seconds: 90, cue: "Give each next step an owner and a date, and say the one thing that would derail it. The trap is plans in the passive voice. 'this will get done' by nobody in particular.", hint: "Weigh explicit ownership and dates on next steps; penalize passive-voice ownerless plans." },
    { title: "The Ask", objective: "The decision or resource you need before everyone leaves.", seconds: 60, cue: "Make the ask unmissable: the specific decision or resource, from a named person, by a date. The trap is ending on 'thoughts?' and calling it an ask.", hint: "Weigh whether there is one explicit, addressed, time-bound ask; penalize open-ended 'thoughts?' closes." },
  ],
  speech: [
    { title: "Opening", objective: "A first line that earns the room's attention without a throat-clear.", seconds: 60, cue: "Your first line should be the one you'd keep if you could only keep one. Start inside the material. The trap is thanking the organizers and describing what you're about to say.", hint: "Weigh whether the first line itself earns attention; penalize thank-yous and meta-preamble before the content." },
    { title: "The Theme", objective: "The one idea this speech exists to plant.", seconds: 90, cue: "Say the one idea plainly enough that a listener could repeat it at dinner tonight. The trap is planting three themes and harvesting none.", hint: "Weigh whether one repeatable central idea is stated clearly; penalize multiple competing themes." },
    { title: "The Story", objective: "The narrative that makes the theme land emotionally.", seconds: 120, cue: "Pick the story that makes the theme inevitable, and slow down at the moment that matters most. The trap is summarizing the story instead of telling it. Detail is where the feeling lives.", hint: "Weigh scene-level storytelling that serves the theme; penalize summarized, detail-free narration." },
    { title: "The Takeaway", objective: "Turn the story into something the audience can use Monday morning.", seconds: 60, cue: "Translate the story into one thing the audience can do differently Monday morning. Concrete beats inspiring. The trap is ending on a platitude that evaporates in the parking lot.", hint: "Weigh actionability of the takeaway; penalize abstract inspiration with no usable instruction." },
    { title: "Closing", objective: "End on the theme. Last words are remembered words.", seconds: 60, cue: "Land your final sentence on the theme and stop. The last ten words are the ones they keep. The trap is a strong close followed by two minutes of postscript.", hint: "Weigh whether the close returns to the theme and ends decisively; penalize trailing additions after the natural ending." },
  ],
  other: [
    { title: "Opening", objective: "Set context fast and say why this conversation matters now.", seconds: 60, cue: "Give just enough context to orient them, then say why this matters right now. Urgency earns attention. The trap is backstory that delays the point past their patience.", hint: "Weigh economy of context and a clear 'why now'; penalize slow wind-ups." },
    { title: "Main Message", objective: "The one thing they must remember, stated first, supported second.", seconds: 120, cue: "Say the one thing they must remember in your first breath, then spend the rest earning it. The trap is building to the point instead of from it.", hint: "Weigh message-first ordering and a single clear core claim; penalize burying the main point." },
    { title: "Support", objective: "Your two strongest pieces of evidence or reasoning.", seconds: 90, cue: "Two strong pieces of evidence, each in its own lane. A number and a story travel furthest together. The trap is piling on weak reasons that dilute the strong ones.", hint: "Weigh strength and distinctness of the two supports; penalize long lists of weak or overlapping reasons." },
    { title: "Closing & Ask", objective: "What you want to happen next, asked for directly.", seconds: 60, cue: "Ask for exactly what you want to happen next, out loud, and then stop talking. The trap is hinting at the ask and hoping they infer it.", hint: "Weigh whether the ask is explicit and direct; penalize implied or hedged asks." },
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
      coachCue: m.cue,
      scoringHint: m.hint,
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
