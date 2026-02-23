// Analyze transcript for specific communication issues
export interface TranscriptAnalysis {
  fillerWordCount: number;
  fillerWords: string[];
  hedgingPhrases: string[];
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  hasStrongOpening: boolean;
  hasActionableClosing: boolean;
  jargonDetected: string[];
  repetitiveWords: string[];
  confidenceIssues: string[];
}

export interface FrameworkComponentStatus {
  component: string;
  covered: boolean;
  confidence: "high" | "partial" | "missing";
  evidence?: string; // Sample text showing coverage
}

export interface FrameworkCoverageAnalysis {
  framework: string;
  components: FrameworkComponentStatus[];
  coveragePercentage: number;
  structureScore: number; // 0-100
}

export function analyzeTranscript(transcript: string): TranscriptAnalysis {
  const fillerWordList = ['um', 'uh', 'like', 'you know', 'i mean', 'basically', 'actually', 'sort of', 'kind of'];
  const hedgingList = ['maybe', 'probably', 'i think', 'i guess', 'perhaps', 'possibly', 'might', 'could be'];
  const jargonList = ['synergy', 'leverage', 'paradigm', 'bandwidth', 'circle back', 'touch base', 'deep dive'];
  const confidenceIssuesList = ['just', 'sorry', 'does that make sense', 'if that makes sense', 'right?'];
  
  const lowerTranscript = transcript.toLowerCase();
  const words = transcript.split(/\s+/);
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Count filler words
  const foundFillers: string[] = [];
  fillerWordList.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = transcript.match(regex);
    if (matches) {
      foundFillers.push(...matches.map(m => m.toLowerCase()));
    }
  });
  
  // Count hedging phrases
  const foundHedging: string[] = [];
  hedgingList.forEach(hedge => {
    const regex = new RegExp(`\\b${hedge}\\b`, 'gi');
    const matches = transcript.match(regex);
    if (matches) {
      foundHedging.push(...matches.map(m => m.toLowerCase()));
    }
  });
  
  // Detect jargon
  const foundJargon: string[] = [];
  jargonList.forEach(jargon => {
    if (lowerTranscript.includes(jargon.toLowerCase())) {
      foundJargon.push(jargon);
    }
  });
  
  // Detect confidence issues
  const foundConfidenceIssues: string[] = [];
  confidenceIssuesList.forEach(phrase => {
    if (lowerTranscript.includes(phrase.toLowerCase())) {
      foundConfidenceIssues.push(phrase);
    }
  });
  
  // Find repetitive words (used 3+ times, excluding common words)
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were', 'we', 'our', 'this', 'that'];
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length > 3 && !commonWords.includes(clean)) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  });
  const repetitive = Object.entries(wordFreq)
    .filter(([_, count]) => count >= 3)
    .map(([word, _]) => word);
  
  // Check opening strength
  const firstSentence = sentences[0]?.trim().toLowerCase() || '';
  const weakOpenings = ['so', 'well', 'um', 'basically', 'i want to', 'i\'d like to', 'let me'];
  const hasStrongOpening = !weakOpenings.some(weak => firstSentence.startsWith(weak));
  
  // Check closing strength
  const lastSentence = sentences[sentences.length - 1]?.trim().toLowerCase() || '';
  const actionWords = ['should', 'will', 'must', 'need to', 'recommend', 'propose', 'next step'];
  const hasActionableClosing = actionWords.some(action => lastSentence.includes(action));
  
  return {
    fillerWordCount: foundFillers.length,
    fillerWords: [...new Set(foundFillers)],
    hedgingPhrases: [...new Set(foundHedging)],
    wordCount: words.filter(w => w.length > 0).length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    hasStrongOpening,
    hasActionableClosing,
    jargonDetected: foundJargon,
    repetitiveWords: repetitive,
    confidenceIssues: foundConfidenceIssues
  };
}

