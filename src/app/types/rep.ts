export type RepType = "cold-start" | "improvement";
export type RepStatus = "idle" | "writing" | "complete" | "error";

export interface Rep {
  id: string;
  scenario: string;
  scenarioCategory: string;
  audience: string;
  framework: string;
  preRepIntent: string;
  // Text-based rep content
  repContent: {
    point: string;
    example: string;
    meaning: string;
  };
  clarityScore: number;
  repType: RepType;
  status: RepStatus;
  primaryFocus: {
    title: string;
    nextStep: string;
  };
  completedAt: Date;
  // Detailed feedback scores for comparison
  detailedScores?: {
    clarity: number;
    structure: number;
    brevity: number;
    confidence: number;
  };
  // Analysis metrics for comparison
  analysisMetrics?: {
    wordCount: number;
    hasAllFields: boolean;
    structureCompleteness: number;
  };
  // Enhanced feedback
  strengths?: string[];
  weaknesses?: string[];
  specificActions?: string[];
}

export interface Framework {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  structure: string[];
  structureDetails?: string[];
}

export const FRAMEWORKS: Framework[] = [
  {
    id: "point-example-meaning",
    name: "Point → Example → Meaning",
    description: "Clear explanation for non-experts",
    whenToUse: "Teaching or simplifying",
    structure: ["Point", "Example", "Meaning"],
    structureDetails: [
      "Point — state the idea",
      "Example — illustrate it",
      "Meaning — explain why it matters"
    ]
  },
  {
    id: "context-decision-impact",
    name: "Context → Decision → Impact",
    description: "Executive update structure",
    whenToUse: "Explaining decisions",
    structure: ["Context", "Decision", "Impact"],
    structureDetails: [
      "Context — background",
      "Decision — what was decided",
      "Impact — consequences"
    ]
  },
  {
    id: "problem-impact-solution",
    name: "Problem → Impact → Solution",
    description: "Persuasive structure",
    whenToUse: "Sales or recommendations",
    structure: ["Problem", "Impact", "Solution"],
    structureDetails: [
      "Problem — what's wrong",
      "Impact — who's affected & cost",
      "Solution — what you recommend"
    ]
  },
  {
    id: "what-why-how",
    name: "What → Why → How",
    description: "High-level explanation model",
    whenToUse: "Explaining how something works",
    structure: ["What", "Why", "How"],
    structureDetails: [
      "What — the concept",
      "Why — importance",
      "How — implementation"
    ]
  },
  {
    id: "situation-complication-resolution",
    name: "Situation → Complication → Resolution",
    description: "Story-driven reasoning",
    whenToUse: "Strategy walkthrough",
    structure: ["Situation", "Complication", "Resolution"],
    structureDetails: [
      "Situation — starting state",
      "Complication — what changed",
      "Resolution — how it was solved"
    ]
  },
  {
    id: "options-tradeoffs-recommendation",
    name: "Options → Tradeoffs → Recommendation",
    description: "Structured decision logic",
    whenToUse: "Prioritization",
    structure: ["Options", "Tradeoffs", "Recommendation"],
    structureDetails: [
      "Options — alternatives considered",
      "Tradeoffs — pros/cons",
      "Recommendation — best path forward"
    ]
  },
  {
    id: "claim-evidence-implication",
    name: "Claim → Evidence → Implication",
    description: "Persuasive argument format",
    whenToUse: "Defending an idea",
    structure: ["Claim", "Evidence", "Implication"],
    structureDetails: [
      "Claim — your assertion",
      "Evidence — supporting data",
      "Implication — what this means"
    ]
  },
  {
    id: "before-after-bridge",
    name: "Before → After → Bridge",
    description: "Change communication",
    whenToUse: "Explaining transformation",
    structure: ["Before", "After", "Bridge"],
    structureDetails: [
      "Before — initial state",
      "After — future state",
      "Bridge — how to get there"
    ]
  },
  {
    id: "question-answer-reasoning",
    name: "Question → Answer → Reasoning",
    description: "Interview response model",
    whenToUse: "High-pressure Q&A",
    structure: ["Answer", "Reasoning", "Clarification"],
    structureDetails: [
      "Answer — direct response",
      "Reasoning — why that's the answer",
      "Clarification — additional context"
    ]
  },
  {
    id: "summary-detail-summary",
    name: "Summary → Detail → Summary",
    description: "Top-down executive communication",
    whenToUse: "Time-constrained updates",
    structure: ["Summary", "Detail", "Summary"],
    structureDetails: [
      "Summary — the headline",
      "Detail — supporting information",
      "Reinforce summary — closing statement"
    ]
  },
  {
    id: "situation-action-result",
    name: "Situation → Action → Result",
    description: "Behavioral interview classic",
    whenToUse: "Explaining past experience",
    structure: ["Situation", "Action", "Result"],
    structureDetails: [
      "Situation — the context",
      "Action — what you did",
      "Result — measurable outcome"
    ]
  },
  {
    id: "context-insight-recommendation",
    name: "Context → Insight → Recommendation",
    description: "Strategic advisory format",
    whenToUse: "Consulting or analysis",
    structure: ["Context", "Insight", "Recommendation"],
    structureDetails: [
      "Context — the situation",
      "Insight — key finding",
      "Recommendation — next step"
    ]
  }
];
