import type { SkillDimension } from "./domain";

/**
 * Per-dimension sub-skill map — Cognify DNA spec (May 2026).
 *
 * The DNA spec defines 36 sub-skills across the 6 dimensions. Each
 * sub-skill is the actual lever a coach would name when telling someone
 * what to fix. The AI uses these in feedback bullets so the user sees
 * "Word Choice broke down within Clarity" instead of just "Clarity dropped."
 *
 * Source: docs/Cognify DNA.docx §Subskills.
 *
 * Storage / wire format: each sub-skill is a snake_case string. The
 * `SUB_SKILL_TO_DIMENSION` lookup enforces the dimension membership at
 * runtime; the per-dimension union types enforce it at compile time.
 */

export type ClaritySubSkill =
  | "word_choice"
  | "concreteness"
  | "audience_awareness"
  | "idea_isolation"
  | "precision"
  | "logical_sequencing";

export type StructureSubSkill =
  | "opening_hook"
  | "signposting"
  | "argument_hierarchy"
  | "bottom_line_discipline"
  | "narrative_arc"
  | "coherence";

export type ConcisenessSubSkill =
  | "filler_elimination"
  | "hedging_awareness"
  | "repetition_control"
  | "response_scoping"
  | "editing_in_real_time";

export type ThinkingQualitySubSkill =
  | "claim_support"
  | "first_principles_reasoning"
  | "counterargument_awareness"
  | "depth_of_analysis"
  | "intellectual_honesty"
  | "perspective_taking";

export type DeliverySubSkill =
  | "rate_awareness"
  | "strategic_pausing"
  | "filler_word_control"
  | "rhythm_variation"
  | "pressure_management";

export type ToneSubSkill =
  | "pitch_variation"
  | "volume_control"
  | "downward_inflection"
  | "emotional_authenticity"
  | "vocal_presence"
  | "warmth";

/** Flat union of all sub-skills. Used for storage + Zod enums. */
export type SubSkillId =
  | ClaritySubSkill
  | StructureSubSkill
  | ConcisenessSubSkill
  | ThinkingQualitySubSkill
  | DeliverySubSkill
  | ToneSubSkill;

/** Per-dimension sub-skill arrays — exposed as `readonly` for safety. */
export const SUB_SKILLS: Record<SkillDimension, readonly SubSkillId[]> = {
  clarity: [
    "word_choice",
    "concreteness",
    "audience_awareness",
    "idea_isolation",
    "precision",
    "logical_sequencing",
  ],
  structure: [
    "opening_hook",
    "signposting",
    "argument_hierarchy",
    "bottom_line_discipline",
    "narrative_arc",
    "coherence",
  ],
  conciseness: [
    "filler_elimination",
    "hedging_awareness",
    "repetition_control",
    "response_scoping",
    "editing_in_real_time",
  ],
  thinking_quality: [
    "claim_support",
    "first_principles_reasoning",
    "counterargument_awareness",
    "depth_of_analysis",
    "intellectual_honesty",
    "perspective_taking",
  ],
  delivery: [
    "rate_awareness",
    "strategic_pausing",
    "filler_word_control",
    "rhythm_variation",
    "pressure_management",
  ],
  tone: [
    "pitch_variation",
    "volume_control",
    "downward_inflection",
    "emotional_authenticity",
    "vocal_presence",
    "warmth",
  ],
};

/** Flat list of every sub-skill — useful for Zod enum + iteration. */
export const ALL_SUB_SKILLS: readonly SubSkillId[] = [
  ...SUB_SKILLS.clarity,
  ...SUB_SKILLS.structure,
  ...SUB_SKILLS.conciseness,
  ...SUB_SKILLS.thinking_quality,
  ...SUB_SKILLS.delivery,
  ...SUB_SKILLS.tone,
];

