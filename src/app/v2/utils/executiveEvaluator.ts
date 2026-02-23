import { TranscriptAnalysis } from "./transcriptAnalyzer";

/**
 * EXECUTIVE COMMUNICATION EVALUATOR
 * 
 * Not a motivational assistant. Not a cheerleader.
 * A performance evaluator.
 * 
 * Analytical, specific, and conservative in scoring.
 * Every statement grounded in observable behavior.
 */

export interface DimensionFeedback {
  score: number;
  strength: string | null;
  weakness: string;
  reasoning: string;
}

export interface ExecutiveFeedback {
  clarity: DimensionFeedback;
  structure: DimensionFeedback;
  specificity: DimensionFeedback;
  pacing: DimensionFeedback;
  presence: DimensionFeedback;
  overallScore: number;
  overallDiagnostic: string;
  primaryFocus: {
    dimension: string;
    instruction: string;
  };
}

export function evaluateExecutiveCommunication(
  analysis: TranscriptAnalysis,
  transcript: string,
  framework: string
): ExecutiveFeedback {
  
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const firstSentence = sentences[0]?.trim() || '';
  const lastSentence = sentences[sentences.length - 1]?.trim() || '';
  
  // Detect specificity signals
  const hasMetrics = /\d+%|\d+x|\$\d+|\d+ (percent|points|dollars|hours|days|weeks|months)|saved \d+|increased \d+|reduced \d+|grew \d+/i.test(transcript);
  const hasConcreteExample = /for example|specifically|such as|instance where|one case|in this situation/i.test(transcript);
  const hasVagueClaims = /\b(things|stuff|better|improve|help|good|great|nice|enhance|optimize|streamline)\b/gi.test(transcript);
  const vagueClainsCount = (transcript.match(/\b(things|stuff|better|improve|help|good|great|nice|enhance|optimize|streamline)\b/gi) || []).length;
  const hasActionVerbs = /decided|implemented|built|designed|launched|eliminated|restructured|led|drove|executed/i.test(transcript);
  const hasCausalLink = /because|since|therefore|as a result|led to|caused|resulting in|which meant|this enabled/i.test(transcript);
  
  // Framework-specific detection
  const frameworkPatterns: Record<string, RegExp[]> = {
    'star': [
      /situation|context|background|setting/i,
      /task|challenge|problem|goal|objective/i,
      /action|did|implemented|approach|steps/i,
      /result|outcome|impact|effect/i
    ],
    'prep': [
      /point|position|recommendation|main idea|thesis/i,
      /reason|because|rationale|why|justification/i,
      /example|instance|case|evidence|data/i,
      /point|therefore|conclusion|summary/i
    ]
  };
  
  const frameworkSections = frameworkPatterns[framework] || [];
  const coverageCount = frameworkSections.filter(pattern => pattern.test(transcript)).length;
  const coveragePercentage = frameworkSections.length > 0 ? (coverageCount / frameworkSections.length) * 100 : 0;
  
  // === CLARITY EVALUATION ===
  let clarityScore = 65; // Competent baseline
  let clarityStrength: string | null = null;
  let clarityWeakness = "";
  
  // Opening strength
  if (analysis.hasStrongOpening) {
    clarityScore += 12;
    clarityStrength = "Opened directly without preamble";
  } else {
    clarityScore -= 15;
    clarityWeakness = "Main idea buried under setup";
  }
  
  // Sentence complexity
  if (analysis.avgWordsPerSentence > 25) {
    clarityScore -= 12;
    if (!clarityWeakness) clarityWeakness = "Sentences ran long, requiring listener effort";
  } else if (analysis.avgWordsPerSentence < 15) {
    clarityScore += 8;
    if (!clarityStrength) clarityStrength = "Kept sentences concise";
  }
  
  // Word economy
  if (analysis.wordCount < 50) {
    clarityScore -= 15;
    if (!clarityWeakness) clarityWeakness = "Too compressed to be clear";
  }
  
  // Repetitive language
  if (analysis.repetitiveWords.length > 2) {
    clarityScore -= 10;
    if (!clarityWeakness) clarityWeakness = `Overused "${analysis.repetitiveWords[0]}", creating confusion`;
  }
  
  // Vague claims cap
  if (vagueClainsCount > 3 && !hasMetrics) {
    clarityScore = Math.min(clarityScore, 65);
    if (!clarityWeakness) clarityWeakness = "Generic language without concrete specifics";
  }
  
  if (!clarityWeakness) clarityWeakness = "Message required interpretation to extract main point";
  
  clarityScore = Math.max(30, Math.min(100, clarityScore));
  
  const clarityReasoning = `Score reflects ${analysis.hasStrongOpening ? 'direct' : 'buried'} opening and ${
    analysis.avgWordsPerSentence > 25 ? 'complex' : 'manageable'
  } sentence structure.`;
  
  // === STRUCTURE EVALUATION ===
  let structureScore = 60; // Start lower - must prove structure
  let structureStrength: string | null = null;
  let structureWeakness = "";
  
  // Framework adherence
  if (framework !== "free-form") {
    if (coveragePercentage >= 75) {
      structureScore += 20;
      structureStrength = `Covered ${Math.round(coveragePercentage)}% of ${framework.toUpperCase()} framework`;
    } else if (coveragePercentage >= 50) {
      structureScore += 10;
    } else {
      structureScore = Math.min(structureScore, 60); // Hard cap
      structureWeakness = `Missing key ${framework.toUpperCase()} components (only ${Math.round(coveragePercentage)}% covered)`;
    }
  } else {
    if (analysis.hasStrongOpening && analysis.hasActionableClosing) {
      structureScore += 15;
    }
  }
  
  // Opening structure
  if (analysis.hasStrongOpening) {
    structureScore += 8;
  } else {
    structureScore -= 10;
    if (!structureWeakness) structureWeakness = "No clear roadmap established upfront";
  }
  
  // Closing structure
  if (analysis.hasActionableClosing) {
    structureScore += 12;
    if (!structureStrength) structureStrength = "Ended with clear direction";
  } else {
    structureScore -= 18;
    if (!structureWeakness) structureWeakness = "Ending lacked next steps or conclusion";
  }
  
  // Development
  if (analysis.sentenceCount < 3) {
    structureScore -= 15;
    if (!structureWeakness) structureWeakness = "Underdeveloped - didn't build a complete arc";
  }
  
  if (!structureWeakness) structureWeakness = "Logical flow present but incomplete";
  
  structureScore = Math.max(25, Math.min(100, structureScore));
  
  const structureReasoning = `Progression ${analysis.hasActionableClosing ? 'included' : 'lacked'} clear conclusion; ${
    framework !== 'free-form' ? `framework coverage was ${Math.round(coveragePercentage)}%` : 'free-form structure used'
  }.`;
  
  // === SPECIFICITY EVALUATION ===
  let specificityScore = 50; // Start low - must earn it
  let specificityStrength: string | null = null;
  let specificityWeakness = "";
  
  // Positive signals
  if (hasMetrics) {
    specificityScore += 25;
    specificityStrength = "Included measurable outcomes";
  }
  
  if (hasConcreteExample) {
    specificityScore += 12;
    if (!specificityStrength) specificityStrength = "Provided specific example";
  }
  
  if (hasActionVerbs) {
    specificityScore += 8;
  }
  
  if (hasCausalLink) {
    specificityScore += 10;
  }
  
  // Negative signals - heavy penalties
  if (!hasMetrics && !hasConcreteExample) {
    specificityScore = Math.min(specificityScore, 60); // Hard cap
    specificityWeakness = "No measurable outcome or specific example provided";
  }
  
  if (vagueClainsCount > 3) {
    specificityScore -= 15;
    if (!specificityWeakness) specificityWeakness = "Generic claims dominated without supporting detail";
  }
  
  if (analysis.jargonDetected.length > 0) {
    specificityScore -= 12;
    if (!specificityWeakness) specificityWeakness = `Business jargon ("${analysis.jargonDetected[0]}") substituted for concrete detail`;
  }
  
  // Ultimate cap for vague responses
  if (hasVagueClaims && !hasMetrics && !hasConcreteExample) {
    specificityScore = Math.min(specificityScore, 65);
  }
  
  if (!specificityWeakness) specificityWeakness = "Claims lacked numerical or concrete grounding";
  
  specificityScore = Math.max(20, Math.min(100, specificityScore));
  
  const specificityReasoning = `${hasMetrics ? 'Metrics present' : 'No metrics'}; ${
    hasConcreteExample ? 'concrete examples used' : 'no specific examples'
  }.`;
  
  // === PACING EVALUATION ===
  let pacingScore = 65;
  let pacingStrength: string | null = null;
  let pacingWeakness = "";
  
  // Time utilization
  if (analysis.wordCount < 50) {
    pacingScore -= 25;
    pacingWeakness = "Severely underdeveloped - didn't use available time";
  } else if (analysis.wordCount < 80) {
    pacingScore -= 12;
    if (!pacingWeakness) pacingWeakness = "Too brief - key points lacked development";
  } else if (analysis.wordCount >= 100 && analysis.wordCount <= 150) {
    pacingScore += 12;
    pacingStrength = "Used time effectively to develop idea";
  }
  
  if (analysis.wordCount > 200) {
    pacingScore -= 18;
    if (!pacingWeakness) pacingWeakness = "Over-explained - listener patience tested";
  } else if (analysis.wordCount > 180) {
    pacingScore -= 10;
  }
  
  // Opening time allocation
  if (!analysis.hasStrongOpening) {
    pacingScore -= 10;
    if (!pacingWeakness) pacingWeakness = "Wasted opening seconds on setup instead of substance";
  }
  
  // Ending rushed?
  if (analysis.wordCount > 120 && !analysis.hasActionableClosing) {
    pacingScore -= 12;
    if (!pacingWeakness) pacingWeakness = "Ending felt abrupt after extended setup";
  }
  
  // Time management caps
  if (analysis.wordCount < 60 || analysis.wordCount > 180) {
    pacingScore = Math.min(pacingScore, 70);
  }
  
  if (!pacingWeakness) pacingWeakness = "Time allocation didn't match message priority";
  
  pacingScore = Math.max(30, Math.min(100, pacingScore));
  
  const pacingReasoning = `${analysis.wordCount} words ${
    analysis.wordCount < 80 ? 'insufficient for depth' : 
    analysis.wordCount > 180 ? 'excessive for clarity' : 
    'appropriate for scope'
  }.`;
  
  // === PRESENCE EVALUATION ===
  let presenceScore = 70;
  let presenceStrength: string | null = null;
  let presenceWeakness = "";
  
  // Filler words - heavy impact
  if (analysis.fillerWordCount >= 10) {
    presenceScore = Math.min(presenceScore, 65); // Hard cap
    presenceWeakness = `${analysis.fillerWordCount} filler words severely undermined authority`;
  } else if (analysis.fillerWordCount >= 6) {
    presenceScore -= 20;
    if (!presenceWeakness) presenceWeakness = `${analysis.fillerWordCount} filler words weakened delivery`;
  } else if (analysis.fillerWordCount >= 3) {
    presenceScore -= 12;
    if (!presenceWeakness) presenceWeakness = "Filler words noticeable";
  } else if (analysis.fillerWordCount === 0) {
    presenceScore += 15;
    presenceStrength = "No filler words - clean delivery";
  } else if (analysis.fillerWordCount <= 2) {
    presenceScore += 8;
    if (!presenceStrength) presenceStrength = "Minimal filler words";
  }
  
  // Hedging language
  if (analysis.hedgingPhrases.length >= 4) {
    presenceScore = Math.min(presenceScore, 60); // Hard cap
    if (!presenceWeakness) presenceWeakness = `Excessive hedging ("${analysis.hedgingPhrases[0]}") signaled uncertainty`;
  } else if (analysis.hedgingPhrases.length >= 2) {
    presenceScore -= 15;
    if (!presenceWeakness) presenceWeakness = `Hedging language ("${analysis.hedgingPhrases[0]}") weakened position`;
  }
  
  // Confidence issues
  if (analysis.confidenceIssues.length > 0) {
    presenceScore -= 12;
    if (!presenceWeakness) presenceWeakness = `Self-doubt signals ("${analysis.confidenceIssues[0]}") undermined credibility`;
  }
  
  if (!presenceWeakness) presenceWeakness = "Delivery lacked decisiveness";
  
  presenceScore = Math.max(25, Math.min(100, presenceScore));
  
  const presenceReasoning = `${analysis.fillerWordCount} filler words; ${
    analysis.hedgingPhrases.length > 0 ? `${analysis.hedgingPhrases.length} hedging phrases` : 'no hedging'
  }.`;
  
  // === OVERALL SCORE ===
  const overallScore = Math.round(
    clarityScore * 0.20 +
    structureScore * 0.25 +
    specificityScore * 0.25 +
    pacingScore * 0.15 +
    presenceScore * 0.15
  );
  
  // === OVERALL DIAGNOSTIC (One sentence) ===
  let overallDiagnostic = "";
  
  const majorIssues: string[] = [];
  if (specificityScore < 60) majorIssues.push("lacked measurable outcomes");
  if (structureScore < 60) majorIssues.push("missed framework components");
  if (!analysis.hasActionableClosing) majorIssues.push("ended abruptly");
  if (clarityScore < 60) majorIssues.push("buried main point");
  if (presenceScore < 60) majorIssues.push("delivery showed uncertainty");
  
  const majorStrengths: string[] = [];
  if (specificityScore >= 80) majorStrengths.push("included specific outcomes");
  if (structureScore >= 80) majorStrengths.push("followed clear structure");
  if (clarityScore >= 80) majorStrengths.push("led with main point");
  
  if (overallScore >= 90) {
    overallDiagnostic = "Executive-ready performance with strong structure, concrete outcomes, and confident delivery.";
  } else if (overallScore >= 75) {
    overallDiagnostic = majorStrengths.length > 0
      ? `Strong performance that ${majorStrengths[0]}, with minor refinements needed.`
      : "Strong performance with minor refinements needed in specificity and structure.";
  } else if (overallScore >= 60) {
    overallDiagnostic = majorIssues.length > 0
      ? `Competent baseline but ${majorIssues.slice(0, 2).join(' and ')}.`
      : "Competent baseline with structural and specificity gaps.";
  } else if (overallScore >= 40) {
    overallDiagnostic = majorIssues.length > 0
      ? `Developing performance that ${majorIssues.slice(0, 2).join(' and ')}.`
      : "Developing performance lacking structural completeness and concrete detail.";
  } else {
    overallDiagnostic = "Response unclear with significant structural and delivery issues.";
  }
  
  // === PRIMARY FOCUS (Single actionable instruction) ===
  const dimensions = [
    { 
      name: "specificity", 
      score: specificityScore, 
      weight: 0.25,
      instruction: hasMetrics 
        ? "Add a concrete example to support your metric"
        : "State a measurable result in the final 20 seconds"
    },
    { 
      name: "structure", 
      score: structureScore, 
      weight: 0.25,
      instruction: !analysis.hasActionableClosing
        ? "End with one specific next step, not a summary"
        : framework !== 'free-form' && coveragePercentage < 75
        ? `Cover all ${framework.toUpperCase()} components - currently missing ${Math.round(100 - coveragePercentage)}%`
        : "Signal transitions between framework sections explicitly"
    },
    { 
      name: "clarity", 
      score: clarityScore, 
      weight: 0.20,
      instruction: !analysis.hasStrongOpening
        ? "State your conclusion in the first sentence, not after setup"
        : analysis.avgWordsPerSentence > 25
        ? "Break sentences at natural pauses - one idea per sentence"
        : "Eliminate the first sentence and start with your second"
    },
    { 
      name: "presence", 
      score: presenceScore, 
      weight: 0.15,
      instruction: analysis.fillerWordCount >= 6
        ? `Pause silently instead of saying "${analysis.fillerWords[0]}" - count to two`
        : analysis.hedgingPhrases.length >= 2
        ? `Replace "${analysis.hedgingPhrases[0]}" with direct statements`
        : "Slow down 10% and emphasize your opening sentence"
    },
    { 
      name: "pacing", 
      score: pacingScore, 
      weight: 0.15,
      instruction: analysis.wordCount < 80
        ? "Use the full time - spend 40 seconds developing your core point"
        : analysis.wordCount > 180
        ? "Cut the middle 30% - keep only highest-impact details"
        : "Front-load impact - spend 70% of time on your strongest point"
    }
  ];
  
  // Find lowest weighted impact
  const lowestImpact = dimensions.reduce((lowest, current) => {
    const currentImpact = current.score * current.weight;
    const lowestImpactScore = lowest.score * lowest.weight;
    return currentImpact < lowestImpactScore ? current : lowest;
  });
  
  return {
    clarity: {
      score: clarityScore,
      strength: clarityStrength,
      weakness: clarityWeakness,
      reasoning: clarityReasoning
    },
    structure: {
      score: structureScore,
      strength: structureStrength,
      weakness: structureWeakness,
      reasoning: structureReasoning
    },
    specificity: {
      score: specificityScore,
      strength: specificityStrength,
      weakness: specificityWeakness,
      reasoning: specificityReasoning
    },
    pacing: {
      score: pacingScore,
      strength: pacingStrength,
      weakness: pacingWeakness,
      reasoning: pacingReasoning
    },
    presence: {
      score: presenceScore,
      strength: presenceStrength,
      weakness: presenceWeakness,
      reasoning: presenceReasoning
    },
    overallScore,
    overallDiagnostic,
    primaryFocus: {
      dimension: lowestImpact.name,
      instruction: lowestImpact.instruction
    }
  };
}
