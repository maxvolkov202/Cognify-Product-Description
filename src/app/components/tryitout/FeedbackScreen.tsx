import React from "react";
import { Target, TrendingUp, AlertCircle, FileText, Layers, CheckCircle2, AlertTriangle } from "lucide-react";
import { FRAMEWORKS, Rep } from "../../types/rep";
import { analyzeTranscript, analyzeFrameworkCoverage } from "../../../../app/utils/transcriptAnalyzer";
import { evaluateExecutiveCommunication } from "../../../../app/utils/executiveEvaluator";
import { DetailedAnalysis } from "./DetailedAnalysis";
import { RepCounter } from "./RepCounter";
import { FrameworkChecklist } from "./FrameworkChecklist";
import { RepComparison } from "./RepComparison";
import { compareReps } from "../../utils/repComparison";

interface FeedbackScreenProps {
  transcript: string;
  scenario: string;
  framework: string;
  audience: string;
  timeConstraint: number;
  totalPausedTime: number;
  repNumber: number;
  repType: "cold-start" | "improvement";
  previousRep?: Rep;
  onRunItBack: () => void;
  onFeedbackGenerated?: (score: number, focus: { title: string; nextStep: string }, detailedScores: any, analysisMetrics: any) => void;
}

export function FeedbackScreen({ 
  transcript, 
  scenario, 
  framework, 
  audience,
  timeConstraint,
  totalPausedTime,
  repNumber,
  repType,
  previousRep,
  onRunItBack,
  onFeedbackGenerated
}: FeedbackScreenProps) {
  // Analyze transcript and generate executive-level feedback
  const analysis = analyzeTranscript(transcript);
  const feedback = evaluateExecutiveCommunication(analysis, transcript, framework);
  const frameworkCoverage = analyzeFrameworkCoverage(transcript, framework);
  const selectedFramework = FRAMEWORKS.find(f => f.id === framework);
  
  // Use repNumber - 1 for rep count in feedback generation since we already incremented
  const repCount = repNumber - 1;
  
  const clarityScore = feedback.overallScore;
  
  // Prepare detailed data for storage
  const detailedScores = {
    clarity: feedback.clarity.score,
    structure: feedback.structure.score,
    specificity: feedback.specificity.score,
    pacing: feedback.pacing.score,
    presence: feedback.presence.score
  };

  const analysisMetrics = {
    fillerWordCount: analysis.fillerWordCount,
    wordCount: analysis.wordCount,
    hasStrongOpening: analysis.hasStrongOpening,
    hasActionableClosing: analysis.hasActionableClosing,
    frameworkCoveragePercentage: frameworkCoverage.coveragePercentage
  };

  // Create current rep object for comparison
  const currentRepData: Rep = {
    id: `rep-${Date.now()}`,
    scenario,
    scenarioCategory: "",
    audience,
    framework,
    timeConstraint,
    totalPausedTime,
    transcript,
    clarityScore,
    repType,
    primaryFocus: {
      title: primaryFocus.title,
      nextStep: primaryFocus.nextStep
    },
    completedAt: new Date(),
    detailedScores,
    analysisMetrics
  };

  // Compare with previous rep if available
  const comparison = previousRep ? compareReps(currentRepData, previousRep) : null;
  const scoreDelta = previousRep ? clarityScore - previousRep.clarityScore : 0;

  // Notify parent of generated feedback
  React.useEffect(() => {
    if (onFeedbackGenerated) {
      onFeedbackGenerated(clarityScore, {
        title: feedback.primaryFocus.dimension,
        nextStep: feedback.primaryFocus.instruction
      }, detailedScores, analysisMetrics);
    }
  }, []);

  const dimensionBreakdown = [
    { label: "Clarity", data: feedback.clarity },
    { label: "Structure", data: feedback.structure },
    { label: "Specificity", data: feedback.specificity },
    { label: "Pacing", data: feedback.pacing },
    { label: "Presence", data: feedback.presence }
  ];

  // Collect strengths from dimension feedback
  const strengths: string[] = [];
  dimensionBreakdown.forEach(dim => {
    if (dim.data.strength) {
      strengths.push(dim.data.strength);
    }
  });
  
  // With strict grading, no strengths is common - acknowledge the work
  if (strengths.length === 0) {
    strengths.push("Completed the rep—growth areas identified");
  }

  // Highlight issues in transcript
  const issueWords = [
    ...analysis.fillerWords,
    ...analysis.hedgingPhrases,
    ...analysis.confidenceIssues
  ];
  
  const highlightedTranscript = transcript.split(' ').map((word, i) => {
    const cleanWord = word.toLowerCase().replace(/[.,!?]/g, '');
    const isFiller = analysis.fillerWords.includes(cleanWord);
    const isHedging = analysis.hedgingPhrases.some(h => cleanWord.includes(h.replace(/\s/g, '')));
    const isConfidenceIssue = analysis.confidenceIssues.some(c => word.toLowerCase().includes(c));
    
    let className = "";
    if (isFiller) className = "bg-yellow-200 px-1 rounded";
    else if (isHedging) className = "bg-orange-200 px-1 rounded";
    else if (isConfidenceIssue) className = "bg-red-200 px-1 rounded";
    
    return (
      <span key={i} className={className}>
        {word}{' '}
      </span>
    );
  });

  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Rep-to-Rep Comparison - Show if there's a previous rep */}
        {comparison && repNumber > 1 && (
          <RepComparison 
            comparison={comparison} 
            repNumber={repNumber}
            scoreDelta={scoreDelta}
          />
        )}

        {/* Rep Counter and Summary */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Rep Counter */}
          <div className="md:w-48 flex-shrink-0">
            <RepCounter repNumber={repNumber} variant="default" />
          </div>

          {/* Rep Summary */}
          <div className="flex-1 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-2xl p-6 border border-[#9D7BF5]/30">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Scenario:</p>
                  <p className="text-xl font-bold">{scenario}</p>
                </div>
                {/* Rep Type Badge */}
                <div className={`px-3 py-1 rounded-lg text-xs font-medium ml-auto ${
                  repType === "cold-start" 
                    ? "bg-blue-100 text-blue-700 border border-blue-200" 
                    : "bg-green-100 text-green-700 border border-green-200"
                }`}>
                  {repType === "cold-start" ? "Cold Start" : "Improvement Rep"}
                </div>
              </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-gray-600">Audience: </span>
                <span className="font-medium">{audience}</span>
              </div>
              {selectedFramework && (
                <div>
                  <span className="text-gray-600">Framework: </span>
                  <span className="font-medium">{selectedFramework.name}</span>
                </div>
              )}
              <div>
                <span className="text-gray-600">Time limit: </span>
                <span className="font-medium">{timeConstraint}s</span>
              </div>
              {totalPausedTime > 0 && (
                <div>
                  <span className="text-gray-600">Time paused: </span>
                  <span className="font-medium">{totalPausedTime}s</span>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>



        {/* Primary Focus */}
        <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-2xl p-8 border-2 border-[#9D7BF5]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  Primary Focus for Next Rep
                </p>
                <h2 className="text-2xl font-bold text-gray-900 capitalize">{feedback.primaryFocus.dimension}</h2>
              </div>

              <div className="bg-white rounded-xl p-5 border border-[#9D7BF5]/30">
                <p className="text-sm font-medium text-[#9D7BF5] mb-2">
                  Specific instruction:
                </p>
                <p className="text-base font-medium text-gray-900 leading-relaxed">{feedback.primaryFocus.instruction}</p>
                
                {/* Rep-specific guidance */}
                {repType === "improvement" && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      <strong>Note:</strong> Progress isn't linear. This focus targets your highest-leverage improvement area.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Score */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-[#9D7BF5]" />
            <h3 className="text-2xl font-bold">Performance Score</h3>
          </div>

          <div className="mb-8">
            <div className="flex items-end gap-3 mb-2">
              <span className="text-5xl font-bold">{clarityScore}</span>
              <span className="text-2xl text-gray-500 mb-1">/ 100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${
                  clarityScore >= 90 
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                    : clarityScore >= 75 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : clarityScore >= 60
                    ? 'bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1]'
                    : clarityScore >= 40
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                    : 'bg-gradient-to-r from-red-500 to-orange-500'
                }`}
                style={{ width: `${clarityScore}%` }}
              />
            </div>
            <p className="text-base font-medium text-gray-800 mt-3">
              {feedback.overallDiagnostic}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {repType === "cold-start" 
                ? (clarityScore >= 75 
                    ? "Strong baseline with clear areas for refinement"
                    : clarityScore >= 60
                    ? "Competent baseline with identifiable improvement areas"
                    : clarityScore >= 40
                    ? "Developing baseline—focus on fundamentals first"
                    : "Baseline established—significant development needed")
                : (clarityScore >= 75 
                    ? "Strong improvement from previous rep"
                    : clarityScore >= 60
                    ? "Progress made—continue focusing on primary gaps"
                    : "Building the skill through repetition")}
            </p>
          </div>

          <div className="space-y-4">
            {dimensionBreakdown.map((item, i) => (
              <div 
                key={i} 
                className={`rounded-xl border-2 p-4 ${
                  item.data.score >= 75 
                    ? 'border-green-500/30 bg-green-50/30' 
                    : item.data.score >= 60 
                    ? 'border-blue-500/30 bg-blue-50/30' 
                    : item.data.score >= 40
                    ? 'border-orange-500/30 bg-orange-50/30'
                    : 'border-red-500/30 bg-red-50/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{item.label}</span>
                  <span className={`text-lg font-bold ${
                    item.data.score >= 75 
                      ? 'text-green-600' 
                      : item.data.score >= 60 
                      ? 'text-blue-600' 
                      : item.data.score >= 40
                      ? 'text-orange-600'
                      : 'text-red-600'
                  }`}>
                    {item.data.score}
                  </span>
                </div>
                
                {item.data.strength && (
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700 leading-relaxed">{item.data.strength}</p>
                  </div>
                )}
                
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 leading-relaxed">{item.data.weakness}</p>
                </div>
                
                <p className="text-xs text-gray-600 mt-2 pl-6 italic">{item.data.reasoning}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Analysis */}
        <DetailedAnalysis analysis={analysis} />

        {/* Framework Coverage Checklist */}
        <FrameworkChecklist 
          coverage={frameworkCoverage}
          frameworkName={selectedFramework?.name || framework}
        />

        {/* What Worked */}
        {strengths.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-2xl font-bold">What Worked</h3>
            </div>

            <div className="space-y-3">
              {strengths.map((strength, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full mt-2.5"></div>
                  <p className="text-gray-700">{strength}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-gray-600" />
            <h3 className="text-2xl font-bold">Your Transcript</h3>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 leading-relaxed">
            <p className="text-gray-800">
              {highlightedTranscript}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            {analysis.fillerWords.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 rounded"></div>
                <span>Filler words ({analysis.fillerWordCount})</span>
              </div>
            )}
            {analysis.hedgingPhrases.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-200 rounded"></div>
                <span>Hedging phrases ({analysis.hedgingPhrases.length})</span>
              </div>
            )}
            {analysis.confidenceIssues.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-200 rounded"></div>
                <span>Confidence issues ({analysis.confidenceIssues.length})</span>
              </div>
            )}
          </div>
          
          {/* Additional analysis insights */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">Word count</p>
              <p className="font-semibold text-gray-900">{analysis.wordCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sentences</p>
              <p className="font-semibold text-gray-900">{analysis.sentenceCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Avg words/sentence</p>
              <p className={`font-semibold ${analysis.avgWordsPerSentence > 25 ? 'text-orange-600' : 'text-gray-900'}`}>
                {Math.round(analysis.avgWordsPerSentence)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Filler rate</p>
              <p className={`font-semibold ${analysis.fillerWordCount > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                {analysis.wordCount > 0 ? Math.round((analysis.fillerWordCount / analysis.wordCount) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Run It Back Button */}
        <div className="text-center space-y-4 pt-8">
          <p className="text-sm text-gray-600">
            Clarity is trainable.
          </p>
          
          <button
            onClick={onRunItBack}
            className="px-12 py-5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-2xl text-xl font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
          >
            Run it back
          </button>

          <p className="text-sm text-gray-500">
            Progress comes from repetition.
          </p>
        </div>
      </div>
    </section>
  );
}
