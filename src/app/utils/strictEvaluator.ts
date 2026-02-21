import { TranscriptAnalysis } from "./transcriptAnalyzer";

/**
 * STRICT EXECUTIVE COMMUNICATION EVALUATOR
 * 
 * Grading Philosophy:
 * - Be analytical and conservative
 * - Do not inflate scores
 * - Assume the speaker is developing unless proven otherwise
 * 
 * Score Distribution:
 * 90-100: Exceptional, executive-level performance
 * 75-89: Strong, minor refinements needed
 * 60-74: Competent but flawed
 * 40-59: Developing, noticeable gaps
 * Below 40: Unclear or incomplete
 * 
 * If the response lacks measurable outcomes, strong structure, or clear reasoning,
 * it should not exceed 70.
 */

export interface StrictFeedback {
  clarity: { score: number; feedback: string };
  structure: { score: number; feedback: string };
  specificity: { score: number; feedback: string };
  pacing: { score: number; feedback: string };
  presence: { score: number; feedback: string };
  overallScore: number;
  overallDiagnostic: string;
  primaryFocus: { title: string; explanation: string; nextStep: string };
  repType: "cold-start" | "improvement";
}

export function generateStrictFeedback(
  analysis: TranscriptAnalysis,
  transcript: string,
  framework: string,
  repType: "cold-start" | "improvement" = "cold-start"
): StrictFeedback {
  
  // Detect measurable outcomes/specifics
  const hasMetrics = /\d+%|\d+x|\$\d+|saved \d+|increased \d+|reduced \d+|grew \d+/i.test(transcript);
  const hasConcreteExample = /for example|specifically|such as|instance/i.test(transcript);
  const hasVagueClaims = /things|stuff|better|improve|help|good|great|nice|enhance/i.test(transcript);
  const hasSpecificNouns = /project|product|system|process|team|customer|revenue|cost|time|quality/i.test(transcript);
  
  // Detect reasoning quality
  const hasCausalReasoning = /because|since|therefore|as a result|led to|caused|resulting in/i.test(transcript);
  const hasConsequenceMapping = /impact|effect|outcome|result|consequence/i.test(transcript);
  
  // === CLARITY (20%) ===
  let clarityScore = 70; // Start at "competent but flawed"
  let clarityFeedback = "";
  
  if (analysis.hasStrongOpening) {
    clarityScore += 10;
  } else {
    clarityScore -= 15;
    clarityFeedback = "Main point buried under preamble. Lead with the conclusion.";
  }
  
  if (analysis.avgWordsPerSentence > 25) {
    clarityScore -= 15;
    if (!clarityFeedback) clarityFeedback = "Sentences run too long. Listener effort required.";
  }
  
  if (analysis.repetitiveWords.length > 2) {
    clarityScore -= 10;
    if (!clarityFeedback) clarityFeedback = `Repeated "${analysis.repetitiveWords[0]}" excessively, creating confusion.`;
  }
  
  if (analysis.wordCount < 50) {
    clarityScore -= 12;
    if (!clarityFeedback) clarityFeedback = "Message too compressed to be clear.";
  }
  
  if (!clarityFeedback) {
    if (clarityScore >= 75) {
      clarityFeedback = "Core idea understandable with minimal effort.";
    } else {
      clarityFeedback = "Message present but requires listener work to extract.";
    }
  }
  
  clarityScore = Math.max(30, Math.min(100, clarityScore));
  
  // === STRUCTURE (25%) ===
  let structureScore = 65; // Start conservative
  let structureFeedback = "";
  
  if (analysis.hasStrongOpening) {
    structureScore += 8;
  } else {
    structureScore -= 10;
  }
  
  if (analysis.hasActionableClosing) {
    structureScore += 10;
  } else {
    structureScore -= 15;
    structureFeedback = "Ending lacks direction. No clear takeaway or next step.";
  }
  
  if (analysis.sentenceCount < 3) {
    structureScore -= 15;
    if (!structureFeedback) structureFeedback = "Idea underdeveloped. Missing logical progression.";
  }
  
  if (analysis.sentenceCount >= 5 && analysis.hasStrongOpening && analysis.hasActionableClosing) {
    structureScore += 10;
  }
  
  // Missing framework adherence caps structure at 60
  if (framework !== "free-form" && !analysis.hasActionableClosing) {
    structureScore = Math.min(structureScore, 60);
  }
  
  if (!structureFeedback) {
    if (structureScore >= 75) {
      structureFeedback = "Logical progression from setup to conclusion.";
    } else if (structureScore >= 60) {
      structureFeedback = "Basic structure present but missing components.";
    } else {
      structureFeedback = "Structural gaps disrupt logical flow.";
    }
  }
  
  structureScore = Math.max(30, Math.min(100, structureScore));
  
  // === SPECIFICITY (25%) - HARSHEST GRADER ===
  let specificityScore = 55; // Start low - must prove specificity
  let specificityFeedback = "";
  
  // Positive signals
  if (hasMetrics) {
    specificityScore += 20;
  }
  
  if (hasConcreteExample) {
    specificityScore += 10;
  }
  
  if (hasSpecificNouns) {
    specificityScore += 8;
  }
  
  if (hasCausalReasoning) {
    specificityScore += 7;
  }
  
  // Negative signals - heavy penalties
  if (hasVagueClaims && !hasMetrics) {
    specificityScore -= 20;
    specificityFeedback = "Vague claims without evidence. No measurable outcomes.";
  }
  
  if (!hasMetrics && !hasConcreteExample) {
    specificityScore = Math.min(specificityScore, 60); // Hard cap
    if (!specificityFeedback) specificityFeedback = "Missing specific examples and measurable results.";
  }
  
  if (analysis.jargonDetected.length > 0) {
    specificityScore -= 12;
    if (!specificityFeedback) specificityFeedback = `Business jargon (\"${analysis.jargonDetected[0]}\") substituting for specific detail.`;
  }
  
  // Vague claims should never score above 65
  if (hasVagueClaims && !hasMetrics && !hasConcreteExample) {
    specificityScore = Math.min(specificityScore, 65);
  }
  
  if (!specificityFeedback) {
    if (specificityScore >= 75) {
      specificityFeedback = "Concrete details and measurable outcomes provided.";
    } else if (specificityScore >= 60) {
      specificityFeedback = "Some specifics present but lacks measurable impact.";
    } else {
      specificityFeedback = "Generic claims without supporting detail.";
    }
  }
  
  specificityScore = Math.max(25, Math.min(100, specificityScore));
  
  // === PACING (15%) ===
  let pacingScore = 65;
  let pacingFeedback = "";
  
  if (analysis.wordCount < 50) {
    pacingScore -= 25;
    pacingFeedback = "Severely underdeveloped. Didn't use available time.";
  } else if (analysis.wordCount < 80) {
    pacingScore -= 10;
    if (!pacingFeedback) pacingFeedback = "Rushed. Needed more time to develop key points.";
  }
  
  if (analysis.wordCount > 200) {
    pacingScore -= 20;
    pacingFeedback = "Over-explained. Listener patience tested.";
  } else if (analysis.wordCount > 160) {
    pacingScore -= 10;
  }
  
  if (!analysis.hasStrongOpening) {
    pacingScore -= 12;
    if (!pacingFeedback) pacingFeedback = "Wasted opening seconds on preamble instead of substance.";
  }
  
  // Running out of time or rushing caps at 70
  if (analysis.wordCount > 180 || analysis.wordCount < 60) {
    pacingScore = Math.min(pacingScore, 70);
  }
  
  if (!pacingFeedback) {
    if (pacingScore >= 75) {
      pacingFeedback = "Effective time management and prioritization.";
    } else {
      pacingFeedback = "Timing issues affected message delivery.";
    }
  }
  
  pacingScore = Math.max(30, Math.min(100, pacingScore));
  
  // === PRESENCE (15%) ===
  let presenceScore = 70;
  let presenceFeedback = "";
  
  // Heavy filler words (10+) caps at 65
  if (analysis.fillerWordCount >= 10) {
    presenceScore = Math.min(presenceScore, 65);
    presenceFeedback = `${analysis.fillerWordCount} filler words severely undermine authority.`;
  } else if (analysis.fillerWordCount >= 6) {
    presenceScore -= 18;
    if (!presenceFeedback) presenceFeedback = `${analysis.fillerWordCount} filler words weaken delivery. Pause instead.`;
  } else if (analysis.fillerWordCount >= 3) {
    presenceScore -= 10;
  } else if (analysis.fillerWordCount === 0) {
    presenceScore += 12;
  }
  
  // Frequent hedging caps at 60
  if (analysis.hedgingPhrases.length >= 4) {
    presenceScore = Math.min(presenceScore, 60);
    presenceFeedback = `Excessive hedging (\"${analysis.hedgingPhrases[0]}\", \"${analysis.hedgingPhrases[1]}\") signals uncertainty.`;
  } else if (analysis.hedgingPhrases.length >= 2) {
    presenceScore -= 15;
    if (!presenceFeedback) presenceFeedback = `Hedging language (\"${analysis.hedgingPhrases[0]}\") weakens position.`;
  }
  
  if (analysis.confidenceIssues.length > 0) {
    presenceScore -= 12;
    if (!presenceFeedback) presenceFeedback = `Asking \"${analysis.confidenceIssues[0]}\" signals self-doubt.`;
  }
  
  if (!presenceFeedback) {
    if (presenceScore >= 80) {
      presenceFeedback = "Confident, steady delivery with minimal hesitation.";
    } else if (presenceScore >= 65) {
      presenceFeedback = "Some conviction present but delivery shows uncertainty.";
    } else {
      presenceFeedback = "Delivery lacks authority and decisiveness.";
    }
  }
  
  presenceScore = Math.max(25, Math.min(100, presenceScore));
  
  // === OVERALL SCORE ===
  // Weighted: Clarity 20%, Structure 25%, Specificity 25%, Pacing 15%, Presence 15%
  const overallScore = Math.round(
    clarityScore * 0.20 +
    structureScore * 0.25 +
    specificityScore * 0.25 +
    pacingScore * 0.15 +
    presenceScore * 0.15
  );
  
  // === OVERALL DIAGNOSTIC ===
  let overallDiagnostic = "";
  if (overallScore >= 90) {
    overallDiagnostic = "Exceptional executive-level performance.";
  } else if (overallScore >= 75) {
    overallDiagnostic = "Strong performance with minor refinements needed.";
  } else if (overallScore >= 60) {
    overallDiagnostic = "Competent but noticeable structural and clarity gaps.";
  } else if (overallScore >= 40) {
    overallDiagnostic = "Developing. Missing key components or lacking specificity.";
  } else {
    overallDiagnostic = "Unclear message with significant delivery and structural issues.";
  }
  
  // === PRIMARY FOCUS (Lowest Impact Area) ===
  const dimensions = [
    { 
      name: "specificity", 
      score: specificityScore, 
      weight: 0.25,
      title: "Add Measurable Outcomes",
      explanation: "Generic claims without evidence. Professional communication requires concrete details, specific examples, or measurable results.",
      nextStep: "Next rep: Include one metric or specific example."
    },
    { 
      name: "structure", 
      score: structureScore, 
      weight: 0.25,
      title: "Build Complete Structure",
      explanation: "Missing critical framework components. Incomplete progression from setup to conclusion reduces message impact.",
      nextStep: "Next rep: Ensure clear opening, middle, and actionable close."
    },
    { 
      name: "clarity", 
      score: clarityScore, 
      weight: 0.20,
      title: "Lead With Your Point",
      explanation: "Core message buried or unclear. Executives need the conclusion first, then supporting reasoning.",
      nextStep: "Next rep: State your main point in the first sentence."
    },
    { 
      name: "presence", 
      score: presenceScore, 
      weight: 0.15,
      title: "Eliminate Filler Language",
      explanation: "Filler words and hedging undermine authority. Decisiveness requires clean, direct delivery.",
      nextStep: "Next rep: When you feel \"um\" coming, pause instead."
    },
    { 
      name: "pacing", 
      score: pacingScore, 
      weight: 0.15,
      title: "Manage Time Effectively",
      explanation: "Poor time allocation. Either rushed through key points or over-explained secondary details.",
      nextStep: "Next rep: Spend 70% of time on your core argument."
    }
  ];
  
  // Find lowest weighted impact (score * weight)
  const lowestImpact = dimensions.reduce((lowest, current) => {
    const currentImpact = current.score * current.weight;
    const lowestImpactScore = lowest.score * lowest.weight;
    return currentImpact < lowestImpactScore ? current : lowest;
  });
  
  const primaryFocus = {
    title: lowestImpact.title,
    explanation: lowestImpact.explanation,
    nextStep: lowestImpact.nextStep
  };
  
  return {
    clarity: { score: clarityScore, feedback: clarityFeedback },
    structure: { score: structureScore, feedback: structureFeedback },
    specificity: { score: specificityScore, feedback: specificityFeedback },
    pacing: { score: pacingScore, feedback: pacingFeedback },
    presence: { score: presenceScore, feedback: presenceFeedback },
    overallScore,
    overallDiagnostic,
    primaryFocus,
    repType
  };
}
