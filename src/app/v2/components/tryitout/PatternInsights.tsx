import { TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { Rep } from "../../types/rep";

interface PatternInsightsProps {
  reps: Rep[];
}

export function PatternInsights({ reps }: PatternInsightsProps) {
  if (reps.length < 3) {
    return null; // Need at least 3 reps to detect patterns
  }

  const insights: Array<{ type: "positive" | "negative" | "neutral"; text: string }> = [];

  // Analyze pacing patterns
  const shortReps = reps.filter(r => r.timeConstraint <= 60);
  if (shortReps.length >= 2) {
    const avgPacingShort = shortReps.reduce((sum, r) => sum + (r.detailedScores?.pacing || 0), 0) / shortReps.length;
    if (avgPacingShort < 60) {
      insights.push({
        type: "negative",
        text: "Your pacing score drops under 60 seconds—practice using the full time constraint."
      });
    }
  }

  // Analyze clarity with structured frameworks
  const structuredReps = reps.filter(r => r.framework !== "free-form");
  const freeformReps = reps.filter(r => r.framework === "free-form");
  
  if (structuredReps.length >= 2 && freeformReps.length >= 1) {
    const avgClarityStructured = structuredReps.reduce((sum, r) => sum + (r.detailedScores?.clarity || r.clarityScore), 0) / structuredReps.length;
    const avgClarityFreeform = freeformReps.reduce((sum, r) => sum + (r.detailedScores?.clarity || r.clarityScore), 0) / freeformReps.length;
    
    if (avgClarityStructured > avgClarityFreeform + 10) {
      insights.push({
        type: "positive",
        text: "Clarity improves by 10+ points when using structured frameworks—keep using them."
      });
    }
  }

  // Analyze filler words by scenario
  const interviewReps = reps.filter(r => r.scenarioCategory.toLowerCase().includes("interview"));
  if (interviewReps.length >= 2) {
    const avgFillerInterview = interviewReps.reduce((sum, r) => sum + (r.analysisMetrics?.fillerWordCount || 0), 0) / interviewReps.length;
    const avgFillerOther = reps.filter(r => !r.scenarioCategory.toLowerCase().includes("interview"))
      .reduce((sum, r) => sum + (r.analysisMetrics?.fillerWordCount || 0), 0) / (reps.length - interviewReps.length || 1);
    
    if (avgFillerInterview > avgFillerOther + 2) {
      insights.push({
        type: "negative",
        text: "Filler words increase in interview scenarios—practice pausing instead of filling silence."
      });
    }
  }

  // Analyze specificity patterns
  const recentReps = reps.slice(0, 3);
  const avgSpecificity = recentReps.reduce((sum, r) => sum + (r.detailedScores?.specificity || 0), 0) / recentReps.length;
  if (avgSpecificity < 65) {
    insights.push({
      type: "neutral",
      text: "Recent reps lack concrete examples—add numbers and specific outcomes in your next session."
    });
  }

  // Analyze improvement trend
  if (reps.length >= 5) {
    const recentScores = reps.slice(0, 3).map(r => {
      if (r.detailedScores) {
        return Math.round(
          (r.detailedScores.clarity * 0.2) +
          (r.detailedScores.structure * 0.25) +
          (r.detailedScores.specificity * 0.25) +
          (r.detailedScores.pacing * 0.15) +
          (r.detailedScores.presence * 0.15)
        );
      }
      return r.clarityScore || 0;
    });
    
    const olderScores = reps.slice(3, 6).map(r => {
      if (r.detailedScores) {
        return Math.round(
          (r.detailedScores.clarity * 0.2) +
          (r.detailedScores.structure * 0.25) +
          (r.detailedScores.specificity * 0.25) +
          (r.detailedScores.pacing * 0.15) +
          (r.detailedScores.presence * 0.15)
        );
      }
      return r.clarityScore || 0;
    });

    const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const avgOlder = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;

    if (avgRecent > avgOlder + 5) {
      insights.push({
        type: "positive",
        text: `Your average score improved by ${Math.round(avgRecent - avgOlder)} points in recent reps—momentum is building.`
      });
    } else if (avgRecent < avgOlder - 5) {
      insights.push({
        type: "negative",
        text: "Scores have plateaued or declined—try different scenarios to break the pattern."
      });
    }
  }

  // Analyze presence improvement
  const repsWithPresence = reps.filter(r => r.detailedScores?.presence);
  if (repsWithPresence.length >= 3) {
    const recentPresence = repsWithPresence.slice(0, 2).reduce((sum, r) => sum + (r.detailedScores?.presence || 0), 0) / 2;
    if (recentPresence >= 80) {
      insights.push({
        type: "positive",
        text: "Presence scores are strong—your delivery has become more confident and direct."
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: "neutral",
      text: "Complete more reps to unlock pattern insights and personalized recommendations."
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Recurring Patterns</h2>
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div 
            key={index}
            className={`flex items-start gap-3 p-4 rounded-lg border ${
              insight.type === "positive" 
                ? "bg-green-50 border-green-200" 
                : insight.type === "negative"
                ? "bg-red-50 border-red-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            {insight.type === "positive" && <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
            {insight.type === "negative" && <TrendingDown className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            {insight.type === "neutral" && <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />}
            <p className="text-sm text-gray-700 leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Insights are generated based on your performance patterns across multiple reps.
      </p>
    </div>
  );
}
