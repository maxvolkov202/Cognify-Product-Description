import type { PressureArchetypeId } from "@/lib/ai/pressure-archetypes";
import type { PressurePrompt, PressureSetting } from "./types";

/**
 * Cognify Pressure Prompt Bank — WS-3
 *
 * Each archetype has 8+ prompts spanning common high-stakes professional
 * situations (sales, interviews, exec briefs, peer feedback, presentations,
 * team conflict, negotiation). Prompts are self-contained strings that
 * bake in the pressure mechanism — the user reads one prompt and knows
 * exactly what's coming.
 *
 * The bank stores `PressurePrompt` objects with stable `id` and a
 * `setting` tag (work / public / personal). The archetype IS the primary
 * variation axis; setting is secondary — used by the picker to avoid all
 * five prompts on a slate being workplace scenarios when the user has
 * "personal" verticals.
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

export const PRESSURE_PROMPTS: Record<
  PressureArchetypeId,
  readonly PressurePrompt[]
> = {
  // ——— Pushback ——————————————————————————————————————————————
  // User makes a case; an objection arrives at the end of the prompt.
  // The rep must acknowledge + redirect without abandoning the original
  // claim. Scores reward the Acknowledge → Redirect → Land pattern.
  pushback: [
    {
      id: "pushback_001",
      setting: "work",
      text: "Make the case to your manager that you deserve the lead role on the next big project. When you finish, they say: \"You've only been on the team six months — is this really the right moment?\" Respond.",
    },
    {
      id: "pushback_002",
      setting: "work",
      text: "You're pitching a new tool to buy to your ops lead. Your three-line case lands, and then they say: \"We tried something like this last year and no one adopted it.\" Keep your claim alive.",
    },
    {
      id: "pushback_003",
      setting: "work",
      text: "Tell a skeptical colleague why the team should adopt code reviews before merging. At the end they say: \"Reviews just slow us down — good engineers don't need them.\" Respond without caving.",
    },
    {
      id: "pushback_004",
      setting: "work",
      text: "Make the argument to a founder that hiring a PM now is the right call. They push back: \"PMs are overhead. I can run product myself for another year.\" Hold your point.",
    },
    {
      id: "pushback_005",
      setting: "personal",
      text: "You're convincing a friend to quit their comfortable job for a startup. After your pitch, they say: \"That sounds reckless — I have a mortgage.\" Respond.",
    },
    {
      id: "pushback_006",
      setting: "work",
      text: "Argue to your director that the team should stop weekly all-hands. At the end, they say: \"The all-hands is the only thing keeping us aligned.\" Keep going.",
    },
    {
      id: "pushback_007",
      setting: "work",
      text: "Pitch your VP on replacing your agency with an in-house team. They say: \"Every in-house team I've built has been slower and more expensive.\" Respond.",
    },
    {
      id: "pushback_008",
      setting: "work",
      text: "Tell a peer that the new process they designed isn't working for your team. They say: \"Everyone else has adapted — what's different about your team?\" Stay specific.",
    },
  ],

  // ——— Time Compression ——————————————————————————————————————
  // The constraint itself is the pressure: 15-20 seconds to say what
  // would normally take a minute. No preamble, no hedging, no rescue-
  // by-rambling. Scores reward verb-first, signal-dense delivery.
  time_compression: [
    {
      id: "time_compression_001",
      setting: "work",
      text: "Your CEO stops you in the hallway: \"Why are we two weeks behind on the launch?\" You have 15 seconds. No preamble.",
    },
    {
      id: "time_compression_002",
      setting: "work",
      text: "In a board meeting, a director asks: \"What's the one thing you'd change about how this team operates?\" 20 seconds. Go.",
    },
    {
      id: "time_compression_003",
      setting: "work",
      text: "Your biggest client emails: \"Give me the top three reasons I should renew.\" You have 20 seconds on a voice note. Start.",
    },
    {
      id: "time_compression_004",
      setting: "work",
      text: "You're in an elevator with the CFO. They ask: \"What's the most important metric your team watches?\" 15 seconds.",
    },
    {
      id: "time_compression_005",
      setting: "public",
      text: "A reporter calls: \"What does your company actually do?\" 20 seconds. No jargon.",
    },
    {
      id: "time_compression_006",
      setting: "public",
      text: "An investor asks at a pitch event: \"Why you?\" You have 15 seconds to answer. Begin.",
    },
    {
      id: "time_compression_007",
      setting: "public",
      text: "A recruiter catches you at a conference: \"Tell me about yourself — what you do, what you want next.\" 20 seconds.",
    },
    {
      id: "time_compression_008",
      setting: "work",
      text: "Your direct report asks: \"What should I focus on this week?\" You have 15 seconds. Be actionable.",
    },
    {
      id: "time_compression_009",
      setting: "public",
      text: "Someone at a networking event asks: \"What are you working on that you're excited about?\" 20 seconds.",
    },
  ],

  // ——— Audience Switch ———————————————————————————————————————
  // Same substance, two audiences, one rep. Scores reward register
  // shifts (vocabulary, stakes framing) without substance drift.
  // Note the explicit "pivot" line users must verbally include.
  audience_switch: [
    {
      id: "audience_switch_001",
      setting: "work",
      text: "Explain what your team does. First audience: a marketing intern on their first day (20 seconds). Then — pivot — now you're telling the CFO what your team costs vs. returns (15 seconds).",
    },
    {
      id: "audience_switch_002",
      setting: "work",
      text: "Explain why a project failed. First to the junior engineer who worked on it, who needs to learn (20s). Then to the VP who approved it, who needs to decide about the next one (15s).",
    },
    {
      id: "audience_switch_003",
      setting: "work",
      text: "Explain AI to two people. First a designer who's suspicious of it (20s). Then a researcher who's deep in the field and wants to know what's genuinely new to you (15s).",
    },
    {
      id: "audience_switch_004",
      setting: "personal",
      text: "Describe your product. First to your grandparent, who's never heard of it (20s). Then to a potential competitor's engineer at a meetup (15s).",
    },
    {
      id: "audience_switch_005",
      setting: "work",
      text: "Explain the company's new strategy. First to the customer support team who'll field questions about it (20s). Then to the founder, whose instinct is it's not ambitious enough (15s).",
    },
    {
      id: "audience_switch_006",
      setting: "work",
      text: "Explain a technical decision. First to a product manager without a CS background (20s). Then to a senior architect who'll challenge every tradeoff (15s).",
    },
    {
      id: "audience_switch_007",
      setting: "personal",
      text: "Describe a recent win. First to a friend outside your industry at a dinner (20s). Then to a VC on a call who's evaluating whether to invest (15s).",
    },
    {
      id: "audience_switch_008",
      setting: "work",
      text: "Explain how you'd handle a team conflict. First to a new manager looking for a template (20s). Then to your HR partner who's watching for liability (15s).",
    },
  ],

  // ——— Clarifying Interrupt ——————————————————————————————————
  // Mid-explanation, a specific simulated interrupt lands. The rep
  // must acknowledge, recover, and land the point. Scores reward the
  // recovery — handled well, this builds credibility; handled badly,
  // it breaks it.
  clarifying_interrupt: [
    {
      id: "clarifying_interrupt_001",
      setting: "work",
      text: "Walk me through how you'd handle a coworker who misses deadlines. Around 15 seconds in you'll hear: \"That doesn't address the root issue — try again.\" Keep your structure. Recover.",
    },
    {
      id: "clarifying_interrupt_002",
      setting: "personal",
      text: "Explain how you'd decide between two job offers. About 15 seconds in, the interrupt says: \"You're just listing things — what actually matters to you?\" Respond and keep going.",
    },
    {
      id: "clarifying_interrupt_003",
      setting: "work",
      text: "Teach someone how to give constructive feedback. 15 seconds in: \"That sounds like theory — what do you actually say?\" Land concrete next.",
    },
    {
      id: "clarifying_interrupt_004",
      setting: "work",
      text: "Describe your approach to onboarding a new hire. 15 seconds in: \"I've heard all this before. What's different about your way?\" Respond with specificity.",
    },
    {
      id: "clarifying_interrupt_005",
      setting: "work",
      text: "Explain why your project deserves more budget. 15 seconds in the CFO interrupts: \"I'm not hearing ROI, I'm hearing activity.\" Redirect.",
    },
    {
      id: "clarifying_interrupt_006",
      setting: "work",
      text: "Walk through how you'd improve your team's meetings. 15 seconds in: \"Every team thinks their meetings are the problem. What's the actual waste?\" Stay sharp.",
    },
    {
      id: "clarifying_interrupt_007",
      setting: "work",
      text: "Explain why your hiring bar should stay high. 15 seconds in: \"That's what every team says right before they miss their goals.\" Hold the line.",
    },
    {
      id: "clarifying_interrupt_008",
      setting: "work",
      text: "Describe how you'd recover a stalled deal. 15 seconds in the customer says: \"Honestly, I think you're just trying to save the commission.\" Respond without defensiveness.",
    },
  ],

  // ——— Stakes Raise ——————————————————————————————————————————
  // Normal mechanics, high-stakes framing. The test is composure +
  // delivery when the prompt names a real consequence. Scores weight
  // confidence and delivery heavily — did you sound like you believed
  // what you said when it mattered?
  stakes_raise: [
    {
      id: "stakes_raise_001",
      setting: "public",
      text: "This is the interview question that decides the offer: \"Tell me about a time you failed.\" 45 seconds. Start when you're ready.",
    },
    {
      id: "stakes_raise_002",
      setting: "work",
      text: "The board is deciding whether to fund another year. They ask: \"In one minute, tell us why you're the right CEO for what's coming next.\" 60 seconds.",
    },
    {
      id: "stakes_raise_003",
      setting: "work",
      text: "Your largest customer is on the call. They say: \"Give me one reason not to churn.\" 30 seconds. Go.",
    },
    {
      id: "stakes_raise_004",
      setting: "work",
      text: "You're up for a promotion. The VP asks: \"What's the biggest risk you see with you in this role?\" 45 seconds — honest answer, composed delivery.",
    },
    {
      id: "stakes_raise_005",
      setting: "personal",
      text: "You're about to ask your partner to move cities with you for this opportunity. You have 60 seconds to tell them why it's worth it.",
    },
    {
      id: "stakes_raise_006",
      setting: "work",
      text: "The CEO calls you into their office: \"The layoffs list has your team on it. Convince me otherwise.\" 45 seconds.",
    },
    {
      id: "stakes_raise_007",
      setting: "public",
      text: "You're meeting the investor who could take this company to the next stage. They ask: \"What's the thing you're most afraid of?\" 30 seconds — real answer.",
    },
    {
      id: "stakes_raise_008",
      setting: "work",
      text: "Your team of six is in the room. Morale is low after a bad quarter. You have one minute to say what you actually believe about the next one. 60 seconds.",
    },
  ],
} as const;

/**
 * Stratified sampling helper for pressure prompts. Round-robins across
 * present settings (work / public / personal) before doubling up so the
 * picker doesn't dump 5 workplace prompts on a user with a personal-life
 * vertical.
 */
