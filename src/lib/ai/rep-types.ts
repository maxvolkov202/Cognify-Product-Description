import type { SkillDimension } from "@/types/domain";
import type { ImprovementGoalId } from "@/lib/onboarding/constants";

/**
 * Cognify Rep Types — team spec v2-beta.1
 *
 * The nine "exercises" of the Daily Workout. Each rep type is a specific
 * speaking drill with a target skill and a prompt bank.
 *
 * Rep types:
 *   1. Simplify        — clarity via Feynman technique
 *   2. Structure       — organization via Main → 3 Points → Close
 *   3. Think Fast      — confidence via no-prep response
 *   4. Be Concise      — pacing via tight time constraint
 *   5. Reinforce       — clarity via teach-back
 *   6. Persuade        — relevance via elevator pitch
 *   7. Adapt           — tone via reframing for two audiences
 *   8. Deliver         — pacing via deliberate pause and tempo
 *   9. Handle Pressure — confidence via pushback response
 *
 * A Daily Workout session is 4–5 reps of different types, chosen based
 * on the user's onboarding goals. For each rep, 5 prompts from the rep
 * type's bank are shown; the user picks one (or refreshes for 5 more).
 *
 * See src/lib/ai/prompts/workout.ts for the prompt banks.
 */

export type RepTypeId =
  | "simplify"
  | "structure"
  | "think_fast"
  | "be_concise"
  | "reinforce"
  | "persuade"
  | "adapt"
  | "deliver"
  | "handle_pressure";

export type RepTypeFrameworkSection = {
  readonly label: string;
  readonly hint: string;
  /** One-sentence worked example of this section. Concrete, not abstract —
   *  the user reads it and hears what hitting the section sounds like. */
  readonly example: string;
};

export type RepTypeFramework = {
  readonly name: string;
  readonly sections: readonly RepTypeFrameworkSection[];
  /** The scenario the example sections build toward, so the user sees
   *  how the sections land as a single cohesive rep. */
  readonly exampleScenario: string;
};

export type RepType = {
  readonly id: RepTypeId;
  readonly name: string;
  /** Consumer-friendly H1 shown on the prompt-pick screen (mockup #2).
   *  More human than `name` — "Teach it step by step" vs "Simplify". */
  readonly displayTitle: string;
  readonly tagline: string;
  readonly purpose: string;
  readonly behavior: string;
  readonly primaryDimension: SkillDimension;
  readonly secondaryDimensions: readonly SkillDimension[];
  readonly timeBudgetSec: number;
  readonly instruction: string;
  /** Structural scaffold shown to the user during the rep as a cheat-sheet
   *  strip. Not editable — this is fixed per rep type. */
  readonly framework: RepTypeFramework;
  /** Rep types flagged `isPressureType: true` require a `pressureArchetype`
   *  to be selected at orchestration time. The rep's prompt + scoring
   *  weights + UI treatment come from the archetype, not the rep type.
   *  See `pressure-archetypes.ts` and `docs/proposals/pressure-system.md`. */
  readonly isPressureType?: boolean;
};

