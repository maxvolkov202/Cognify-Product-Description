// ——— Scoring dimensions (v2.0.0 rubric — WS-1 2026-04-24) ———————————
// Grouped into Content (what you said) and Delivery (how you said it).
// Dimension names aligned with strategy team + V2 mockups. Historical
// reps retain their original `rubric_version` tag; use the
// `src/lib/scoring/dimension-aliases.ts` helper to read them.
// See docs/SCORING_METHODOLOGY.md and src/lib/scoring/rubric.ts.

export const SKILL_DIMENSIONS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "adaptability",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];

export const SKILL_DIMENSION_GROUPS = {
  content: ["clarity", "structure", "conciseness"],
  delivery: ["thinking_quality", "delivery", "adaptability"],
} as const satisfies Record<string, readonly SkillDimension[]>;

export type SkillDimensionGroup = keyof typeof SKILL_DIMENSION_GROUPS;

export const DIMENSION_LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking Quality",
  delivery: "Delivery",
  adaptability: "Adaptability",
};

export const DIMENSION_GROUP_LABELS: Record<SkillDimensionGroup, string> = {
  content: "Content",
  delivery: "Delivery",
};

export function getDimensionGroup(dim: SkillDimension): SkillDimensionGroup {
  if ((SKILL_DIMENSION_GROUPS.content as readonly string[]).includes(dim)) {
    return "content";
  }
  return "delivery";
}

export const MODE_IDS = ["daily_workout", "skill_lab", "scenario_training"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export type Callout = {
  dimension: SkillDimension | "structural_adherence";
  tone: "positive" | "neutral" | "warn" | "critical";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
  transcriptStart: number;
  transcriptEnd: number;
};

export type DimensionScore = {
  dimension: SkillDimension;
  score: number;
  signals: string[];
};

export type RepScore = {
  composite: number;
  dimensions: DimensionScore[];
  /** Present only when the rep is scored against an externally-generated
   *  framework (scenario mode). Measures the user's structural adherence
   *  to the framework's nodes — a distinct dimension from the six rubric
   *  dimensions. */
  structuralAdherence?: number;
  callouts: Callout[];
  modelVersion: string;
  rubricVersion: string;
};

export type FrameworkNode = {
  id: string;
  label: string;
  description: string;
};

export type Framework = {
  id: string;
  name: string;
  description: string;
  nodes: FrameworkNode[];
  source: "library" | "generated";
};