function pickStratifiedBySetting(
  bank: readonly PressurePrompt[],
  count: number,
  rand: () => number = Math.random,
): PressurePrompt[] {
  if (bank.length === 0 || count <= 0) return [];

  const buckets: Record<PressureSetting, PressurePrompt[]> = {
    work: [],
    public: [],
    personal: [],
  };
  for (const p of bank) buckets[p.setting].push(p);

  const shuffle = (arr: PressurePrompt[]): PressurePrompt[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const ordered: Record<PressureSetting, PressurePrompt[]> = {
    work: shuffle(buckets.work),
    public: shuffle(buckets.public),
    personal: shuffle(buckets.personal),
  };

  const presentSettings = (
    Object.keys(ordered) as PressureSetting[]
  ).filter((s) => ordered[s].length > 0);
  // Shuffle the order in which we visit settings each call.
  const settingOrder = [...presentSettings];
  for (let i = settingOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [settingOrder[i], settingOrder[j]] = [settingOrder[j]!, settingOrder[i]!];
  }

  const picked: PressurePrompt[] = [];
  while (picked.length < count) {
    let advanced = false;
    for (const s of settingOrder) {
      if (picked.length >= count) break;
      const next = ordered[s].shift();
      if (next) {
        picked.push(next);
        advanced = true;
      }
    }
    if (!advanced) break;
  }
  return picked;
}

/** O(1) id → prompt lookup, built once at module load. */
const PRESSURE_PROMPT_INDEX: ReadonlyMap<string, PressurePrompt> = (() => {
  const map = new Map<string, PressurePrompt>();
  for (const bank of Object.values(PRESSURE_PROMPTS)) {
    for (const p of bank) map.set(p.id, p);
  }
  return map;
})();

/** Look up a single pressure prompt object by id. */
export function getPressurePromptById(id: string): PressurePrompt | undefined {
  return PRESSURE_PROMPT_INDEX.get(id);
}

/** Setting of a pressure prompt id, for picker stratification. */
export function getPressurePromptSetting(
  id: string,
): PressureSetting | undefined {
  return PRESSURE_PROMPT_INDEX.get(id)?.setting;
}

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
  return bank[idx]?.text ?? bank[0]!.text;
}

/**
 * Pick N prompt objects from an archetype's bank, stratified across
 * `setting` so a single slate always shows variety across work / public /
 * personal when the bank has multiple settings. Object form preserves
 * stable ids for the per-user history filter.
 */
export function pickPressurePromptObjects(
  archetypeId: PressureArchetypeId,
  count: number,
  opts: { rand?: () => number } = {},
): PressurePrompt[] {
  const { rand = Math.random } = opts;
  const bank = PRESSURE_PROMPTS[archetypeId];
  return pickStratifiedBySetting(bank, count, rand);
}

/** Text-returning picker — thin wrapper for callers that don't need ids. */
export function pickPressurePrompts(
  archetypeId: PressureArchetypeId,
  count: number,
  opts: { rand?: () => number } = {},
): string[] {
  return pickPressurePromptObjects(archetypeId, count, opts).map((p) => p.text);
}
