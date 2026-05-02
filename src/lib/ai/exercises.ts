/**
 * Cognify Ch.16 — Named exercise catalog.
 *
 * 18 exercises across the 6 dimensions (3 per dim). Each exercise has
 * a name, tagline, description, and the sub-skills it targets. Used to
 * replace anonymous prompt IDs (e.g. "drill cl_io_003") with branded
 * curriculum names ("today's exercise is the Explain-Like-I'm-12 drill")
 * — pedagogy polish that makes the training feel curated rather than
 * randomized.
 *
 * Catalog-only in this ship — the consumer-side wiring (tagging
 * individual DrillPrompts / rep types with exerciseId so the Skill Lab
 * UI can surface "today's exercise") happens via the dim → primary
 * exercise lookup `primaryExerciseFor(dim)`. Per-prompt tagging is a
 * follow-up once the drill-bank UI consumer lands.
 */

import type { SkillDimension } from "@/types/domain";
import type { SubSkillId } from "@/types/sub-skills";

export type ExerciseId =
  // Clarity
  | "explain_like_im_12"
  | "one_idea_only"
  | "concrete_swap"
  // Structure
  | "bluf"
  | "three_act_close"
  | "signpost_rep"
  // Conciseness
  | "half_the_words"
  | "filler_diet"
  | "no_hedge_minute"
  // Thinking Quality
  | "claim_then_proof"
  | "steel_man"
  | "second_order_why"
  // Delivery
  | "pause_punctuation"
  | "metronome_rep"
  | "pressure_close"
  // Tone
  | "conviction_close"
  | "pitch_ladder"
  | "warmth_open";

export type Exercise = {
  readonly id: ExerciseId;
  readonly name: string;
  /** Short hook (≤60 chars) shown next to the name in the UI. */
  readonly tagline: string;
  /** 1-2 sentence description rendered in tooltips / drill-in pages. */
  readonly description: string;
  /** Which sub-skills this exercise primarily trains. Drives drill
   *  selection bias and per-exercise progression tracking. */
  readonly targetSubSkills: readonly SubSkillId[];
  /** The dimension this exercise lives under. Single dim per exercise
   *  in v1 — cross-dim drills are out of scope. */
  readonly dimension: SkillDimension;
};

