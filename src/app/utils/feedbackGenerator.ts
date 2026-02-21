// Generate varied primary focus feedback based on rep count
export function generatePrimaryFocus(repCount: number): { title: string; nextStep: string } {
  const focusOptions = [
    {
      title: "Lead With The Problem",
      nextStep: "Start your first sentence with the core issue."
    },
    {
      title: "Remove Filler Words",
      nextStep: "Pause instead of saying 'um', 'like', or 'you know'."
    },
    {
      title: "Emphasize Impact Earlier",
      nextStep: "State why it matters in your first 15 seconds."
    },
    {
      title: "Use Concrete Examples",
      nextStep: "Replace abstract descriptions with specific instances."
    },
    {
      title: "Tighten Your Opening",
      nextStep: "Cut the first sentence in half and get to the point."
    },
    {
      title: "Build Logical Bridges",
      nextStep: "Use clear transitions: 'Because of this...', 'This leads to...', 'As a result...'"
    },
    {
      title: "End With Action",
      nextStep: "Close with what should happen next, not a summary."
    },
    {
      title: "Front-Load Clarity",
      nextStep: "Put your conclusion first, then explain why."
    },
    {
      title: "Eliminate Hedging Language",
      nextStep: "Replace 'kind of', 'sort of', 'I think maybe' with direct statements."
    },
    {
      title: "Quantify When Possible",
      nextStep: "Add numbers, percentages, or timelines to strengthen claims."
    }
  ];

  // Rotate through different focuses based on rep count
  return focusOptions[repCount % focusOptions.length];
}

// QUALITY GATE SYSTEM
export interface QualityGateResult {
  passed: boolean;
  failureReasons: string[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
}

export function checkRepQualityGates(
  transcript: string,
  duration: number
): QualityGateResult {
  const failureReasons: string[] = [];
  const warnings: string[] = [];
  
  // Extract basic metrics
  const words = transcript.trim().split(/\s+/);
  const wordCount = words.length;
  const charactersWithoutSpaces = transcript.replace(/\s/g, "").length;
  
  // GATE 1: Minimum duration (20 seconds)
  if (duration < 20) {
    failureReasons.push(`Too short: ${Math.round(duration)}s (need 20s minimum)`);
  }
  
  // GATE 2: Minimum word count (45 words)
  if (wordCount < 45) {
    failureReasons.push(`Not enough content: ${wordCount} words (need 45+ words)`);
  }
  
  // GATE 3: Speech density check (words per minute in reasonable range)
  const wordsPerMinute = (wordCount / duration) * 60;
  if (wordsPerMinute < 60) {
    failureReasons.push("Speech too sparse (long pauses or mostly silence)");
  }
  if (wordsPerMinute > 300) {
    warnings.push("Speaking very fast — clarity may be compromised");
  }
  
  // GATE 4: Content quality - check for meaningful content
  const fillerWords = ['um', 'uh', 'like', 'you know', 'kind of', 'sort of', 'basically', 'actually', 'literally'];
  const fillerCount = words.filter(word => 
    fillerWords.includes(word.toLowerCase().replace(/[.,!?]/g, ''))
  ).length;
  const fillerRatio = fillerCount / wordCount;
  
  if (fillerRatio > 0.25) {
    failureReasons.push("Too many filler words (>25% of speech)");
  }
  
  // GATE 5: Check for distinct idea units (simple heuristic: sentence count)
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length < 2) {
    failureReasons.push("Not enough distinct ideas (need at least 2 complete sentences)");
  }
  
  // GATE 6: Check for very short average word length (indicates gibberish or unclear speech)
  const avgWordLength = charactersWithoutSpaces / wordCount;
  if (avgWordLength < 3) {
    failureReasons.push("Unclear speech detected (very short words)");
  }
  
  // Determine confidence level
  let confidence: "high" | "medium" | "low" = "high";
  
  if (failureReasons.length > 0) {
    confidence = "low";
  } else if (duration < 30 || wordCount < 70 || fillerRatio > 0.15 || warnings.length > 0) {
    confidence = "medium";
  }
  
  const passed = failureReasons.length === 0;
  
  return {
    passed,
    failureReasons,
    warnings,
    confidence
  };
}

interface DetailedFeedback {
  overallScore: number;
  detailedScores: {
    clarity: number;
    structure: number;
    specificity: number;
    pacing: number;
    presence: number;
  };
  analysisMetrics: {
    fillerWordCount: number;
    wordCount: number;
    hasStrongOpening: boolean;
    hasActionableClosing: boolean;
    frameworkCoveragePercentage: number;
  };
  primaryFocus: {
    title: string;
    nextStep: string;
  };
  scoreConfidence: "high" | "medium" | "low";
  strengths: string[];
  weaknesses: string[];
  specificActions: string[];
  betterVersionSample?: string;
}