export const REP_TYPES: readonly RepType[] = [
  {
    id: "simplify",
    name: "Simplify",
    displayTitle: "Teach it step by step",
    tagline: "Feynman Technique",
    purpose:
      "Explain a complex concept simply, as if to someone who's never heard it",
    behavior:
      "You have 30 seconds to make a complex idea land for a beginner",
    primaryDimension: "clarity",
    secondaryDimensions: ["structure", "conciseness"],
    timeBudgetSec: 30,
    instruction: "Explain simply",
    framework: {
      name: "Feynman",
      exampleScenario: "Explain how habits form",
      sections: [
        {
          label: "Name it",
          hint: "State the concept in one sentence, plainly — no jargon.",
          example:
            "A habit is a behavior your brain has automated so you don't have to think about doing it.",
        },
        {
          label: "Analogy",
          hint: "Compare it to something a beginner already understands.",
          example:
            "Think of it like learning to drive — at first every action is deliberate, then it becomes muscle memory.",
        },
        {
          label: "Why it matters",
          hint: "Tie it back to a real-world stake — what changes because of this?",
          example:
            "Once something is habitual it costs no willpower, which is why small habits compound into big outcomes.",
        },
        {
          label: "Spot the gap",
          hint: "Point at where this explanation would still leave someone confused.",
          example:
            "This skips the neuroscience — the basal-ganglia part — because you don't need it to start building one.",
        },
      ],
    },
  },
  {
    id: "structure",
    name: "Structure",
    displayTitle: "Main point, support, close",
    tagline: "Main → 3 Points → Close",
    purpose:
      "Organize ideas into a clean opening, three supporting points, and a close",
    behavior:
      "You have 45 seconds to build an argument with visible scaffolding",
    primaryDimension: "structure",
    secondaryDimensions: ["clarity", "conciseness"],
    timeBudgetSec: 45,
    instruction: "Main point → three supporting → close",
    framework: {
      name: "Main + 3 + Close",
      exampleScenario: "Why trust is the foundation of every relationship",
      sections: [
        {
          label: "Hook",
          hint: "Name the main point in the first 10 seconds. Give a count (\"Three things…\").",
          example:
            "Trust is the foundation of every relationship, and three specific behaviors build it.",
        },
        {
          label: "Point 1",
          hint: "First supporting point. Use a connector: \"First…\"",
          example:
            "First, consistency — showing up the same way whether it's easy or hard.",
        },
        {
          label: "Point 2",
          hint: "Second supporting point. \"Second…\" or \"Which brings me to…\"",
          example:
            "Second, honesty about what you don't know, not just what you do.",
        },
        {
          label: "Point 3",
          hint: "Third supporting point. Land it before moving on.",
          example:
            "Third, following through — every kept commitment is a deposit; every broken one is a withdrawal.",
        },
        {
          label: "Close",
          hint: "Restate the main point. Listener should walk away with the hook.",
          example:
            "Consistency, honesty, follow-through. That's how trust gets built — in that order.",
        },
      ],
    },
  },
  {
    id: "think_fast",
    name: "Think Fast",
    displayTitle: "Respond with no prep",
    tagline: "No Prep",
    purpose: "Respond coherently with zero preparation time",
    behavior:
      "You have 30 seconds. You hear the prompt, you start talking",
    primaryDimension: "thinking_quality",
    secondaryDimensions: ["clarity", "delivery"],
    timeBudgetSec: 30,
    instruction: "React immediately — no planning",
    framework: {
      name: "PREP",
      exampleScenario: "Is technology making people more connected or less?",
      sections: [
        {
          label: "Point",
          hint: "State your position in one direct sentence. No hedges.",
          example:
            "Technology has made us more reachable but less connected.",
        },
        {
          label: "Reason",
          hint: "One reason why. Clearly causal: \"because\" or \"the reason is\".",
          example:
            "The reason is it lowered the cost of contact, but connection requires attention — and attention is what got traded away.",
        },
        {
          label: "Example",
          hint: "One concrete moment or data point that supports the reason.",
          example:
            "Look at any dinner table — six phones out, six half-conversations, nobody fully there.",
        },
        {
          label: "Point again",
          hint: "Restate the point in the same words. Anchors the listener.",
          example:
            "So: more reachable, less connected. Reach isn't connection.",
        },
      ],
    },
  },
  {
    id: "be_concise",
    name: "Be Concise",
    displayTitle: "Say the most in the fewest words",
    tagline: "Time Constraint",
    purpose:
      "Say the most with the fewest words, under a tight deadline",
    behavior:
      "You have 20 seconds. Every word has to carry its weight",
    primaryDimension: "conciseness",
    secondaryDimensions: ["clarity", "delivery"],
    timeBudgetSec: 20,
    instruction: "Maximum signal per word",
    framework: {
      name: "BLUF",
      exampleScenario: "Explain why sleep is non-negotiable in 15 seconds",
      sections: [
        {
          label: "Bottom line",
          hint: "The answer. Say it first. One sentence, verb at the front.",
          example:
            "Protect seven hours of sleep — it's the single highest-return habit you can build.",
        },
        {
          label: "Why",
          hint: "One reason or number that makes it stick. No throat-clearing.",
          example:
            "A week under six hours drops cognitive performance to the level of legal intoxication.",
        },
        {
          label: "Stop",
          hint: "Don't pad. Silence after the evidence is a feature, not a bug.",
          example:
            "[End here. Don't add \"and that's why sleep is important.\" Let the number land.]",
        },
      ],
    },
  },
  {
    id: "reinforce",
    name: "Reinforce",
    displayTitle: "Walk through it like you're teaching",
    tagline: "Teach Back",
    purpose: "Explain how to do something, step by step, as if teaching",
    behavior:
      "You have 35 seconds to walk someone through doing something",
    primaryDimension: "clarity",
    secondaryDimensions: ["structure", "delivery"],
    timeBudgetSec: 35,
    instruction: "Teach it step by step",
    framework: {
      name: "Teach-Back",
      exampleScenario: "Explain how to remember names",
      sections: [
        {
          label: "What",
          hint: "Name the skill or task in one sentence. What will they do?",
          example:
            "You're going to lock in someone's name in under ten seconds using three small moves.",
        },
        {
          label: "Step-by-step",
          hint: "Walk through the steps in order. Use \"first / then / finally.\"",
          example:
            "First, say their name back to them in your reply. Then picture the name written on their forehead. Finally, use it once more before the conversation ends.",
        },
        {
          label: "Common pitfall",
          hint: "Name one thing a beginner will get wrong. Tell them what to watch for.",
          example:
            "Most people nod while the name flies past them — the first step is the one everyone skips.",
        },
        {
          label: "Check",
          hint: "Give them a self-check: \"You'll know it worked when…\"",
          example:
            "You'll know it worked when you can recall the name two days later without an email prompt.",
        },
      ],
    },
  },
  {
    id: "persuade",
    name: "Persuade",
    displayTitle: "Convince them to act",
    tagline: "Elevator Pitch",
    purpose: "Convince someone to take a specific action",
    behavior:
      "You have 40 seconds to make a case that actually moves someone",
    primaryDimension: "adaptability",
    secondaryDimensions: ["structure", "conciseness"],
    timeBudgetSec: 40,
    instruction: "Convince them",
    framework: {
      name: "Problem-Impact-Solution",
      exampleScenario: "Convince someone to prioritize sleep",
      sections: [
        {
          label: "Problem",
          hint: "Name their pain in their own language. Not your product.",
          example:
            "You're waking up exhausted and still pushing through eight-hour workdays on caffeine.",
        },
        {
          label: "Impact",
          hint: "Quantify what the problem costs them — time, money, risk.",
          example:
            "Under six hours a night, your reaction time matches a 0.08 BAC — and your irritability costs you two real conversations a week.",
        },
        {
          label: "Solution",
          hint: "Your proposal in one crisp sentence. One verb, one outcome.",
          example:
            "Protect a hard 10:30 PM phone-off — that single rule gets you most of the seven hours back.",
        },
        {
          label: "Ask",
          hint: "The next concrete step. A time, a yes/no, a commitment.",
          example:
            "Try it for five nights this week. We'll check back Friday.",
        },
      ],
    },
  },
  {
    id: "adapt",
    name: "Adapt",
    displayTitle: "Same idea, two audiences",
    tagline: "Reframing",
    purpose:
      "Explain the same idea twice. Once for each of two different audiences",
    behavior:
      "You have 45 seconds. Start with audience A. Then switch to audience B",
    primaryDimension: "adaptability",
    secondaryDimensions: ["clarity", "conciseness"],
    timeBudgetSec: 45,
    instruction: "Two audiences, one rep",
    framework: {
      name: "Audience A → Audience B",
      exampleScenario: "Explain AI to a skeptic, then to an enthusiast",
      sections: [
        {
          label: "Frame for A",
          hint: "Say it in A's language — their jargon, their priorities, their stakes.",
          example:
            "For the skeptic: AI isn't magic. It's pattern-matching on a huge pile of text — useful in narrow ways, overhyped for the rest.",
        },
        {
          label: "Pivot",
          hint: "Signal the switch: \"For [B], here's how this lands differently…\"",
          example:
            "For the enthusiast, here's what's underneath that same boring answer:",
        },
        {
          label: "Frame for B",
          hint: "Same core point, B's language. Same idea, different register.",
          example:
            "The surprise isn't intelligence — it's that a statistical predictor this big starts looking like reasoning. That's the actual story.",
        },
        {
          label: "Tie back",
          hint: "Land on the one thing both audiences need to take away.",
          example:
            "Both read it right: it's narrow, and it's a bigger deal than narrow usually gets.",
        },
      ],
    },
  },
  {
    id: "deliver",
    name: "Deliver",
    displayTitle: "Pace and pauses that hold attention",
    tagline: "Pause + Pace",
    purpose:
      "Control rhythm. Slow down. Use deliberate pauses for emphasis",
    behavior:
      "You have 45 seconds. Prove you can hold attention through tempo",
    primaryDimension: "delivery",
    secondaryDimensions: ["thinking_quality", "adaptability"],
    timeBudgetSec: 45,
    instruction: "Pause for emphasis. Control the rhythm",
    framework: {
      name: "Pause + Pace",
      exampleScenario: "Share a lesson you learned",
      sections: [
        {
          label: "Open slow",
          hint: "First sentence deliberately under pace. Give the listener a moment to arrive.",
          example:
            "[Slow.] A few years ago I thought working harder was the only way I knew how to fix things.",
        },
        {
          label: "Land the claim",
          hint: "State the core idea, then pause. Two beats. Don't rush past it.",
          example:
            "And I learned the hard way — [pause] — that working harder is often the thing making it worse. [pause]",
        },
        {
          label: "Unpack",
          hint: "Normal tempo — evidence, example, context. Keep variation alive.",
          example:
            "[Normal tempo.] I doubled my hours on a project that needed fewer meetings, not more effort. The fix was to cut, not add.",
        },
        {
          label: "Close slow",
          hint: "Slow back down for the last line. The ending sets the aftertaste.",
          example:
            "[Slow again.] Now, when I'm tired and pushing harder — that's the moment I stop and subtract.",
        },
      ],
    },
  },
  {
    id: "handle_pressure",
    name: "Handle Pressure",
    displayTitle: "Hold your ground under real stress",
    tagline: "Pressure Rep",
    purpose:
      "Perform under a real stressor — pushback, time compression, audience switch, interruption, or raised stakes",
    behavior:
      "One of five pressure archetypes is selected per session. The prompt itself encodes the mechanism — read carefully before you start",
    primaryDimension: "adaptability",
    secondaryDimensions: ["thinking_quality", "delivery"],
    timeBudgetSec: 30,
    instruction: "Hold composure under the mechanism",
    isPressureType: true,
    framework: {
      name: "Acknowledge → Redirect → Land",
      exampleScenario:
        "You're making a case for sleep. Someone says: 'I function fine on 5 hours.'",
      sections: [
        {
          label: "Acknowledge",
          hint: "Name what they just said — fairly. \"You're right that X…\" No defensiveness.",
          example:
            "You're right that plenty of people feel fine on five hours — I used to tell myself the same thing.",
        },
        {
          label: "Redirect",
          hint: "Pivot to the angle they're missing. \"What I'd add is…\" or \"And here's why it still holds…\"",
          example:
            "What I'd add is the research keeps showing we're the worst judges of our own impairment — we notice the tired days but not the tired decisions.",
        },
        {
          label: "Land",
          hint: "Restate your position with new evidence. End flat — no upward inflection.",
          example:
            "So the claim still holds: five hours feels fine, but the cost shows up in judgment you can't see. Worth testing for a week.",
        },
      ],
    },
  },
] as const;