export function generateCriticalFeedback(
  analysis: TranscriptAnalysis, 
  framework: string,
  repType: "cold-start" | "improvement" = "cold-start"
): {
  clarity: { score: number; feedback: string };
  structure: { score: number; feedback: string };
  simplicity: { score: number; feedback: string };
  pacing: { score: number; feedback: string };
  confidence: { score: number; feedback: string };
  overallScore: number;
  primaryFocus: { title: string; explanation: string; nextStep: string };
  repType: "cold-start" | "improvement";
} {
  // CLARITY SCORE
  let clarityScore = 85;
  let clarityFeedback = repType === "cold-start" 
    ? "Core message was understandable." 
    : "Message clarity maintained from previous attempt.";
  
  if (!analysis.hasStrongOpening) {
    clarityScore -= 15;
    clarityFeedback = repType === "cold-start"
      ? "Opening was unclear. Started with filler/preamble instead of the core point."
      : "Opening still weak. Lead with your main point, not setup.";
  }
  if (analysis.avgWordsPerSentence > 25) {
    clarityScore -= 10;
    clarityFeedback = repType === "cold-start"
      ? "Sentences ran long, making it harder to follow your point."
      : "Sentences still running long. Break them down—one idea per sentence.";
  }
  if (analysis.repetitiveWords.length > 2) {
    clarityScore -= 8;
    clarityFeedback = `Repeated "${analysis.repetitiveWords[0]}" too often, creating confusion.`;
  }
  
  // STRUCTURE SCORE
  let structureScore = 80;
  let structureFeedback = repType === "cold-start"
    ? "Logical flow was present."
    : "Structure improved—ideas connected better.";
  
  if (!analysis.hasStrongOpening) {
    structureScore -= 12;
    structureFeedback = repType === "cold-start"
      ? "No clear setup. Listener doesn't know where you're going."
      : "Opening structure needs work. State your roadmap upfront.";
  }
  if (!analysis.hasActionableClosing) {
    structureScore -= 15;
    structureFeedback = repType === "cold-start"
      ? "Ending lacked direction. No clear takeaway or next step."
      : "Still missing strong close. End with specific next steps.";
  }
  if (analysis.sentenceCount < 3) {
    structureScore -= 10;
    structureFeedback = "Too compressed. Didn't develop the idea enough.";
  }
  
  // SIMPLICITY SCORE
  let simplicityScore = 82;
  let simplicityFeedback = "Language was mostly accessible.";
  
  if (analysis.jargonDetected.length > 0) {
    simplicityScore -= 18;
    simplicityFeedback = `Business jargon detected: "${analysis.jargonDetected[0]}". Use plain language.`;
  }
  if (analysis.avgWordsPerSentence > 30) {
    simplicityScore -= 12;
    simplicityFeedback = "Overly complex sentences. Break ideas into shorter, punchier statements.";
  }
  
  // PACING SCORE
  let pacingScore = 78;
  let pacingFeedback = "Time management was acceptable.";
  
  if (analysis.wordCount < 50) {
    pacingScore -= 20;
    pacingFeedback = "Too brief. Didn't use available time to develop the idea fully.";
  }
  if (analysis.wordCount > 180) {
    pacingScore -= 15;
    pacingFeedback = "Over-explained. Edit ruthlessly—every word should earn its place.";
  }
  if (!analysis.hasStrongOpening) {
    pacingScore -= 10;
    pacingFeedback = "Wasted opening seconds on setup instead of substance.";
  }
  
  // CONFIDENCE SCORE
  let confidenceScore = 75;
  let confidenceFeedback = repType === "cold-start"
    ? "Delivery showed some conviction."
    : "Confidence level maintained—keep building.";
  
  if (analysis.fillerWordCount > 5) {
    confidenceScore -= 20;
    confidenceFeedback = repType === "cold-start"
      ? `${analysis.fillerWordCount} filler words undermine authority. Pause instead.`
      : `Still ${analysis.fillerWordCount} fillers. Focus: pause when you feel "um" coming.`;
  }
  if (analysis.hedgingPhrases.length > 2) {
    confidenceScore -= 18;
    confidenceFeedback = repType === "cold-start"
      ? `Hedging language ("${analysis.hedgingPhrases[0]}") weakens your position. Own your point.`
      : `Hedging persists. Replace "I think" with direct statements.`;
  }
  if (analysis.confidenceIssues.length > 0) {
    confidenceScore -= 15;
    confidenceFeedback = `Asking "does that make sense?" signals doubt. Trust your explanation.`;
  }
  
  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    (clarityScore * 0.25) + 
    (structureScore * 0.20) + 
    (simplicityScore * 0.15) + 
    (pacingScore * 0.20) + 
    (confidenceScore * 0.20)
  );
  
  // Determine PRIMARY FOCUS (most critical weakness)
  const isColdStart = repType === "cold-start";
  
  const scores = [
    { 
      dimension: 'clarity', 
      score: clarityScore, 
      title: 'Lead With Your Point', 
      explanation: isColdStart 
        ? 'You buried your core message. In professional settings, state your position in the first sentence, then explain why.'
        : "You're still burying the lead. This is your focus: state the conclusion first, then build support.",
      nextStep: isColdStart 
        ? 'Open with your conclusion, not your setup.'
        : 'Next rep: Say your main point in the first 5 words.'
    },
    { 
      dimension: 'structure', 
      score: structureScore, 
      title: 'Build a Clear Arc', 
      explanation: isColdStart
        ? 'Your ideas felt scattered or incomplete. Strong communicators use frameworks to guide listeners from problem to solution.'
        : "Structure is still your gap. Apply the framework step-by-step—don't skip or blur sections.",
      nextStep: isColdStart
        ? 'Follow your framework explicitly: state each section as you enter it.'
        : 'Next rep: Verbally signal each framework section ("First, the problem...")'
    },
    { 
      dimension: 'simplicity', 
      score: simplicityScore, 
      title: 'Cut the Jargon', 
      explanation: isColdStart
        ? 'Business-speak creates distance. The best communicators explain complex ideas using simple, concrete language.'
        : 'Jargon persists. Simplicity is a discipline—choose words your audience uses, not industry buzzwords.',
      nextStep: isColdStart
        ? 'Replace abstract terms with specific examples.'
        : 'Next rep: Replace every abstract word with a concrete example.'
    },
    { 
      dimension: 'pacing', 
      score: pacingScore, 
      title: 'Manage Your Time', 
      explanation: isColdStart
        ? 'You either rushed or over-explained. Constraints force clarity—use them to prioritize what matters most.'
        : 'Time management still off. Cut ruthlessly—every second must advance your argument.',
      nextStep: isColdStart
        ? 'Allocate time: 20% setup, 60% core content, 20% close.'
        : 'Next rep: Practice the 20-60-20 split (setup-core-close).'
    },
    { 
      dimension: 'confidence', 
      score: confidenceScore, 
      title: 'Eliminate Verbal Noise', 
      explanation: isColdStart
        ? `${analysis.fillerWordCount} fillers ("um", "like") and hedging phrases weaken your message. Silence is more powerful than noise.`
        : `Fillers dropped but still ${analysis.fillerWordCount} instances. Your focus is clear: replace filler with breath.`,
      nextStep: isColdStart
        ? 'When you feel "um" coming, pause for a full second instead.'
        : 'Next rep: Breathe before speaking. Count to 1 when you feel a filler.'
    }
  ];
  
  // Sort by lowest score to find weakest area
  scores.sort((a, b) => a.score - b.score);
  const primaryFocus = scores[0];
  
  return {
    clarity: { score: clarityScore, feedback: clarityFeedback },
    structure: { score: structureScore, feedback: structureFeedback },
    simplicity: { score: simplicityScore, feedback: simplicityFeedback },
    pacing: { score: pacingScore, feedback: pacingFeedback },
    confidence: { score: confidenceScore, feedback: confidenceFeedback },
    overallScore,
    repType,
    primaryFocus: {
      title: primaryFocus.title,
      explanation: primaryFocus.explanation,
      nextStep: primaryFocus.nextStep
    }
  };
}

