import type { SkillDimension } from "@/types/domain";
import type { PressureArchetypeId } from "@/lib/ai/pressure-archetypes";

/**
 * Exemplar response bank — concrete model speech samples per dimension
 * and (optionally) pressure archetype. Surfaced via the "See example"
 * link on NextRepFocusCard so the user has a sound model in their ear
 * before the next rep, not just a rule.
 *
 * Authoring rules:
 *   - Lines are SPOKEN. They should sound like a person talking, not
 *     prose. Short. Land each sentence.
 *   - Every exemplar names a concrete scenario in `topic` so the user
 *     reads it as "here's how someone hits this in a real moment", not
 *     a generic abstract.
 *   - `tip` is one sentence on what to listen for — what makes this
 *     example actually train the dimension. Avoid "make sure to…" —
 *     use observable signals ("notice the pause after each beat").
 *   - Pressure exemplars include the mechanism in the lines (objection,
 *     pivot, recovery) so users hear the move, not just the structure.
 *
 * Selection priority (see `pickExemplar`):
 *   1. Exact (dimension, archetypeId) match
 *   2. Exact dimension match (no archetype)
 *   3. null (UI shows fallback "no exemplar yet" copy)
 */

export type Exemplar = {
  dimension: SkillDimension;
  archetypeId?: PressureArchetypeId;
  topic: string;
  /** Spoken lines, one per beat. Render with line breaks; user can scan
   *  vertically and "hear" the rhythm. */
  lines: string[];
  tip: string;
};

/** Curated bank. Each dimension has at least one general exemplar; some
 *  dimensions have archetype-tagged variants for the pressure surface. */