export function getRepType(id: RepTypeId): RepType {
  const rt = REP_TYPES.find((r) => r.id === id);
  if (!rt) throw new Error(`Unknown rep type: ${id}`);
  return rt;
}

export function isRepTypeId(id: string): id is RepTypeId {
  return REP_TYPES.some((r) => r.id === id);
}

/**
 * Map a user's improvement goal (from onboarding) to the rep types that
 * train it best. A user who selected "explaining" sees more Simplify
 * and Reinforce reps. A user who selected "confidence" sees more Think
 * Fast and Handle Pressure.
 */
export const GOAL_TO_REP_TYPES: Record<
  ImprovementGoalId,
  readonly RepTypeId[]
> = {
  explaining: ["simplify", "reinforce", "structure"],
  handling_objections: ["handle_pressure", "persuade", "think_fast"],
  confidence: ["think_fast", "handle_pressure", "deliver"],
  thinking_on_the_spot: ["think_fast", "handle_pressure", "be_concise"],
  giving_feedback: ["structure", "adapt", "deliver"],
  negotiation: ["handle_pressure", "adapt", "persuade"],
  presenting: ["deliver", "structure", "adapt"],
  persuasion: ["persuade", "structure", "adapt"],
  storytelling: ["structure", "deliver", "simplify"],
  asking_questions: ["think_fast", "adapt", "be_concise"],
};

