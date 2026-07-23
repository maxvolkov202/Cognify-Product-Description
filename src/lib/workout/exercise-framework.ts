// Maps each exercise (and, as a fallback, each Core Skill dimension) to the
// rep-type framework that best scaffolds a strong response for it. Used by the
// Daily Workout AND Application Lab RepSurface to surface a "Suggested
// Framework" cheat-sheet ("a shape you can follow") alongside the prompt.
//
// Phase 5b — the per-dimension map alone was too coarse: every clarity drill
// got Feynman, every tone drill got "Audience A -> B", etc., so the suggested
// shape often didn't fit the actual exercise (e.g. a personal-decision prompt
// got the two-audience framework). We now map per EXERCISE SLUG to the
// best-fitting built-in framework, across the full catalog (Daily Workout +
// the six Application Lab apps + pressure), and keep the dimension map only as
// a fallback for unknown/unseeded slugs.
//
// The framework strip is display-only — it never reaches scoring — so this
// mapping has zero calibration impact.

import { REP_TYPES, type RepTypeFramework, type RepTypeId } from "@/lib/ai/rep-types";
import type { MuscleGroupId } from "@/types/domain";

const FRAMEWORK_BY_REP_TYPE: Record<RepTypeId, RepTypeFramework> =
  Object.fromEntries(REP_TYPES.map((rt) => [rt.id, rt.framework])) as Record<
    RepTypeId,
    RepTypeFramework
  >;

// Fallback when an exercise slug isn't in the map below (unseeded / new slug).
// Each dimension points at the framework whose shape most exercises in that
// dimension share.
//   clarity          -> simplify   (Feynman: Name it / Analogy / Why / Spot the gap)
//   structure        -> structure  (Main + 3 + Close)
//   conciseness      -> be_concise (BLUF)
//   thinking_quality -> think_fast (PREP: Point / Reason / Example / Point)
//   pacing           -> deliver    (Pause + Pace)
//   tone             -> deliver    (delivery/prosody is the common tone shape;
//                                   was `adapt`, which mis-fit most tone drills)
const DIMENSION_TO_REP_TYPE: Record<MuscleGroupId, RepTypeId> = {
  clarity: "simplify",
  structure: "structure",
  conciseness: "be_concise",
  thinking_quality: "think_fast",
  pacing: "deliver",
  tone: "deliver",
};