export function generateDetailedFeedback(
  transcript: string,
  category: string,
  framework: string,
  repCount: number,
  duration: number
): Promise<DetailedFeedback> {
  return new Promise((resolve) => {
    // Simulate async processing
    setTimeout(() => {
      // Analyze transcript for metrics
      const words = transcript.trim().split(/\s+/);
      const wordCount = words.length;
      
      // Count filler words
      const fillerWords = ['um', 'uh', 'like', 'you know', 'kind of', 'sort of', 'basically', 'actually', 'literally', 'obviously'];
      const fillerWordCount = words.filter(word => 
        fillerWords.includes(word.toLowerCase().replace(/[.,!?]/g, ''))
      ).length;
      const fillerRatio = fillerWordCount / wordCount;

      // Check for strong opening (starts with problem, decision, or claim)
      const strongOpeningWords = ['the problem', 'the issue', 'the core', 'three things', 'first', 'the decision', 'let me', 'here\'s'];
      const hasStrongOpening = strongOpeningWords.some(phrase => 
        transcript.toLowerCase().startsWith(phrase)
      );

      // Check for actionable closing
      const actionableClosingWords = ['next step', 'recommend', 'should', 'will', 'going forward', 'action', 'conclusion'];
      const hasActionableClosing = actionableClosingWords.some(phrase => 
        transcript.toLowerCase().includes(phrase)
      );

      // Check for concrete examples (numbers, specific names, metrics)
      const hasNumbers = /\d+/.test(transcript);
      const hasPercentages = /%/.test(transcript);
      const hasConcreteExamples = hasNumbers || hasPercentages;

      // Determine score confidence based on quality
      let scoreConfidence: "high" | "medium" | "low" = "high";
      if (duration < 30 || wordCount < 70 || fillerRatio > 0.15) {
        scoreConfidence = "medium";
      }
      if (duration < 25 || wordCount < 60 || fillerRatio > 0.2) {
        scoreConfidence = "low";
      }

      // BASE SCORING - START STRICT
      let baseScore = 55; // Start lower than before
      
      // Add modest improvement with reps (max +15 instead of +20)
      const improvement = Math.min(repCount * 1.5, 15);
      baseScore += improvement;
      
      // Add small random variation (±5 instead of ±7)
      const variation = () => Math.floor(Math.random() * 10) - 5;

      // Weight scores based on category
      const categoryWeights: Record<string, any> = {
        'Sales': { clarity: 1.1, structure: 0.9, specificity: 1.2, pacing: 1.0, presence: 1.1 },
        'Consulting': { clarity: 1.0, structure: 1.2, specificity: 1.1, pacing: 0.9, presence: 1.0 },
        'Leadership': { clarity: 1.0, structure: 1.0, specificity: 0.9, pacing: 1.0, presence: 1.2 },
        'Interviews': { clarity: 1.1, structure: 1.1, specificity: 1.0, pacing: 0.9, presence: 1.1 },
        'Explain a Concept': { clarity: 1.2, structure: 1.1, specificity: 1.1, pacing: 1.0, presence: 0.9 },
        'Custom': { clarity: 1.0, structure: 1.0, specificity: 1.0, pacing: 1.0, presence: 1.0 }
      };

      const weights = categoryWeights[category] || categoryWeights['Custom'];

      // Calculate base scores with weights
      let clarity = Math.round((baseScore + variation()) * weights.clarity);
      let structure = Math.round((baseScore + variation()) * weights.structure);
      let specificity = Math.round((baseScore + variation()) * weights.specificity);
      let pacing = Math.round((baseScore + variation()) * weights.pacing);
      let presence = Math.round((baseScore + variation()) * weights.presence);

      // EVIDENCE-BASED PENALTIES (make scoring honest)
      
      // Penalty for filler words
      if (fillerRatio > 0.15) {
        presence -= 15;
        clarity -= 8;
      }
      if (fillerRatio > 0.2) {
        presence -= 10; // Additional penalty
        clarity -= 7;
      }
      
      // Penalty for lack of structure
      if (!hasStrongOpening) {
        structure -= 12;
        clarity -= 5;
      }
      if (!hasActionableClosing) {
        structure -= 10;
      }
      
      // Penalty for lack of specificity
      if (!hasConcreteExamples) {
        specificity -= 15;
      }
      
      // Penalty for short content
      if (wordCount < 80) {
        clarity -= 10;
        structure -= 10;
        specificity -= 10;
      }
      if (wordCount < 60) {
        clarity -= 15; // Additional penalty
        structure -= 15;
        specificity -= 15;
      }
      
      // Penalty for poor pacing (too fast or too slow)
      const wordsPerMinute = (wordCount / duration) * 60;
      if (wordsPerMinute < 90 || wordsPerMinute > 200) {
        pacing -= 15;
      }
      
      // CAP SCORES FOR LOW CONFIDENCE REPS
      if (scoreConfidence === "low") {
        clarity = Math.min(clarity, 60);
        structure = Math.min(structure, 60);
        specificity = Math.min(specificity, 60);
        pacing = Math.min(pacing, 60);
        presence = Math.min(presence, 60);
      }
      
      if (scoreConfidence === "medium") {
        clarity = Math.min(clarity, 75);
        structure = Math.min(structure, 75);
        specificity = Math.min(specificity, 75);
        pacing = Math.min(pacing, 75);
        presence = Math.min(presence, 75);
      }

      // Enforce reasonable bounds (35-95 instead of 45-95)
      clarity = Math.max(35, Math.min(95, clarity));
      structure = Math.max(35, Math.min(95, structure));
      specificity = Math.max(35, Math.min(95, specificity));
      pacing = Math.max(35, Math.min(95, pacing));
      presence = Math.max(35, Math.min(95, presence));

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        (clarity * 0.2) +
        (structure * 0.25) +
        (specificity * 0.2) +
        (pacing * 0.15) +
        (presence * 0.2)
      );

      // Framework coverage (based on structure score and evidence)
      const frameworkCoveragePercentage = Math.max(30, Math.min(100, structure + (hasStrongOpening ? 10 : -10)));

      // GENERATE HONEST STRENGTHS (only if truly supported)
      const strengths: string[] = [];
      if (clarity >= 70) strengths.push("Clear message delivery");
      if (structure >= 70) strengths.push("Followed framework structure");
      if (specificity >= 70) strengths.push("Used concrete examples");
      if (pacing >= 70) strengths.push("Good pacing and rhythm");
      if (presence >= 70) strengths.push("Confident delivery");
      
      // If nothing is strong, say so
      if (strengths.length === 0) {
        strengths.push("Not enough clear content to identify strengths yet.");
      }

      // GENERATE HONEST WEAKNESSES
      const weaknesses: string[] = [];
      if (fillerRatio > 0.15) weaknesses.push(`Too many filler words (${fillerWordCount} instances)`);
      if (!hasStrongOpening) weaknesses.push("Weak opening — didn't state main point upfront");
      if (!hasActionableClosing) weaknesses.push("No clear closing or next step");
      if (!hasConcreteExamples) weaknesses.push("Lacked specific examples or numbers");
      if (wordCount < 80) weaknesses.push("Too brief — not enough content to demonstrate structure");

      // GENERATE SPECIFIC ACTIONS (concrete, not vague)
      const specificActions: string[] = [];
      
      // Find the lowest dimension
      const lowestScore = Math.min(clarity, structure, specificity, pacing, presence);
      
      if (lowestScore === clarity) {
        specificActions.push("State your main point in the first 10 seconds");
        specificActions.push("Remove all instances of 'I think maybe' and 'kind of'");
      } else if (lowestScore === structure) {
        specificActions.push("Say each framework step name out loud before explaining it");
        specificActions.push("End with 'Next step is...' followed by one action");
      } else if (lowestScore === specificity) {
        specificActions.push("Add one concrete example with numbers in the middle");
        specificActions.push("Replace 'things' and 'stuff' with specific nouns");
      } else if (lowestScore === pacing) {
        specificActions.push("Pause for 2 seconds between framework sections");
        specificActions.push("Slow down during the middle 30 seconds");
      } else {
        specificActions.push(`Replace "${fillerWords[0]}" with a 2-second pause`);
        specificActions.push("Record standing up with your shoulders back");
      }

      // BETTER VERSION SAMPLE (short, specific to the scenario)
      const betterVersionSample = "The problem is teams can't communicate under pressure. This costs us 15 hours per week in rework. I recommend daily 5-minute practice sessions starting Monday.";

      const feedback: DetailedFeedback = {
        overallScore,
        detailedScores: {
          clarity,
          structure,
          specificity,
          pacing,
          presence
        },
        analysisMetrics: {
          fillerWordCount,
          wordCount,
          hasStrongOpening,
          hasActionableClosing,
          frameworkCoveragePercentage
        },
        primaryFocus: generatePrimaryFocus(repCount),
        scoreConfidence,
        strengths: strengths.slice(0, 2), // Max 2
        weaknesses,
        specificActions,
        betterVersionSample
      };

      resolve(feedback);
    }, 1000); // Simulate 1 second processing
  });
}
