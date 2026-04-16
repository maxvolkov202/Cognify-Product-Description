import type { RepTypeFramework, RepTypeId } from "./rep-types";

/**
 * Alternate frameworks per rep type — the rotation pool.
 *
 * Team ask (Wave 7): "Add the different speech structure rotations to the
 * daily reps." Each rep type has a primary framework colocated in
 * rep-types.ts plus one or more alternates here. The workout planner rotates
 * across the full pool so a returning user doesn't see the same scaffold
 * every day.
 *
 * Curation rules:
 *   - Alternate frameworks must still train the rep type's primary dimension
 *   - Section count stays 3–5 (matches the primary's UX affordances)
 *   - Each section has a curated `example` so "See example" still works
 *   - The `exampleScenario` points at a different prompt from the primary's
 *     so users building the same shape with the same example feels less stale
 *
 * Wave 7 ships 1 alternate per rep type (9 new frameworks). Wave 8+ can
 * extend — the data type already accepts `readonly RepTypeFramework[]`.
 */
export const FRAMEWORK_VARIANTS: Record<
  RepTypeId,
  readonly RepTypeFramework[]
> = {
  simplify: [
    {
      name: "Concept → Example → Check",
      exampleScenario: "Explain how vaccines work",
      sections: [
        {
          label: "Concept",
          hint: "State what the thing is, in one sentence, plain words.",
          example:
            "A vaccine is a practice round for your immune system — a safe version of a germ that teaches it to recognize the real thing.",
        },
        {
          label: "Example",
          hint: "One short, concrete example that makes the concept click.",
          example:
            "Flu shots contain pieces of flu virus that can't hurt you; your body learns them, so when real flu arrives it's already trained.",
        },
        {
          label: "Why it works",
          hint: "Tie it to a mechanism anyone can picture.",
          example:
            "Your immune system has memory cells — once they've met something, they respond fast. Vaccines are how you install those memories on purpose.",
        },
        {
          label: "Check",
          hint: "Signal you've simplified: name the next-level detail you skipped.",
          example:
            "I'm skipping how different vaccine types work — live, inactivated, mRNA — because the core idea is the same: practice rounds.",
        },
      ],
    },
  ],
  structure: [
    {
      name: "Situation · Complication · Question · Answer",
      exampleScenario: "What makes a meeting productive?",
      sections: [
        {
          label: "Situation",
          hint: "Ground the listener in the shared context. No surprises yet.",
          example:
            "Most teams run four hours of meetings a day — sometimes more.",
        },
        {
          label: "Complication",
          hint: "Introduce the tension. Why the situation isn't fine.",
          example:
            "And most of those meetings produce no decisions and no owners — pure status theater.",
        },
        {
          label: "Question",
          hint: "Name the implicit question on the listener's mind.",
          example:
            "So what actually separates a productive meeting from a wasted one?",
        },
        {
          label: "Answer",
          hint: "Your thesis, crisp. One verb-driven sentence.",
          example:
            "Every productive meeting ends with one decision, one owner, and one deadline — anything less should've been a memo.",
        },
      ],
    },
  ],
  think_fast: [
    {
      name: "Assertion → Data → Resolution",
      exampleScenario: "Should you trust your gut or the data?",
      sections: [
        {
          label: "Assertion",
          hint: "Take a side in the first sentence. No fence-sitting.",
          example:
            "You should trust data for the decision and your gut for the speed of the decision.",
        },
        {
          label: "Data",
          hint: "One fact, number, or recognizable pattern that backs you up.",
          example:
            "Pattern-recognition gets faster with reps, but studies on expert judgment keep showing it's biased unless checked against evidence.",
        },
        {
          label: "Resolution",
          hint: "Land the implication. What should the listener do differently?",
          example:
            "So: make decisions in the time the gut gives you, but make the call on what the data says.",
        },
      ],
    },
  ],
  be_concise: [
    {
      name: "Claim · Evidence · Impact",
      exampleScenario: "Explain why consistency beats intensity in 20 seconds",
      sections: [
        {
          label: "Claim",
          hint: "State the claim. Verb up front, no qualifier.",
          example:
            "Consistency beats intensity because compounding beats bursts.",
        },
        {
          label: "Evidence",
          hint: "One number, one comparison. That's it.",
          example:
            "Thirty minutes a day outperforms four-hour marathons once a week — same total, ten times the retention.",
        },
        {
          label: "Impact",
          hint: "What changes for the listener if they believe you.",
          example:
            "Stop trying to go hard on weekends. Go medium, every day.",
        },
      ],
    },
  ],
  reinforce: [
    {
      name: "Past · Present · Future",
      exampleScenario: "Explain how to get better at listening",
      sections: [
        {
          label: "Past",
          hint: "Name the default behavior — what listeners usually do wrong.",
          example:
            "Most people listen to reply — they're composing their next sentence while the other person is still talking.",
        },
        {
          label: "Present",
          hint: "Describe the shift. One concrete swap, not five.",
          example:
            "The move is to wait two beats after they stop. Just two. Don't fill it.",
        },
        {
          label: "Future",
          hint: "What the habit unlocks when it sticks.",
          example:
            "Those two beats turn into better questions, which turn into people telling you things no one else heard.",
        },
      ],
    },
  ],
  persuade: [
    {
      name: "Attention · Interest · Desire · Action",
      exampleScenario: "Convince someone to start a side project",
      sections: [
        {
          label: "Attention",
          hint: "Open with something that stops the scroll — a question, a stat, a claim.",
          example:
            "Your best career move in the next six months probably isn't at your job.",
        },
        {
          label: "Interest",
          hint: "Why should they care? Tie it to them, not you.",
          example:
            "A small side project is the one place you get to pick the constraints, the tools, and the definition of done — three things your day job doesn't give you.",
        },
        {
          label: "Desire",
          hint: "Paint what they get. Specific, not vague.",
          example:
            "In three months you've got a portfolio piece, a story for interviews, and a skill your current team didn't teach you.",
        },
        {
          label: "Action",
          hint: "One concrete next step. A time, a commitment, a small yes.",
          example:
            "This weekend. Two hours. Just pick the thing — don't start building yet.",
        },
      ],
    },
  ],
  adapt: [
    {
      name: "Shared ground · Divergence · Landing",
      exampleScenario: "Explain leadership to an intern, then to a CEO",
      sections: [
        {
          label: "Shared ground",
          hint: "Start with what's true regardless of audience. The common core.",
          example:
            "Leadership is mostly about where you spend your attention — both audiences know that, even if they'd word it differently.",
        },
        {
          label: "Divergence",
          hint: "Two short reframings. One line each. Adjust vocabulary, not content.",
          example:
            "For the intern: it's noticing who's stuck and asking what would unblock them. For the CEO: it's pattern-matching which bets need your air cover this week.",
        },
        {
          label: "Landing",
          hint: "Tie back to the shared ground so both audiences walk out aligned.",
          example:
            "Same job — watch where attention is going, move it to where the leverage is.",
        },
      ],
    },
  ],
  deliver: [
    {
      name: "Set · Strike · Settle",
      exampleScenario: "Give advice with pauses after each point",
      sections: [
        {
          label: "Set",
          hint: "Open slow and grounded. Establish the frame before the payload.",
          example:
            "[Slow, deliberate.] I want to give you one piece of advice — the one I actually would have needed five years ago.",
        },
        {
          label: "Strike",
          hint: "Deliver the core line at normal pace, then pause. Let it land.",
          example:
            "Stop trying to be impressive. [two-beat pause] Try to be useful.",
        },
        {
          label: "Settle",
          hint: "Slow down again to close. Resolve the tension you just created.",
          example:
            "[Slower.] Impressive is brittle — it costs you when you're tired. Useful compounds. Useful outlasts the mood.",
        },
      ],
    },
  ],
  handle_pressure: [
    {
      name: "Mirror · Reframe · Close",
      exampleScenario:
        "You're suggesting writing things down. Someone says: 'I remember everything.'",
      sections: [
        {
          label: "Mirror",
          hint: "Repeat the strongest part of their objection back to them. Fairly.",
          example:
            "You're right — for people whose work fits in their head, writing things down can feel like overhead.",
        },
        {
          label: "Reframe",
          hint: "Shift the frame. What dimension are they missing?",
          example:
            "The part writing fixes isn't memory, though — it's recall speed. Written notes get you to the right answer two seconds faster, every time, for years.",
        },
        {
          label: "Close",
          hint: "Reassert your position with the reframe attached. End flat.",
          example:
            "So I'd still write things down — not because you'll forget, but because future-you will move faster.",
        },
      ],
    },
  ],
};

/**
 * Get the full framework pool for a rep type — primary (from rep-types.ts)
 * plus all alternates here. Callers that want to weight or filter the pool
 * (e.g., "no framework used in the last 3 reps") can do so over this array.
 */
export function getFrameworkPool(
  primary: RepTypeFramework,
  repTypeId: RepTypeId,
): readonly RepTypeFramework[] {
  const alternates = FRAMEWORK_VARIANTS[repTypeId];
  return [primary, ...alternates];
}
