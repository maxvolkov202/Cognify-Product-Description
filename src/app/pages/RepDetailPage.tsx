import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Calendar, User, BookOpen, PlayCircle, Target, ChevronDown, ChevronUp } from "lucide-react";
import { Rep } from "../types/rep";
import { format } from "date-fns";
import { FRAMEWORKS } from "../types/rep";

interface RepDetailPageProps {
  reps: Rep[];
}

export function RepDetailPage({ reps }: RepDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contentExpanded, setContentExpanded] = useState(true);

  const rep = reps.find(r => r.id === id);

  if (!rep) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Rep Not Found</h2>
          <p className="text-gray-600 mb-6">This rep doesn't exist or has been deleted.</p>
          <Link
            to="/app/history"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  // Handle processing/error states
  if (rep.status === "error") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Failed</h2>
          <p className="text-gray-600 mb-4">This rep couldn't be processed.</p>
          <Link
            to="/app/history"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  const scores = rep.detailedScores || {
    clarity: rep.clarityScore,
    structure: rep.clarityScore,
    brevity: rep.clarityScore,
    confidence: rep.clarityScore
  };

  const overallScore = rep.clarityScore;

  const performanceLabel =
    overallScore >= 90 ? "Elite" :
    overallScore >= 75 ? "Strong" :
    overallScore >= 60 ? "Developing" :
    "Needs Work";

  const performanceColor =
    overallScore >= 90 ? "text-green-700 bg-green-50 border-green-200" :
    overallScore >= 75 ? "text-blue-700 bg-blue-50 border-blue-200" :
    overallScore >= 60 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
    "text-red-700 bg-red-50 border-red-200";

  const framework = FRAMEWORKS.find(f => f.id === rep.framework);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/app/history")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{rep.scenario}</h1>
      </div>

      {/* Overall Score Card */}
      <div className="bg-gradient-to-br from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 border border-[#9D7BF5]/30 rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-1">OVERALL SCORE</h2>
            <div className="flex items-baseline gap-3">
              <div className="text-6xl font-bold text-gray-900">{overallScore}</div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${performanceColor}`}>
                {performanceLabel}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">
              {format(new Date(rep.completedAt), "MMM d, yyyy")}
            </div>
            <div className="text-xs text-gray-500">
              {format(new Date(rep.completedAt), "h:mm a")}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Dimensions - Compact Layout */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">4 CORE DIMENSIONS</h3>
        <div className="grid grid-cols-4 gap-4">
          <DimensionCard
            title="Clarity"
            score={scores.clarity}
            insight="Direct language"
            color="blue"
          />
          <DimensionCard
            title="Structure"
            score={scores.structure}
            insight="Logical flow"
            color="purple"
          />
          <DimensionCard
            title="Brevity"
            score={scores.brevity}
            insight="Conciseness"
            color="pink"
          />
          <DimensionCard
            title="Confidence"
            score={scores.confidence}
            insight="Strong voice"
            color="green"
          />
        </div>
      </div>

      {/* Rep Content Section (Collapsible) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <button
          onClick={() => setContentExpanded(!contentExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold text-gray-900">YOUR REP</h3>
          {contentExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {contentExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Point</p>
              <p className="text-sm text-gray-900 leading-relaxed">{rep.repContent.point}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Example</p>
              <p className="text-sm text-gray-900 leading-relaxed">{rep.repContent.example}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Meaning</p>
              <p className="text-sm text-gray-900 leading-relaxed">{rep.repContent.meaning}</p>
            </div>
            {rep.analysisMetrics && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-6 text-xs text-gray-600">
                <span>Words: {rep.analysisMetrics.wordCount}</span>
                {rep.analysisMetrics.hasAllFields && (
                  <span className="text-green-600">✓ All fields complete</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pre-Rep Intent */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">PRE-REP INTENT</h3>
        <p className="text-sm text-gray-700">{rep.preRepIntent}</p>
      </div>

      {/* Improvement Focus Section */}
      <div className="bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-3">
          <Target className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-orange-900 mb-2">NEXT REP FOCUS</h3>
            <h4 className="text-lg font-bold text-gray-900 mb-2">{rep.primaryFocus.title}</h4>
            <p className="text-sm text-gray-700">{rep.primaryFocus.nextStep}</p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">SESSION DETAILS</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <User className="w-4 h-4" />
              <span>Audience</span>
            </div>
            <div className="font-medium text-gray-900">{rep.audience}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Framework</span>
            </div>
            <div className="font-medium text-gray-900">{framework?.name || rep.framework}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <PlayCircle className="w-4 h-4" />
              <span>Rep Type</span>
            </div>
            <div className="font-medium text-gray-900 capitalize">{rep.repType.replace('-', ' ')}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span>Category</span>
            </div>
            <div className="font-medium text-gray-900">{rep.scenarioCategory}</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-3">
        <Link
          to="/app/rep"
          className="flex-1 px-6 py-3 bg-gradient-to-r from-[#5CB3FF] to-[#9D7BF5] text-white rounded-lg font-medium text-center hover:shadow-lg transition-all"
        >
          Do Another Rep
        </Link>
        <button
          onClick={() => navigate("/app/history")}
          className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          View All Reps
        </button>
      </div>
    </div>
  );
}

interface DimensionCardProps {
  title: string;
  score: number;
  insight: string;
  color: "blue" | "purple" | "pink" | "green" | "orange";
}

function DimensionCard({ title, score, insight, color }: DimensionCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    purple: "bg-purple-50 border-purple-200 text-purple-900",
    pink: "bg-pink-50 border-pink-200 text-pink-900",
    green: "bg-green-50 border-green-200 text-green-900",
    orange: "bg-orange-50 border-orange-200 text-orange-900"
  };

  const scoreColor = 
    score >= 80 ? "text-green-700" :
    score >= 65 ? "text-blue-700" :
    score >= 50 ? "text-yellow-700" :
    "text-red-700";

  return (
    <div className={`rounded-lg border p-4 text-center ${colorClasses[color]}`}>
      <div className={`text-3xl font-bold mb-1 ${scoreColor}`}>{score}</div>
      <div className="text-xs font-semibold mb-1">{title}</div>
      <div className="text-xs opacity-80 leading-tight">{insight}</div>
    </div>
  );
}