/** Reverse lookup: which dimension does this sub-skill belong to? */
export const SUB_SKILL_TO_DIMENSION: Record<SubSkillId, SkillDimension> = {
  // Clarity
  word_choice: "clarity",
  concreteness: "clarity",
  audience_awareness: "clarity",
  idea_isolation: "clarity",
  precision: "clarity",
  logical_sequencing: "clarity",
  // Structure
  opening_hook: "structure",
  signposting: "structure",
  argument_hierarchy: "structure",
  bottom_line_discipline: "structure",
  narrative_arc: "structure",
  coherence: "structure",
  // Conciseness
  filler_elimination: "conciseness",
  hedging_awareness: "conciseness",
  repetition_control: "conciseness",
  response_scoping: "conciseness",
  editing_in_real_time: "conciseness",
  // Thinking Quality
  claim_support: "thinking_quality",
  first_principles_reasoning: "thinking_quality",
  counterargument_awareness: "thinking_quality",
  depth_of_analysis: "thinking_quality",
  intellectual_honesty: "thinking_quality",
  perspective_taking: "thinking_quality",
  // Delivery
  rate_awareness: "delivery",
  strategic_pausing: "delivery",
  filler_word_control: "delivery",
  rhythm_variation: "delivery",
  pressure_management: "delivery",
  // Tone
  pitch_variation: "tone",
  volume_control: "tone",
  downward_inflection: "tone",
  emotional_authenticity: "tone",
  vocal_presence: "tone",
  warmth: "tone",
};

/** Human-readable labels for UI surfaces (sub-skill chips, accordion headers). */
export const SUB_SKILL_LABELS: Record<SubSkillId, string> = {
  // Clarity
  word_choice: "Word Choice",
  concreteness: "Concreteness",
  audience_awareness: "Audience Awareness",
  idea_isolation: "Idea Isolation",
  precision: "Precision",
  logical_sequencing: "Logical Sequencing",
  // Structure
  opening_hook: "Opening Hook",
  signposting: "Signposting",
  argument_hierarchy: "Argument Hierarchy",
  bottom_line_discipline: "Bottom Line Discipline",
  narrative_arc: "Narrative Arc",
  coherence: "Coherence",
  // Conciseness
  filler_elimination: "Filler Elimination",
  hedging_awareness: "Hedging Awareness",
  repetition_control: "Repetition Control",
  response_scoping: "Response Scoping",
  editing_in_real_time: "Editing in Real Time",
  // Thinking Quality
  claim_support: "Claim Support",
  first_principles_reasoning: "First-Principles Reasoning",
  counterargument_awareness: "Counterargument Awareness",
  depth_of_analysis: "Depth of Analysis",
  intellectual_honesty: "Intellectual Honesty",
  perspective_taking: "Perspective Taking",
  // Delivery
  rate_awareness: "Rate Awareness",
  strategic_pausing: "Strategic Pausing",
  filler_word_control: "Filler Word Control",
  rhythm_variation: "Rhythm Variation",
  pressure_management: "Pressure Management",
  // Tone
  pitch_variation: "Pitch Variation",
  volume_control: "Volume Control",
  downward_inflection: "Downward Inflection",
  emotional_authenticity: "Emotional Authenticity",
  vocal_presence: "Vocal Presence",
  warmth: "Warmth",
};

/** Compact prompt-ready reference for the AI: dimension → sub-skill list. */
export function renderSubSkillReference(): string {
  const lines: string[] = [];
  for (const dim of Object.keys(SUB_SKILLS) as SkillDimension[]) {
    const items = SUB_SKILLS[dim].map((s) => SUB_SKILL_LABELS[s]).join(", ");
    lines.push(`${dim}: ${items}`);
  }
  return lines.join("\n");
}

/** Type guard. */
export function isSubSkillForDimension(
  subSkill: string,
  dimension: SkillDimension,
): subSkill is SubSkillId {
  return SUB_SKILL_TO_DIMENSION[subSkill as SubSkillId] === dimension;
}
