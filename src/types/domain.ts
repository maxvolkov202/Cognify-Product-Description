// ——— Scoring dimensions (v2-beta.1 rubric) ———————————————————————
// Grouped into Content (what you said) and Delivery (how you said it).
// See docs/SCORING_METHODOLOGY.md and src/lib/scoring/rubric.ts.

export const SKILL_DIMENSIONS = [
  "clarity",
  "structure",
  "relevance",
  "confidence",
  "pacing",
  "tone",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];

export const SKILL_DIMENSION_GROUPS = {
  content: ["clarity", "structure", "relevance"],
  delivery: ["confidence", "pacing", "tone"],
} as const satisfies Record<string, readonly SkillDimension[]>;

export type SkillDimensionGroup = keyof typeof SKILL_DIMENSION_GROUPS;

export const DIMENSION_LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  relevance: "Relevance",
  confidence: "Confidence",
  pacing: "Pacing",
  tone: "Tone",
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

export type ScenarioInput = {
  scenario: string;
  audience?: string;
  keyPoints?: string[];
  outcome?: string;
  constraints?: string;
};