export const EXERCISES: Record<ExerciseId, Exercise> = {
  // ——— Clarity ———————————————————————————————————————————
  explain_like_im_12: {
    id: "explain_like_im_12",
    name: "Explain Like I'm 12",
    tagline: "Strip the jargon, name a concrete picture.",
    description:
      "Take any concept and explain it to a smart 12-year-old. Forces concrete language, audience-appropriate vocabulary, and clean pronoun resolution.",
    targetSubSkills: ["audience_awareness", "word_choice"],
    dimension: "clarity",
  },
  one_idea_only: {
    id: "one_idea_only",
    name: "One Idea Only",
    tagline: "Land one thing — no second thoughts allowed.",
    description:
      "Give a 60-second answer that contains exactly one idea. Anytime you start to introduce a second, redirect back to the first.",
    targetSubSkills: ["idea_isolation", "logical_sequencing"],
    dimension: "clarity",
  },
  concrete_swap: {
    id: "concrete_swap",
    name: "Concrete Swap",
    tagline: "Every abstract noun gets a real example.",
    description:
      "Whenever you say an abstract noun (innovation, alignment, growth), follow it within one sentence with a specific concrete example.",
    targetSubSkills: ["concreteness", "precision"],
    dimension: "clarity",
  },

  // ——— Structure ——————————————————————————————————————————
  bluf: {
    id: "bluf",
    name: "BLUF",
    tagline: "Bottom Line Up Front. Lead with the punchline.",
    description:
      "First sentence is the bottom line — the conclusion or recommendation. Everything after is support. No setup, no warm-up.",
    targetSubSkills: ["bottom_line_discipline", "opening_hook"],
    dimension: "structure",
  },
  three_act_close: {
    id: "three_act_close",
    name: "Three-Act Close",
    tagline: "Open. Develop. Land. In that order.",
    description:
      "Hit three explicit beats: a direction-setting opening, a developed middle with at least two transitions, and a definitive close that restates the main point.",
    targetSubSkills: ["narrative_arc", "coherence"],
    dimension: "structure",
  },
  signpost_rep: {
    id: "signpost_rep",
    name: "Signpost Rep",
    tagline: "Three transitions, every one named.",
    description:
      "Use at least three explicit transition phrases (first / second / however / therefore / in summary). The listener should never guess where you're going next.",
    targetSubSkills: ["signposting", "argument_hierarchy"],
    dimension: "structure",
  },

  // ——— Conciseness ————————————————————————————————————————
  half_the_words: {
    id: "half_the_words",
    name: "Half the Words",
    tagline: "Same point. Half the runtime.",
    description:
      "Take a topic you'd normally talk about for 60 seconds. Land it in 30. Cut anything that doesn't move the argument.",
    targetSubSkills: ["response_scoping", "editing_in_real_time"],
    dimension: "conciseness",
  },
  filler_diet: {
    id: "filler_diet",
    name: "Filler Diet",
    tagline: "Zero ums, zero likes, for the whole rep.",
    description:
      "60 seconds with no fillers — no um, uh, like, you know, basically. Pause silently instead. Repetition rewires the reflex.",
    targetSubSkills: ["filler_elimination"],
    dimension: "conciseness",
  },
  no_hedge_minute: {
    id: "no_hedge_minute",
    name: "No-Hedge Minute",
    tagline: "Drop the I think / I guess / kind of.",
    description:
      "60 seconds with no hedge words — no I think, I guess, kind of, sort of, maybe. State claims directly. Repetition trains conviction.",
    targetSubSkills: ["hedging_awareness"],
    dimension: "conciseness",
  },

  // ——— Thinking Quality ——————————————————————————————————
  claim_then_proof: {
    id: "claim_then_proof",
    name: "Claim Then Proof",
    tagline: "Every claim ships with a number or example.",
    description:
      "Make a claim — then in the next sentence cite a number, a specific example, or a study. Repeat for every assertion. No naked claims allowed.",
    targetSubSkills: ["claim_support"],
    dimension: "thinking_quality",
  },
  steel_man: {
    id: "steel_man",
    name: "Steel Man",
    tagline: "Argue the strongest version of the other side first.",
    description:
      "Before stating your view, voice the most compelling counterargument. Then explain why your position still holds — or revise it on the fly.",
    targetSubSkills: ["counterargument_awareness", "perspective_taking"],
    dimension: "thinking_quality",
  },
  second_order_why: {
    id: "second_order_why",
    name: "Second-Order Why",
    tagline: "Don't stop at the first reason. Ask why again.",
    description:
      "Make a claim, give the obvious reason, then ask 'and why does that matter?' — answer that. Forces depth past the surface answer.",
    targetSubSkills: ["depth_of_analysis", "first_principles_reasoning"],
    dimension: "thinking_quality",
  },

  // ——— Delivery ——————————————————————————————————————————
  pause_punctuation: {
    id: "pause_punctuation",
    name: "Pause Punctuation",
    tagline: "Land a 1-second pause after every key point.",
    description:
      "After every important sentence, hold silence for a full second. Lets the listener absorb and signals confidence. The hardest part is not filling the pause.",
    targetSubSkills: ["strategic_pausing", "rhythm_variation"],
    dimension: "delivery",
  },
  metronome_rep: {
    id: "metronome_rep",
    name: "Metronome Rep",
    tagline: "Hold 150 wpm across the whole minute.",
    description:
      "Aim for steady 150-160 wpm from sentence one to the close. No rushing into the final quartile. Practice the discipline of even pace under pressure.",
    targetSubSkills: ["rate_awareness", "rhythm_variation"],
    dimension: "delivery",
  },
  pressure_close: {
    id: "pressure_close",
    name: "Pressure Close",
    tagline: "Last 10 seconds: rate steady, voice grounded.",
    description:
      "Many speakers rush or trail off in the final quartile. This drill targets the close — same WPM as the open, voice landing fully on the last word.",
    targetSubSkills: ["pressure_management", "filler_word_control"],
    dimension: "delivery",
  },

  // ——— Tone ———————————————————————————————————————————————
  conviction_close: {
    id: "conviction_close",
    name: "Conviction Close",
    tagline: "Every statement ends with downward pitch.",
    description:
      "Train the muscle that signals certainty: pitch drops on the final syllable of every declarative sentence. The opposite of upspeak.",
    targetSubSkills: ["downward_inflection", "vocal_presence"],
    dimension: "tone",
  },
  pitch_ladder: {
    id: "pitch_ladder",
    name: "Pitch Ladder",
    tagline: "Three intentional pitch shifts per minute.",
    description:
      "Mark at least three sentences where you intentionally vary pitch — go higher to flag a question, lower to land a verdict. Builds the variation muscle that monotone speakers lack.",
    targetSubSkills: ["pitch_variation", "emotional_authenticity"],
    dimension: "tone",
  },
  warmth_open: {
    id: "warmth_open",
    name: "Warmth Open",
    tagline: "First sentence: warm, present, audience-aware.",
    description:
      "Open with a sentence that explicitly acknowledges the listener — by name, by context, or by stake. Trains warmth without losing the directness of a conviction-led close.",
    targetSubSkills: ["warmth", "emotional_authenticity"],
    dimension: "tone",
  },
};

