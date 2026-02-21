export interface CustomFramework {
  id: string;
  name: string;
  description: string;
  structure: string[];
  structureDetails?: string[];
  isCustom: true;
  createdAt: Date;
  scoringWeights?: {
    clarity: number;
    structure: number;
    specificity: number;
    pacing: number;
    presence: number;
  };
}

export interface FrameworkBase {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  structure: string[];
  structureDetails?: string[];
  isCustom?: boolean;
  scoringWeights?: {
    clarity: number;
    structure: number;
    specificity: number;
    pacing: number;
    presence: number;
  };
}

export type Framework = FrameworkBase | CustomFramework;

// Default scoring weights (balanced)
export const DEFAULT_SCORING_WEIGHTS = {
  clarity: 1.0,
  structure: 1.0,
  specificity: 1.0,
  pacing: 1.0,
  presence: 1.0
};

// Framework-specific scoring adjustments
export const FRAMEWORK_SCORING_PROFILES: Record<string, Partial<typeof DEFAULT_SCORING_WEIGHTS>> = {
  // Sales frameworks prioritize clarity and specificity
  "problem-impact-solution": {
    clarity: 1.2,
    specificity: 1.3,
    structure: 1.1
  },
  
  // Consulting frameworks prioritize structure and specificity
  "context-insight-recommendation": {
    structure: 1.3,
    specificity: 1.2,
    clarity: 1.1
  },
  
  // Leadership frameworks prioritize presence and clarity
  "context-decision-impact": {
    presence: 1.3,
    clarity: 1.2,
    structure: 1.1
  },
  
  // Interview frameworks prioritize structure and pacing
  "situation-action-result": {
    structure: 1.3,
    pacing: 1.2,
    clarity: 1.1
  },
  "question-answer-reasoning": {
    structure: 1.2,
    pacing: 1.3,
    clarity: 1.1
  },
  
  // Explanation frameworks prioritize clarity and structure
  "point-example-meaning": {
    clarity: 1.3,
    structure: 1.2,
    specificity: 1.1
  },
  "what-why-how": {
    clarity: 1.3,
    structure: 1.2
  }
};
