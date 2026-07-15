/**
 * Delivery hints — short, actionable cues shown on the start-rep page.
 *
 * Cognify DNA Ch.6: every rep gets 1-2 hints sourced from the focus
 * dimension's sub-skills. Hints are neuroscience-backed, second-person,
 * imperative, ≤80 chars. They're meant to be applied DURING the rep, not
 * read after. Examples from DNA spec:
 *   - "Slow down on key points (improves processing + retention)"
 *   - "Use downward inflection to signal certainty"
 *
 * Sources cited in metadata for audit, NOT shown to user — UI surface is
 * clean. The source field lets us trace any hint back to a research
 * foundation (Cognitive Load Theory, prosody studies, etc.) when we
 * tune the bank.
 *
 * Stratification (see pickHintsForRep): a user shouldn't see the same
 * hint twice in a session. The selector tracks shown hints in session
 * storage and prefers unseen ones.
 */

import type { SubSkillId } from "@/types/sub-skills";

export type Hint = {
  /** Display text. ≤80 chars, second-person imperative, no period. */
  text: string;
  /** Source citation for audit. Not shown to user. */
  source?: string;
};

/**
 * 2-4 hints per covered sub-skill. Partial by design under Taxonomy v2
 * (148 skills, D20): the bank covers the historically-drilled skills;
 * uncovered skills simply contribute no hints (the selector's
 * `HINTS[subSkill] ?? []` already handles absence). The selector reads
 * `HINTS[subSkill]` and picks one stratified by session history.
 *
 * Authoring rules (re-applied across the whole bank):
 *   - second-person, present-tense, imperative
 *   - ≤80 chars
 *   - actionable DURING the rep (not "be confident" — "land statements
 *     with downward pitch")
 *   - cite the source when there's a real one (Cognitive Load Theory,
 *     prosody research, etc.); leave source absent for craft heuristics
 */
