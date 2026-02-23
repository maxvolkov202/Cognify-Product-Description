import { Rep } from "../types/rep";

export interface RepComparison {
  hasImprovement: boolean;
  hasRegression: boolean;
  improvements: string[];
  regressions: string[];
  unchanged: string[];
  summary: string;
}

export function compareReps(currentRep: Rep, previousRep: Rep): RepComparison {
  const improvements: string[] = [];
  const regressions: string[] = [];
  const unchanged: string[] = [];

  if (!currentRep.detailedScores || !currentRep.analysisMetrics || 
      !previousRep.detailedScores || !previousRep.analysisMetrics) {
    return {
      hasImprovement: false,
      hasRegression: false,
      improvements: [],
      regressions: [],
      unchanged: [],
      summary: "Starting fresh with this rep"
    };
  }

  const current = currentRep;
  const previous = previousRep;
  const currentScores = current.detailedScores;
  const previousScores = previous.detailedScores;
  const currentMetrics = current.analysisMetrics;
  const previousMetrics = previous.analysisMetrics;

  // Compare overall score
  const scoreDelta = current.clarityScore - previous.clarityScore;
  
  // Compare filler words (relative to word count)
  const currentFillerRate = currentMetrics.fillerWordCount / Math.max(currentMetrics.wordCount, 1);
  const previousFillerRate = previousMetrics.fillerWordCount / Math.max(previousMetrics.wordCount, 1);
  const fillerRateDelta = currentFillerRate - previousFillerRate;
  
  if (fillerRateDelta < -0.02) { // 2% reduction in filler rate
    improvements.push("Fewer filler words");
  } else if (fillerRateDelta > 0.02) { // 2% increase
    regressions.push("More filler words");
  }

  // Compare opening strength
  if (currentMetrics.hasStrongOpening && !previousMetrics.hasStrongOpening) {
    improvements.push("Clearer opening");
  } else if (!currentMetrics.hasStrongOpening && previousMetrics.hasStrongOpening) {
    regressions.push("Weaker opening");
  }

  // Compare closing strength
  if (currentMetrics.hasActionableClosing && !previousMetrics.hasActionableClosing) {
    improvements.push("Stronger conclusion");
  } else if (!currentMetrics.hasActionableClosing && previousMetrics.hasActionableClosing) {
    regressions.push("Weaker conclusion");
  }

  // Compare framework coverage (only if same framework)
  if (current.framework === previous.framework && current.framework !== "free-form") {
    const coverageDelta = currentMetrics.frameworkCoveragePercentage - previousMetrics.frameworkCoveragePercentage;
    if (coverageDelta >= 20) {
      improvements.push("Better framework coverage");
    } else if (coverageDelta <= -20) {
      regressions.push("Incomplete framework coverage");
    }
  }

  // Compare word count for conciseness (significant if more than 20% change)
  const wordCountRatio = currentMetrics.wordCount / Math.max(previousMetrics.wordCount, 1);
  if (wordCountRatio < 0.8 && current.clarityScore >= previous.clarityScore) {
    improvements.push("More concise");
  } else if (wordCountRatio > 1.3) {
    regressions.push("Less concise");
  }

  // Compare dimension scores (8+ point changes are significant with strict grading)
  const dimensions: Array<keyof typeof currentScores> = ["clarity", "structure", "specificity", "pacing", "presence"];
  
  dimensions.forEach(dimension => {
    const delta = currentScores[dimension] - previousScores[dimension];
    
    if (delta >= 8) {
      // Significant improvement
      if (dimension === "clarity") improvements.push("Clearer message");
      else if (dimension === "structure") improvements.push("Better structure");
      else if (dimension === "specificity") improvements.push("More specific details");
      else if (dimension === "pacing") improvements.push("Improved pacing");
      else if (dimension === "presence") improvements.push("Stronger presence");
    } else if (delta <= -8) {
      // Significant regression
      if (dimension === "clarity") regressions.push("Less clear");
      else if (dimension === "structure") regressions.push("Structure weakened");
      else if (dimension === "specificity") regressions.push("Less specific");
      else if (dimension === "pacing") regressions.push("Pacing issues");
      else if (dimension === "presence") regressions.push("Weaker delivery");
    } else if (delta >= -3 && delta <= 3) {
      // Maintained (within small threshold) - only track for strong scores
      if (dimension === "clarity" && previousScores.clarity >= 75) unchanged.push("clarity");
      else if (dimension === "presence" && previousScores.presence >= 75) unchanged.push("presence");
    }
  });

  // Generate natural language summary
  let summary = "";
  
  if (improvements.length === 0 && regressions.length === 0) {
    if (scoreDelta >= 3) {
      summary = "Small incremental improvement";
    } else if (scoreDelta <= -3) {
      summary = "Minor fluctuation—keep practicing";
    } else {
      summary = "Consistent performance—you're building the skill";
    }
  } else if (improvements.length > 0 && regressions.length === 0) {
    // Pure improvement
    if (improvements.length === 1) {
      summary = improvements[0];
    } else if (improvements.length === 2) {
      summary = `${improvements[0]} and ${improvements[1].toLowerCase()}`;
    } else {
      summary = `${improvements[0]}, ${improvements[1].toLowerCase()}, and ${improvements.length - 2} more ${improvements.length === 3 ? 'improvement' : 'improvements'}`;
    }
  } else if (improvements.length === 0 && regressions.length > 0) {
    // Pure regression
    if (regressions.length === 1) {
      summary = regressions[0];
    } else {
      summary = `${regressions[0]} and ${regressions[1].toLowerCase()}`;
    }
  } else {
    // Mixed results - prioritize the more significant side
    if (improvements.length > regressions.length) {
      const topImprovement = improvements[0];
      const secondImprovement = improvements[1];
      summary = `${topImprovement} and ${secondImprovement.toLowerCase()}`;
    } else if (regressions.length > improvements.length) {
      const topRegression = regressions[0];
      summary = `${topRegression}—focus on this next rep`;
    } else {
      const topImprovement = improvements[0];
      const topRegression = regressions[0];
      summary = `${topImprovement}, but ${topRegression.toLowerCase()}`;
    }
  }

  return {
    hasImprovement: improvements.length > 0,
    hasRegression: regressions.length > 0,
    improvements,
    regressions,
    unchanged,
    summary
  };
}

// Helper to determine overall trend
export function getProgressTrend(comparison: RepComparison): "improving" | "regressing" | "stable" {
  if (comparison.improvements.length > comparison.regressions.length) {
    return "improving";
  } else if (comparison.regressions.length > comparison.improvements.length) {
    return "regressing";
  } else {
    return "stable";
  }
}
