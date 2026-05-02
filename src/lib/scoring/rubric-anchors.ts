/**
 * Cognify Ch.13 — Per-dimension band anchors for the score prompt.
 *
 * 30 anchored statements (6 dimensions × 5 score bands) that give the
 * LLM concrete reference points for "what an X-band response looks
 * like in dimension Y." The score prompt's RUBRIC block (when
 * FF_BAND_ANCHORS is on) interleaves these into the per-dimension
 * sections so Claude can pick the band first and then place the score
 * within the band's range.
 *
 * Why 5 bands here vs the 6 in `BAND_DEFINITIONS`:
 *  - User-facing display uses 6 bands (Poor / Below Standard /
 *    Competent / Strong / Excellent / Exceptional) — the granularity
 *    that helps users read a number.
 *  - Scoring guidance uses 5 bands (1-20 / 21-40 / 41-60 / 61-80 /
 *    81-100) — collapses Excellent + Exceptional into one anchor
 *    because the rubric difference between an 85 and a 95 is "rarer +
 *    more polish" rather than a categorically different shape.
 *  - The two systems share `BAND_DEFINITIONS.min` thresholds at the
 *    boundary points (40 / 60 / 80) so the user-visible band and the
 *    LLM's scoring band stay in sync.
 *
 * Source: Cognify DNA spec §"Scoring Rubrics", consolidated against
 * `DIMENSION_RUBRIC.lowScoreSignals` / `highScoreSignals` so the
 * anchors stay coherent with the existing per-dim rubric.
 */

import type { SkillDimension } from "@/types/domain";

export type RubricBandRange = {
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound. Mutually exclusive with the next band's min. */
  max: number;
  /** Short label rendered into the prompt. */
  label: string;
  /** Concrete description of "what an X-band response looks like in
   *  this dimension." Used by the LLM to anchor the placement. */
  anchor: string;
};

export const BAND_RANGES: readonly Pick<
  RubricBandRange,
  "min" | "max" | "label"
>[] = [
  { min: 0, max: 20, label: "1-20" },
  { min: 21, max: 40, label: "21-40" },
  { min: 41, max: 60, label: "41-60" },
  { min: 61, max: 80, label: "61-80" },
  { min: 81, max: 100, label: "81-100" },
];

/** Per-dim, per-band anchor strings. Authored to be calibrated against
 *  the reference-rep bank — a reference rep at composite 85 should
 *  match the 81-100 anchor for each dim it scored 85+ on. */
export const RUBRIC_ANCHORS: Record<SkillDimension, readonly string[]> = {
  clarity: [
    // 1-20
    "Listener cannot follow. Pronouns float without referents, jargon stacks, the main point never arrives in any locatable form.",
    // 21-40
    "Listener can guess at the point but works for it. Heavy abstract language, missing concrete examples, audience-mismatched vocabulary throughout.",
    // 41-60
    "Point is locatable but late. One or two pronouns or jargon terms make the listener back-track to follow the thread.",
    // 61-80
    "Point lands first time. Concrete language, audience-appropriate vocabulary, pronouns resolve. Minor abstraction without grounding may still appear.",
    // 81-100
    "Crystalline. Every sentence is concrete, every reference resolves, the main point is locatable in the first 10 seconds.",
  ],
  structure: [
    // 1-20
    "No visible scaffolding. Topic jumps without connective tissue, no opening, no close.",
    // 21-40
    "Random ordering with maybe one transition. The shape of the response is opaque to the listener.",
    // 41-60
    "Some structure visible but the close is missing or the middle wanders. Opening establishes direction.",
    // 61-80
    "Clear opening, logical body, recognizable close. A few transitions could be sharper but the arc is intact.",
    // 81-100
    "Visible scaffolding end-to-end — opening sets direction, body is sequenced (chronological / causal / importance), close lands the main point.",
  ],
  conciseness: [
    // 1-20
    "High filler density, hedge-stacking, ideas restated without progress. Words far exceed signal.",
    // 21-40
    "Filler rate above 4/min, repeated points, long preambles. Time budget routinely missed by >20%.",
    // 41-60
    "Some filler but each sentence advances the argument. Within 20% of time budget.",
    // 61-80
    "Tight word economy. Filler under 2/min, no idea repetition, finishes within 10% of budget.",
    // 81-100
    "Maximum signal per word. Every sentence advances. No hedge stacking, no filler that the listener registers.",
  ],
  thinking_quality: [
    // 1-20
    "Surface-level restatement of the prompt. No reasoning chain, no support, no engagement with complexity.",
    // 21-40
    "Claims appear but float — assertions without 'because.' Counterarguments ignored. Reasoning stops at the first answer.",
    // 41-60
    "Most claims have some support; reasoning addresses the prompt but stops at the surface. The 'why' is implicit, not stated.",
    // 61-80
    "Every major claim is supported by reason, example, or evidence. Reasoning addresses 'why' and 'so what' — not just 'what'.",
    // 81-100
    "Engages the deep 'why.' Acknowledges complexity, addresses counterarguments, goes beyond the predictable first answer.",
  ],
  delivery: [
    // 1-20
    "Speech rate well outside 130-170 wpm. Filler rate above 5/min. Random or absent pauses. Significantly over or under time.",
    // 21-40
    "Pacing wobbles inside vs outside the optimal range. High filler. Pauses absent or unintentional.",
    // 41-60
    "WPM in the 140-170 range most of the time. Filler under 4/min. Some intentional pauses but rhythm is uneven.",
    // 61-80
    "Stable WPM around 150-160. Pauses placed after key points. Filler under 2/min. Within 10% of time budget.",
    // 81-100
    "Locked-in pacing across all four quartiles. Pauses are intentional bookmarks. Filler under 1/min. Final sentence lands cleanly.",
  ],
  tone: [
    // 1-20
    "Monotone, mumbled, or sustained upspeak. Volume locked at one level. No vocal variation.",
    // 21-40
    "Some pitch variation but statements rise at the end. Volume narrow. Voice low-energy or breathy.",
    // 41-60
    "Moderate pitch variation, mostly downward inflection on statements. Articulation generally clear.",
    // 61-80
    "Intentional pitch range across the response. Statements close downward. Volume rises and falls to mark important words.",
    // 81-100
    "Vocal expressiveness throughout — pitch variation, downward conviction inflection, volume contrast on emphasis, crisp consonants, energy holds end-to-end.",
  ],
};

/** Render the per-dim anchor block for one dimension as a prompt
 *  fragment. Five bullets, one per band range. Used by `score.ts`'s
 *  renderRubric() when FF_BAND_ANCHORS is on. */
export function renderAnchorsForDimension(dim: SkillDimension): string {
  const anchors = RUBRIC_ANCHORS[dim];
  return BAND_RANGES.map(
    (range, i) => `  ${range.label}: ${anchors[i] ?? "(no anchor)"}`,
  ).join("\n");
}