export const HINTS: Partial<Record<SubSkillId, readonly Hint[]>> = {
  // ——— Clarity ———————————————————————————————————————————
  vocabulary_precision: [
    {
      text: "Pick the simplest word that holds the meaning",
      source: "Cognitive Load Theory (Sweller, 1988)",
    },
    { text: "Cut every noun ending in -tion that has a verb form" },
    { text: "If a kid would ask what it means, find a different word" },
  ],
  concreteness: [
    {
      text: "Replace one abstract noun with a concrete example",
      source: "Pinker, The Sense of Style — anti-Curse-of-Knowledge",
    },
    { text: "Name a person, a number, or a moment in your first sentence" },
    { text: "Show, don't categorize — give the example before the label" },
  ],
  audience_calibration: [
    {
      text: "Re-anchor every minute: would they understand this?",
      source: "Audience Design (Clark & Murphy, 1982)",
    },
    { text: "Strip every acronym they wouldn't say at lunch" },
    { text: "Open with what they care about, not what you want to tell them" },
  ],
  idea_isolation: [
    {
      text: "One idea per sentence. Land it before adding a second",
      source: "Protégé Effect (Nestojko et al., 2014)",
    },
    { text: "If you say 'and' three times in a row, split the sentence" },
  ],
  lexical_specificity: [
    { text: "Replace 'thing' with what the thing actually is" },
    { text: "Resolve every 'it' to a noun the listener can point at" },
    { text: "Numbers beat adjectives — '40%' lands; 'a lot' doesn't" },
  ],
  listener_first_sequencing: [
    { text: "State the conclusion before the build-up" },
    { text: "Order: cause, then effect — never the other way around" },
  ],
  // ——— Structure ————————————————————————————————————————
  opening_hook: [
    {
      text: "First sentence carries the headline — no warm-up",
      source: "BLUF — US Military doctrine",
    },
    { text: "Cut the throat-clear: skip 'so', 'okay', 'I think'" },
    { text: "Open with the answer; the question is implied" },
  ],
  signposting: [
    { text: "Say 'three things' — then deliver three" },
    { text: "Use 'first / second / finally' as audible scaffolding" },
    { text: "Name the transition: 'now, the harder one' beats no signal" },
  ],
  argument_hierarchy: [
    {
      text: "Lead with the strongest point — primacy boosts retention",
      source: "Primacy & Recency (Murdock, 1962)",
    },
    { text: "Spend 60% on the headline, 40% on the supporting cast" },
  ],
  bottom_line_discipline: [
    {
      text: "Bottom line up front — restate it at the close",
      source: "BLUF — US Military doctrine",
    },
    { text: "If you stop after 10 seconds, the listener has the answer" },
  ],
  narrative_arc: [
    {
      text: "Open with tension — payoff lands harder when something is at stake",
      source: "Narrative Transportation (Green & Brock, 2000)",
    },
    { text: "Three beats: setup, complication, resolution" },
  ],
  coherence: [
    { text: "Every sentence connects to the one before it" },
    { text: "Mid-rep check: did this point earn its place in the arc?" },
  ],
  // ——— Conciseness ————————————————————————————————————————
  filler_reduction: [
    {
      text: "Replace 'um' and 'like' with a one-second pause",
      source: "Quantified Communications — fewer fillers = 33% more persuasive",
    },
    { text: "Silence is more authoritative than filler" },
  ],
  hedging_control: [
    { text: "Cut 'I think' and 'kind of' — say it as a fact" },
    { text: "If you'd defend it, drop the qualifier" },
  ],
  repetition_control: [
    { text: "Say it once. Trust it landed" },
    { text: "If you find yourself restating, you doubted the first version" },
  ],
  response_scoping: [
    {
      text: "Stop when the point is made, not when the time runs out",
      source: "Grice's Maxim of Quantity (1975)",
    },
    { text: "Last sentence is the strongest, not an apology" },
  ],
  real_time_editing: [
    { text: "If a sentence drifts, end it and start the next one cleanly" },
    { text: "Cut adjectives. Verbs and nouns carry meaning" },
  ],
  // ——— Thinking Quality ——————————————————————————————————
  claim_support: [
    { text: "Every claim gets a reason in the next sentence" },
    { text: "Use 'because' once per minute — it forces support" },
  ],
  first_principles_reasoning: [
    {
      text: "Strip the assumption — what would the data say?",
      source: "First Principles Thinking (Descartes; modern: Musk)",
    },
    { text: "Ask 'is that actually true?' to the strongest premise" },
  ],
  counterargument_awareness: [
    {
      text: "Pre-empt one objection — the strongest one",
      source: "Steelmanning (Argumentation Theory)",
    },
    { text: "Say 'the case against this is...' before someone else does" },
  ],
  depth_of_analysis: [
    { text: "Move past 'what' — answer 'why' and 'so what'" },
    { text: "Add one layer below the obvious" },
  ],
  intellectual_honesty: [
    { text: "Name what you don't know before someone asks" },
    { text: "Calibrate certainty: 'I'm confident' vs 'I think' vs 'I'd guess'" },
  ],
  perspective_taking: [
    {
      text: "State the strongest version of the other side first",
      source: "Steelmanning",
    },
    { text: "What would your harshest critic say to this?" },
  ],
  // ——— Delivery ——————————————————————————————————————————
  rate_awareness: [
    {
      text: "Aim for 150-160 words per minute — your most retainable rate",
      source: "National Center for Voice & Speech / Griffiths (1990)",
    },
    { text: "Slow down on the headline; speed up through the support" },
  ],
  strategic_pausing: [
    {
      text: "Two-second pause after the key point — let the brain encode it",
      source: "Cognitive Bookmark Effect — working memory research",
    },
    { text: "Pause is not dead air — it's the listener catching up" },
  ],
  filler_to_pause_substitution: [
    {
      text: "Pause instead of 'um' — silence reads as authority",
      source: "Duvall et al. (2014), Journal of Nonverbal Behavior",
    },
    { text: "Aim for 1 filler per minute — most speakers run 5+" },
  ],
  rhythm_variation: [
    { text: "Vary tempo between points — flat tempo loses attention" },
    { text: "Slow on the verbs that matter; quick through the connectors" },
  ],
  pressure_pacing: [
    { text: "Inhale through the nose before answering — resets the voice" },
    { text: "First three words at half-speed — buys composure" },
  ],
  // ——— Tone ——————————————————————————————————————————————
  prosodic_alignment: [
    {
      text: "Vary pitch by ≥3 semitones across the response",
      source: "Baker & McGowan (2013) — variety = +30% engagement",
    },
    { text: "Avoid the flat-line — change pitch when changing thoughts" },
  ],
  emphasis_timing: [
    { text: "Raise volume on the verb that carries the meaning" },
    { text: "Drop volume on the connector words; lift on the claims" },
  ],
  confidence: [
    {
      text: "Land statements with downward pitch — signals conviction",
      source: "Paralinguistics — upspeak undercuts authority",
    },
    { text: "If it's a fact, end it on a falling note" },
    { text: "Test the close: would it sound right at a podium?" },
  ],
  emotional_authenticity: [
    { text: "Let the content's weight come through your voice" },
    { text: "If it's serious, sound serious — match the stakes" },
  ],
  gravitas: [
    {
      text: "Project from the chest, not the throat",
      source: "Patsy Rodenburg, The Right to Speak — second circle",
    },
    { text: "Hold the energy through the last word" },
  ],
  warmth: [
    { text: "Smile on the open — listeners hear it" },
    { text: "Acknowledge the listener before pushing the point" },
  ],
};