// Per-exercise framework, keyed by exercises.slug. Chosen so the suggested
// shape actually models a good answer to that drill. Covers the full seeded
// catalog; unknown slugs fall back to the dimension map above.
const EXERCISE_TO_REP_TYPE: Record<string, RepTypeId> = {
  // ── Daily Workout — clarity ─────────────────────────────────────────
  "answer-the-confusion": "simplify",
  "explain-like-im-12": "simplify",
  "headline-first": "be_concise",
  "make-it-real": "simplify",
  "no-jargon-allowed": "simplify",
  "one-point-only": "be_concise",
  "prove-it": "think_fast",
  "the-analogy-bridge": "simplify",
  "the-word-budget": "be_concise",

  // ── Daily Workout — conciseness ─────────────────────────────────────
  "cut-by-half": "be_concise",
  "kill-the-filler": "be_concise",
  "no-hedging": "be_concise",
  "no-throat-clearing": "be_concise",
  "one-idea-per-response": "be_concise",
  "subject-verb-object": "be_concise",
  "the-30-second-rule": "be_concise",
  "the-hard-stop": "be_concise",
  "the-single-sentence": "be_concise",

  // ── Daily Workout — pacing (all delivery/rhythm) ────────────────────
  "beat-the-buzzer": "deliver",
  metronome: "deliver",
  "punctuation-breathing": "deliver",
  "silence-over-filler": "deliver",
  "slow-cooker": "deliver",
  "strategic-pause": "deliver",
  "tempo-shift": "deliver",
  "the-speed-shift": "deliver",
  "the-stretch": "deliver",
  "two-beat-landing": "deliver",

  // ── Daily Workout — structure ───────────────────────────────────────
  "bottom-line-first": "be_concise",
  "compare-and-contrast": "structure",
  "monroes-motivated-sequence": "persuade",
  "question-then-answer": "structure",
  "signpost-first": "structure",
  "the-3-point-rule": "structure",
  "the-problem-solution-frame": "persuade",
  "the-story-arc": "structure",
  "two-then-one": "structure",

  // ── Daily Workout — thinking_quality ────────────────────────────────
  "disconfirm-yourself": "handle_pressure",
  "draw-the-line": "think_fast",
  "first-principles": "think_fast",
  "name-the-assumption": "think_fast",
  "order-of-magnitude": "think_fast",
  "the-claim-and-proof": "think_fast",
  "the-perspective-shift": "adapt",
  "the-so-what-test": "think_fast",
  "the-steel-man": "handle_pressure",

  // ── Daily Workout — tone ────────────────────────────────────────────
  "authority-voice": "deliver",
  "conviction-floor": "deliver",
  "curiosity-lift": "deliver",
  "downward-landing": "deliver",
  "pivot-tone": "adapt",
  "read-the-room": "adapt",
  "the-emotional-dial": "deliver",
  "the-monotone-breaker": "deliver",
  "the-resonance-rep": "deliver",
  "volume-dial": "deliver",
  "warmth-switch": "adapt",

  // ── Application Lab — Interviewing ──────────────────────────────────
  "why-this-why-you": "structure",
  "one-strength-one-proof": "think_fast",
  "the-unhedged-weakness": "be_concise",
  "the-composed-curveball": "handle_pressure",
  "the-failure-debrief": "structure",
  "across-the-table": "handle_pressure",
  "the-honest-why": "think_fast",
  "the-proof-point-answer": "think_fast",

  // ── Application Lab — Persuasion ────────────────────────────────────
  "evidence-on-a-budget": "be_concise",
  "the-unflinching-ask": "persuade",
  "build-the-case": "persuade",
  "decision-on-the-table": "persuade",
  "meet-the-pushback": "handle_pressure",
  "start-from-their-side": "persuade",
  "the-honest-sell": "persuade",
  "warm-steel": "persuade",

  // ── Application Lab — Presenting ────────────────────────────────────
  "audience-translation": "adapt",
  "concept-grounding": "simplify",
  "data-explanation": "simplify",
  "closing-summary": "be_concise",
  "problem-overview": "be_concise",
  "executive-update": "be_concise",
  "project-briefing": "structure",
  "recommendation-presentation": "persuade",

  // ── Application Lab — Pressure ──────────────────────────────────────
  "pressure-time-compression": "be_concise",
  "pressure-clarifying-interrupt": "handle_pressure",
  "pressure-pushback": "handle_pressure",
  "pressure-stakes-raise": "handle_pressure",
  "pressure-audience-switch": "adapt",

  // ── Application Lab — Storytelling ──────────────────────────────────
  "two-sides-one-scene": "adapt",
  "the-two-sentence-runway": "be_concise",
  "land-the-lesson": "structure",
  "the-hinge-moment": "structure",
  "make-it-theirs": "adapt",
  "the-honest-wreck": "structure",
  "the-stakes-opener": "structure",
  "where-it-began": "deliver",

  // ── Application Lab — Teaching ──────────────────────────────────────
  "borrow-their-world": "simplify",
  "earn-your-jargon": "simplify",
  "example-first": "reinforce",
  "start-where-they-are": "reinforce",
  "one-step-at-a-time": "reinforce",
  "dial-the-depth": "adapt",
  "replace-the-myth": "simplify",
  "why-it-matters": "think_fast",
};

/**
 * The suggested framework for an exercise. Prefers the per-exercise mapping
 * (best fit for the specific drill); falls back to the dimension default for
 * unknown slugs; returns undefined only when neither is resolvable.
 */
export function getFrameworkForExercise(
  slug: string | null | undefined,
  dim: MuscleGroupId | null | undefined,
): RepTypeFramework | undefined {
  if (slug) {
    const repType = EXERCISE_TO_REP_TYPE[slug];
    if (repType) return FRAMEWORK_BY_REP_TYPE[repType];
  }
  return getFrameworkForDimension(dim);
}

/** Dimension-level fallback (kept for callers that only know the dimension). */
export function getFrameworkForDimension(
  dim: MuscleGroupId | null | undefined,
): RepTypeFramework | undefined {
  if (!dim) return undefined;
  const repTypeId = DIMENSION_TO_REP_TYPE[dim];
  return repTypeId ? FRAMEWORK_BY_REP_TYPE[repTypeId] : undefined;
}