/**
 * Pick N rep types for a workout session, weighted by the user's
 * improvement goals. Ensures variety (no two consecutive reps of the
 * same type). If the user has no goals set, picks randomly from all
 * nine types.
 *
 * `weakestDimensionBias` (optional) biases the pool toward rep types
 * that train the user's weakest dimension from their most recent
 * session — the Direction.md "Tomorrow's focus actually follows you
 * into tomorrow's workout" promise.
 */
export function pickRepTypes(opts: {
  goals?: readonly ImprovementGoalId[];
  count?: number;
  /** When set, rep types whose primary OR secondary dimensions include
   *  this dimension get a +2.0 weight boost. Typically sourced from the
   *  user's weakest trending dimension. */
  weakestDimensionBias?: import("@/types/domain").SkillDimension;
}): RepTypeId[] {
  const count = opts.count ?? 4;
  const goals = opts.goals ?? [];
  const bias = opts.weakestDimensionBias;

  // Build the weighted candidate pool
  const weighted = new Map<RepTypeId, number>();
  if (goals.length > 0) {
    for (const goal of goals) {
      for (const repType of GOAL_TO_REP_TYPES[goal]) {
        weighted.set(repType, (weighted.get(repType) ?? 0) + 1);
      }
    }
    // Give every rep type a minimum weight so rare picks still show up
    for (const rt of REP_TYPES) {
      if (!weighted.has(rt.id)) weighted.set(rt.id, 0.25);
    }
  } else {
    for (const rt of REP_TYPES) weighted.set(rt.id, 1);
  }

  // Tomorrow's-focus bias: nudge weights toward rep types that train
  // the user's weakest dimension. Primary match gets a bigger boost
  // than secondary so the planner prefers drills where the weak dim
  // is the main focus, not a side effect.
  if (bias) {
    for (const rt of REP_TYPES) {
      const current = weighted.get(rt.id) ?? 0.25;
      if (rt.primaryDimension === bias) {
        weighted.set(rt.id, current + 2);
      } else if (rt.secondaryDimensions.includes(bias)) {
        weighted.set(rt.id, current + 1);
      }
    }
  }

  // Weighted random sampling without replacement (variety first).
  // Shuffle by weight-biased random so higher-weighted items surface more.
  const candidates = Array.from(weighted.entries()).map(([id, w]) => ({
    id,
    // Weighted random key: higher weights produce smaller keys on
    // average, so ascending sort surfaces them first.
    key: Math.random() / w,
  }));
  candidates.sort((a, b) => a.key - b.key);

  const picked: RepTypeId[] = [];
  for (const { id } of candidates) {
    if (picked.length >= count) break;
    // Avoid consecutive duplicates
    if (picked[picked.length - 1] === id) continue;
    if (picked.includes(id)) continue;
    picked.push(id);
  }

  // Top up if constraints reduced the count (very rare)
  while (picked.length < count) {
    const remaining = REP_TYPES.filter((rt) => !picked.includes(rt.id));
    if (remaining.length === 0) break;
    const choice = remaining[Math.floor(Math.random() * remaining.length)]!;
    picked.push(choice.id);
  }

  return picked;
}