// Analyze how well the transcript covers the selected framework components
export function analyzeFrameworkCoverage(
  transcript: string,
  framework: string
): FrameworkCoverageAnalysis {
  const lowerTranscript = transcript.toLowerCase();
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Framework-specific keyword mappings
  const frameworkKeywords: Record<string, Record<string, string[]>> = {
    "problem-impact-solution": {
      "Problem": ["problem", "issue", "challenge", "difficulty", "struggle", "pain point", "obstacle"],
      "Impact": ["impact", "effect", "consequence", "result", "affects", "causes", "leads to", "means that"],
      "Solution": ["solution", "fix", "address", "resolve", "solve", "propose", "recommend", "approach"]
    },
    "situation-action-result": {
      "Situation": ["situation", "context", "scenario", "when", "faced with", "encountered", "background"],
      "Action": ["action", "did", "implemented", "executed", "took", "applied", "used", "created"],
      "Result": ["result", "outcome", "achieved", "led to", "produced", "generated", "success", "impact"]
    },
    "context-insight-recommendation": {
      "Context": ["context", "background", "currently", "situation", "landscape", "environment", "state"],
      "Insight": ["insight", "analysis", "found", "discovered", "learned", "realize", "shows that", "indicates"],
      "Recommendation": ["recommend", "suggest", "propose", "should", "need to", "must", "next step", "advise"]
    }
  };

  // For free-form, return empty analysis
  if (framework === "free-form" || !frameworkKeywords[framework]) {
    return {
      framework,
      components: [],
      coveragePercentage: 100,
      structureScore: 100
    };
  }

  const keywords = frameworkKeywords[framework];
  const components: FrameworkComponentStatus[] = [];

  // Analyze each component
  Object.entries(keywords).forEach(([component, keywordList]) => {
    let matchCount = 0;
    let evidence = "";
    let matchedKeywords: string[] = [];

    // Count keyword matches
    keywordList.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = transcript.match(regex);
      if (matches && matches.length > 0) {
        matchCount += matches.length;
        matchedKeywords.push(keyword);
        
        // Find sentence with this keyword for evidence
        if (!evidence) {
          const sentenceWithKeyword = sentences.find(s => 
            s.toLowerCase().includes(keyword)
          );
          if (sentenceWithKeyword) {
            const trimmed = sentenceWithKeyword.trim();
            // If sentence is short enough, show it all; otherwise truncate smartly
            if (trimmed.length <= 100) {
              evidence = trimmed;
            } else {
              // Find the keyword position and show context around it
              const keywordIndex = trimmed.toLowerCase().indexOf(keyword);
              const start = Math.max(0, keywordIndex - 30);
              const end = Math.min(trimmed.length, keywordIndex + keyword.length + 50);
              evidence = (start > 0 ? "..." : "") + trimmed.slice(start, end) + "...";
            }
          }
        }
      }
    });

    // Determine coverage confidence
    let confidence: "high" | "partial" | "missing";
    let covered: boolean;

    // Additional heuristics for detecting components without explicit keywords
    let contextualEvidence = false;
    
    // Check for component patterns even without direct keywords
    if (matchCount === 0) {
      // For "Problem" - look for negative descriptions or questions
      if (component === "Problem" && (
        lowerTranscript.includes("can't") || 
        lowerTranscript.includes("unable to") ||
        lowerTranscript.includes("struggling") ||
        lowerTranscript.includes("failing to")
      )) {
        matchCount += 0.5;
        contextualEvidence = true;
      }
      
      // For "Solution" - look for proposal language
      if (component === "Solution" && (
        lowerTranscript.includes("we can") || 
        lowerTranscript.includes("by using") ||
        lowerTranscript.includes("through") ||
        lowerTranscript.includes("would help")
      )) {
        matchCount += 0.5;
        contextualEvidence = true;
      }
      
      // For "Impact" - look for quantification or scale
      if (component === "Impact" && (
        /\d+%/.test(lowerTranscript) ||
        lowerTranscript.includes("significant") ||
        lowerTranscript.includes("major") ||
        lowerTranscript.includes("critical")
      )) {
        matchCount += 0.5;
        contextualEvidence = true;
      }
    }

    if (matchCount >= 2 || matchedKeywords.length >= 2) {
      confidence = "high";
      covered = true;
    } else if (matchCount >= 0.5 || matchedKeywords.length >= 1) {
      confidence = "partial";
      covered = true;
    } else {
      confidence = "missing";
      covered = false;
    }

    components.push({
      component,
      covered,
      confidence,
      evidence: covered ? evidence : undefined
    });
  });

  // Calculate coverage percentage
  const coveredCount = components.filter(c => c.covered).length;
  const totalCount = components.length;
  const coveragePercentage = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 100;

  // Calculate structure score (weighted by confidence)
  let structureScore = 0;
  components.forEach(c => {
    if (c.confidence === "high") structureScore += 100 / totalCount;
    else if (c.confidence === "partial") structureScore += 60 / totalCount;
    else structureScore += 0;
  });

  return {
    framework,
    components,
    coveragePercentage,
    structureScore: Math.round(structureScore)
  };
}
