import type { PressureArchetypeId } from "@/lib/ai/pressure-archetypes";

/**
 * Cognify Pressure Prompt Bank — WS-3
 *
 * Each archetype has 8+ prompts spanning common high-stakes professional
 * situations (sales, interviews, exec briefs, peer feedback, presentations,
 * team conflict, negotiation). Prompts are self-contained strings that
 * bake in the pressure mechanism — the user reads one prompt and knows
 * exactly what's coming.
 *
 * Authoring rules (from pressure-system.md §6):
 *   - Concrete: name the setting, audience, stakes. No abstract "talk about X".
 *   - Realistic: use lines a real person would actually say.
 *   - Archetype-clean: the mechanism is visible in the prompt, not assumed.
 *   - Time-honest: time compression prompts name the budget explicitly.
 *   - Audience-explicit: switches name both audiences by role.
 *
 * These prompts are general (not vertical-gated) — the Build a Rep flow
 * is where the user's specific context lands. Workout pressure prompts
 * aim at professional situations everyone encounters.
 */

export const PRESSURE_PROMPTS: Record<PressureArchetypeId, readonly string[]> =
  {
    // ——— Pushback ——————————————————————————————————————————————
    // User makes a case; an objection arrives at the end of the prompt.
    // The rep must acknowledge + redirect without abandoning the original
    // claim. Scores reward the Acknowledge → Redirect → Land pattern.
    pushback: [
      "Make the case to your manager that you deserve the lead role on the next big project. When you finish, they say: \"You've only been on the team six months — is this really the right moment?\" Respond.",
      "You're pitching a new tool to buy to your ops lead. Your three-line case lands, and then they say: \"We tried something like this last year and no one adopted it.\" Keep your claim alive.",
      "Tell a skeptical colleague why the team should adopt code reviews before merging. At the end they say: \"Reviews just slow us down — good engineers don't need them.\" Respond without caving.",
      "Make the argument to a founder that hiring a PM now is the right call. They push back: \"PMs are overhead. I can run product myself for another year.\" Hold your point.",
      "You're convincing a friend to quit their comfortable job for a startup. After your pitch, they say: \"That sounds reckless — I have a mortgage.\" Respond.",
      "Argue to your director that the team should stop weekly all-hands. At the end, they say: \"The all-hands is the only thing keeping us aligned.\" Keep going.",
      "Pitch your VP on replacing your agency with an in-house team. They say: \"Every in-house team I've built has been slower and more expensive.\" Respond.",
      "Tell a peer that the new process they designed isn't working for your team. They say: \"Everyone else has adapted — what's different about your team?\" Stay specific.",
    ],

    // ——— Time Compression ——————————————————————————————————————
    // The constraint itself is the pressure: 15-20 seconds to say what
    // would normally take a minute. No preamble, no hedging, no rescue-
    // by-rambling. Scores reward verb-first, signal-dense delivery.
    time_compression: [
      "Your CEO stops you in the hallway: \"Why are we two weeks behind on the launch?\" You have 15 seconds. No preamble.",
      "In a board meeting, a director asks: \"What's the one thing you'd change about how this team operates?\" 20 seconds. Go.",
      "Your biggest client emails: \"Give me the top three reasons I should renew.\" You have 20 seconds on a voice note. Start.",
      "You're in an elevator with the CFO. They ask: \"What's the most important metric your team watches?\" 15 seconds.",
      "A reporter calls: \"What does your company actually do?\" 20 seconds. No jargon.",
      "An investor asks at a pitch event: \"Why you?\" You have 15 seconds to answer. Begin.",
      "A recruiter catches you at a conference: \"Tell me about yourself — what you do, what you want next.\" 20 seconds.",
      "Your direct report asks: \"What should I focus on this week?\" You have 15 seconds. Be actionable.",
      "Someone at a networking event asks: \"What are you working on that you're excited about?\" 20 seconds.",
    ],

    // ——— Audience Switch ———————————————————————————————————————
    // Same substance, two audiences, one rep. Scores reward register
    // shifts (vocabulary, stakes framing) without substance drift.
    // Note the explicit "pivot" line users must verbally include.
    audience_switch: [
      "Explain what your team does. First audience: a marketing intern on their first day (20 seconds). Then — pivot — now you're telling the CFO what your team costs vs. returns (15 seconds).",
      "Explain why a project failed. First to the junior engineer who worked on it, who needs to learn (20s). Then to the VP who approved it, who needs to decide about the next one (15s).",
      "Explain AI to two people. First a designer who's suspicious of it (20s). Then a researcher who's deep in the field and wants to know what's genuinely new to you (15s).",
      "Describe your product. First to your grandparent, who's never heard of it (20s). Then to a potential competitor's engineer at a meetup (15s).",
      "Explain the company's new strategy. First to the customer support team who'll field questions about it (20s). Then to the founder, whose instinct is it's not ambitious enough (15s).",
      "Explain a technical decision. First to a product manager without a CS background (20s). Then to a senior architect who'll challenge every tradeoff (15s).",
      "Describe a recent win. First to a friend outside your industry at a dinner (20s). Then to a VC on a call who's evaluating whether to invest (15s).",
      "Explain how you'd handle a team conflict. First to a new manager looking for a template (20s). Then to your HR partner who's watching for liability (15s).",
    ],

    // ——— Clarifying Interrupt ——————————————————————————————————
    // Mid-explanation, a specific simulated interrupt lands. The rep
    // must acknowledge, recover, and land the point. Scores reward the
    // recovery — handled well, this builds credibility; handled badly,
    // it breaks it.
    clarifying_interrupt: [
      "Walk me through how you'd handle a coworker who misses deadlines. Around 15 seconds in you'll hear: \"That doesn't address the root issue — try again.\" Keep your structure. Recover.",
      "Explain how you'd decide between two job offers. About 15 seconds in, the interrupt says: \"You're just listing things — what actually matters to you?\" Respond and keep going.",
      "Teach someone how to give constructive feedback. 15 seconds in: \"That sounds like theory — what do you actually say?\" Land concrete next.",
      "Describe your approach to onboarding a new hire. 15 seconds in: \"I've heard all this before. What's different about your way?\" Respond with specificity.",
      "Explain why your project deserves more budget. 15 seconds in the CFO interrupts: \"I'm not hearing ROI, I'm hearing activity.\" Redirect.",
      "Walk through how you'd improve your team's meetings. 15 seconds in: \"Every team thinks their meetings are the problem. What's the actual waste?\" Stay sharp.",
      "Explain why your hiring bar should stay high. 15 seconds in: \"That's what every team says right before they miss their goals.\" Hold the line.",
      "Describe how you'd recover a stalled deal. 15 seconds in the customer says: \"Honestly, I think you're just trying to save the commission.\" Respond without defensiveness.",
    ],

    // ——— Stakes Raise ——————————————————————————————————————————
    // Normal mechanics, high-stakes framing. The test is composure +
    // delivery when the prompt names a real consequence. Scores weight
    // confidence and delivery heavily — did you sound like you believed
    // what you said when it mattered?
    stakes_raise: [
      "This is the interview question that decides the offer: \"Tell me about a time you failed.\" 45 seconds. Start when you're ready.",
      "The board is deciding whether to fund another year. They ask: \"In one minute, tell us why you're the right CEO for what's coming next.\" 60 seconds.",
      "Your largest customer is on the call. They say: \"Give me one reason not to churn.\" 30 seconds. Go.",
      "You're up for a promotion. The VP asks: \"What's the biggest risk you see with you in this role?\" 45 seconds — honest answer, composed delivery.",
      "You're about to ask your partner to move cities with you for this opportunity. You have 60 seconds to tell them why it's worth it.",
      "The CEO calls you into their office: \"The layoffs list has your team on it. Convince me otherwise.\" 45 seconds.",
      "You're meeting the investor who could take this company to the next stage. They ask: \"What's the thing you're most afraid of?\" 30 seconds — real answer.",
      "Your team of six is in the room. Morale is low after a bad quarter. You have one minute to say what you actually believe about the next one. 60 seconds.",
    ],
  } as const;

/**
 * Pick a random prompt from a pressure archetype's bank.
 *
 * Accepts an optional `rand` function for deterministic testing.
 */
export function pickPressurePrompt(
  archetypeId: PressureArchetypeId,
  opts: { rand?: () => number } = {},
): string {
  const { rand = Math.random } = opts;
  const bank = PRESSURE_PROMPTS[archetypeId];
  const idx = Math.floor(rand() * bank.length);
  return bank[idx] ?? bank[0]!;
}

/**
 * Pick N distinct prompts from an archetype's bank — used by the prompt
 * picker UI to show a small selection for the user to choose from.
 */
export function pickPressurePrompts(
  archetypeId: PressureArchetypeId,
  count: number,
  opts: { rand?: () => number } = {},
): string[] {
  const { rand = Math.random } = opts;
  const bank = [...PRESSURE_PROMPTS[archetypeId]];
  // Fisher-Yates shuffle against the provided rand
  for (let i = bank.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bank[i], bank[j]] = [bank[j]!, bank[i]!];
  }
  return bank.slice(0, Math.min(count, bank.length));
}