/** Flat list — useful for catalog rendering + iteration. */
export const ALL_EXERCISES: readonly Exercise[] = Object.values(EXERCISES);

/** Group exercises by their dimension. */
export const EXERCISES_BY_DIMENSION: Record<
  SkillDimension,
  readonly Exercise[]
> = {
  clarity: [
    EXERCISES.explain_like_im_12,
    EXERCISES.one_idea_only,
    EXERCISES.concrete_swap,
  ],
  structure: [
    EXERCISES.bluf,
    EXERCISES.three_act_close,
    EXERCISES.signpost_rep,
  ],
  conciseness: [
    EXERCISES.half_the_words,
    EXERCISES.filler_diet,
    EXERCISES.no_hedge_minute,
  ],
  thinking_quality: [
    EXERCISES.claim_then_proof,
    EXERCISES.steel_man,
    EXERCISES.second_order_why,
  ],
  delivery: [
    EXERCISES.pause_punctuation,
    EXERCISES.metronome_rep,
    EXERCISES.pressure_close,
  ],
  tone: [
    EXERCISES.conviction_close,
    EXERCISES.pitch_ladder,
    EXERCISES.warmth_open,
  ],
};

/**
 * Pick the primary exercise for a given dimension. Today returns the
 * first exercise in the list — a deterministic default. When per-prompt
 * exerciseId tagging lands (Ch.16 follow-up), this becomes "the
 * exercise that owns the picked drill prompt." Optionally biased by
 * `preferSubSkill` so we surface the exercise that targets the user's
 * weakest sub-skill within the dimension when that data is available.
 */
export function primaryExerciseFor(
  dimension: SkillDimension,
  preferSubSkill?: SubSkillId,
): Exercise {
  const dimExercises = EXERCISES_BY_DIMENSION[dimension];
  if (preferSubSkill) {
    const targeted = dimExercises.find((ex) =>
      ex.targetSubSkills.includes(preferSubSkill),
    );
    if (targeted) return targeted;
  }
  return dimExercises[0]!;
}

/** Look up an exercise by id, returning undefined when the id is
 *  unknown (e.g. a stale persisted reference after a rename). */
export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES[id as ExerciseId];
}