export const EXEMPLARS: readonly Exemplar[] = [
  // ——— Clarity ————————————————————————————————————————————————
  {
    dimension: "clarity",
    topic: "Explain how habits form to a beginner",
    lines: [
      "A habit is a behavior your brain has stopped thinking about.",
      "It started as a choice — every step deliberate.",
      "Repeat it enough, and your brain stops asking why and starts running it on autopilot.",
      "That's why small habits compound: they cost no willpower once they're locked in.",
    ],
    tip: "Notice each sentence does ONE thing — defines, contrasts, generalizes, lands. No padding between them.",
  },
  {
    dimension: "clarity",
    topic: "Explain a security breach to a non-technical CEO",
    lines: [
      "Here's what happened: an attacker got into our staging database for about four hours.",
      "What they accessed: customer email addresses and hashed passwords. No payment data, no plain-text passwords.",
      "What we did: rotated all credentials, forced a global reset, and started a forensic review.",
      "What's next: we tell affected customers tonight, before it leaks elsewhere.",
    ],
    tip: "Notice the four labeled beats — happened, accessed, did, next. The CEO can repeat it back without notes.",
  },

  // ——— Structure ——————————————————————————————————————————————
  {
    dimension: "structure",
    topic: "Argue why trust is the foundation of every relationship",
    lines: [
      "Trust is built on three things, in this order: consistency, honesty, follow-through.",
      "First, consistency. You show up the same way whether it's easy or hard.",
      "Second, honesty about what you don't know — not just what you do.",
      "Third, follow-through. Every kept commitment is a deposit; every broken one is a withdrawal.",
      "Consistency, honesty, follow-through. That's how trust gets built — in that order.",
    ],
    tip: "Listen for the hook restating verbatim at the end. Same words. That's what makes the structure stick.",
  },
  {
    dimension: "structure",
    topic: "Recommend a hire to leadership",
    lines: [
      "I'm recommending we hire Sam, and there are three reasons it's the right call.",
      "First, the technical bar: they cleared our hardest interview in two passes.",
      "Second, the team fit: every panelist independently flagged the same strength — calm under pressure.",
      "Third, the trajectory: they've been promoted twice in three years, both unprompted.",
      "Technical bar, team fit, trajectory. That's the case for Sam.",
    ],
    tip: "Watch how the sign-posts (\"first / second / third\") are followed by ONE sentence each, not three. The constraint is what makes structure feel sharp.",
  },

  // ——— Conciseness ——————————————————————————————————————————————
  {
    dimension: "conciseness",
    archetypeId: "time_compression",
    topic: "CEO asks why the launch is two weeks behind, 15 seconds",
    lines: [
      "Database migration ran 4x slower than benchmarks predicted.",
      "We caught it last Wednesday and rolled to a chunked migration.",
      "New ETA is two weeks out. Demo prep starts Monday.",
    ],
    tip: "No \"so basically,\" no \"the thing is.\" Each sentence is verb-first. Stop when the answer is done — silence is fine.",
  },
  {
    dimension: "conciseness",
    topic: "Pitch your product in 20 seconds",
    lines: [
      "We help mid-market sales teams close deals 30% faster by surfacing the next best action in their CRM.",
      "It plugs into Salesforce in under an hour and pays back in under three weeks on average.",
      "Customers replace two existing tools when they adopt us — that's where the ROI lives.",
    ],
    tip: "Each sentence is doing the work of three: what / how / why. No \"as a sales platform\" — get to the verb.",
  },

  // ——— Thinking Quality ————————————————————————————————————————
  {
    dimension: "thinking_quality",
    topic: "Should you take the promotion or the lateral?",
    lines: [
      "I'd take the lateral — and here's the reasoning, not just the gut.",
      "The promotion gets you a title bump and the same skill stack you already have.",
      "The lateral pulls you into a new domain where the next promotion has more leverage.",
      "Two years from now, the lateral version of you is more interesting to the market.",
      "So: short-term ego, long-term option value. Lateral.",
    ],
    tip: "The frame \"reasoning, not just the gut\" signals the structure. Each sentence is a beat in a real argument.",
  },
  {
    dimension: "thinking_quality",
    archetypeId: "clarifying_interrupt",
    topic: "Mid-pitch interrupt: \"That sounds like every other tool\"",
    lines: [
      "Fair — that's the right thing to push on.",
      "Here's where we're actually different: we're the only one that learns from the user's CRM data, not just generic playbooks.",
      "What that means in practice: in week one we surface deals you didn't know were stuck. Nobody else does that.",
      "Want me to show you with one of your real accounts?",
    ],
    tip: "Listen to the move: acknowledge → reframe → ground in specifics → ask. No defensiveness in the open.",
  },

  // ——— Delivery ————————————————————————————————————————————————
  {
    dimension: "delivery",
    topic: "Share a lesson you learned",
    lines: [
      "[Slow.] A few years ago I thought working harder was the only way to fix things.",
      "And I learned the hard way — [pause] — that working harder was often the thing making it worse. [pause]",
      "[Normal tempo.] I doubled my hours on a project that needed fewer meetings, not more effort.",
      "[Slow again.] Now, when I'm tired and pushing harder — that's the moment I stop. And subtract.",
    ],
    tip: "Read it aloud at a metronome. Notice how the bracketed cues map to actual rhythm changes — that's the dimension being trained.",
  },
  {
    dimension: "delivery",
    archetypeId: "stakes_raise",
    topic: "Board asks why you're the right CEO for what's next, 60 sec",
    lines: [
      "[Slow open.] I've spent five years getting this team to where it can ship without me in every meeting.",
      "What's next is harder. We're not optimizing — we're crossing into a market that's never seen us. [pause]",
      "I know I'm right for this for two reasons.",
      "First, I've done the unsexy work. The boring distribution wins this round, not the big bet. I've earned the trust to make those calls. [pause]",
      "Second, I've changed before. The CEO this team needed in year one isn't the one it needs in year five — and I've made that shift in front of you. [pause]",
      "[Slow close.] You're not betting on a static person. You're betting on a track record of evolving. That's the bet I think you should make.",
    ],
    tip: "Watch the cadence — open slow, accelerate through the case, slow again at the close. Every pause earns the listener's full attention for what comes next.",
  },

  // ——— Tone ————————————————————————————————————————————
  {
    dimension: "tone",
    archetypeId: "audience_switch",
    topic: "Explain AI to a designer, then to a researcher",
    lines: [
      "[To the designer:] AI isn't magic. It's pattern-matching on a huge pile of text. Useful in narrow ways — overhyped for the rest. Treat it like a junior collaborator: fast at drafts, bad at judgment.",
      "[Pivot:] Now to the researcher.",
      "[To the researcher:] The surprise here isn't intelligence — it's that a statistical predictor this big starts looking like reasoning. Whether it actually IS reasoning is the open question, and the empirical work to settle it is just beginning.",
    ],
    tip: "Same idea, two registers. Designer gets the metaphor; researcher gets the open question. Notice the explicit \"pivot\" line — it signals the switch out loud.",
  },
  {
    dimension: "tone",
    archetypeId: "pushback",
    topic: "Make the case for code reviews. Pushback: \"They just slow us down\"",
    lines: [
      "[Acknowledge.] You're right that reviews add latency. That's real, and we should keep an eye on it.",
      "[Redirect.] What I'd add is the latency we're saving on the back end. Every bug we catch in review is a bug that doesn't ship — and the cost of a shipped bug is 10x the time the review took.",
      "[Land.] So we're not slowing down. We're moving the slowdown earlier, where it's cheaper. That's the trade we want.",
    ],
    tip: "Every move named: acknowledge → redirect → land. The user can hear the move BEING made, not described.",
  },
  {
    dimension: "tone",
    topic: "Convince someone to start exercising regularly",
    lines: [
      "Look — I'm not going to sell you on the idea of exercise. You already know it's good.",
      "What I'll sell you on is the smallest version that actually works: 15 minutes, three times a week. That's it.",
      "Two weeks in, you'll feel it. Three months in, you'll wonder how you lived without it.",
      "Don't go for hard. Go for repeatable. The body changes after the fact.",
    ],
    tip: "The opening reframes the resistance — they don't have to argue against \"exercise is good.\" That's adaptive: meeting where they are.",
  },
];

/**
 * Pick the best exemplar for a (dimension, archetypeId) pair.
 *
 * Selection: archetype-specific match wins; falls back to dimension-only;
 * returns null when neither exists. UI surfaces a "no exemplar yet"
 * fallback copy when null.
 */
export function pickExemplar(opts: {
  dimension: SkillDimension;
  archetypeId?: PressureArchetypeId | null;
}): Exemplar | null {
  const { dimension, archetypeId } = opts;
  if (archetypeId) {
    const exact = EXEMPLARS.find(
      (e) => e.dimension === dimension && e.archetypeId === archetypeId,
    );
    if (exact) return exact;
  }
  const dimMatch = EXEMPLARS.find(
    (e) => e.dimension === dimension && e.archetypeId === undefined,
  );
  return dimMatch ?? null;
}
