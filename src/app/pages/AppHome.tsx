import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, Flame, BarChart3, Target, ArrowRight, TrendingDown, Minus } from "lucide-react";
import { Rep } from "../types/rep";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { CognifyHeroLogo } from "../../components/branding/CognifyHeroLogo";

interface AppHomeProps {
  reps: Rep[];
}

export function AppHome({ reps }: AppHomeProps) {
  const navigate = useNavigate();
  // Calculate stats
  const totalReps = reps.length;
  
  // Calculate overall score (weighted average across all dimensions)
  const calculateOverallScore = (rep: Rep) => {
    if (rep.detailedScores) {
      return Math.round(
        (rep.detailedScores.clarity * 0.2) +
        (rep.detailedScores.structure * 0.25) +
        (rep.detailedScores.specificity * 0.2) +
        (rep.detailedScores.pacing * 0.15) +
        (rep.detailedScores.presence * 0.2)
      );
    }
    return rep.clarityScore || 0;
  };

  const avgScore = reps.length > 0
    ? Math.round(reps.reduce((sum, rep) => sum + calculateOverallScore(rep), 0) / reps.length)
    : 0;

    const lastScore = reps.length > 0
    ? calculateOverallScore(reps[0])
    : 0;
  // Calculate current streak (consecutive days with reps)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentStreak = 0;
  let checkDate = new Date(today);
  
  while (true) {
    const hasRepOnDate = reps.some(rep => {
      const repDate = new Date(rep.completedAt);
      repDate.setHours(0, 0, 0, 0);
      return repDate.getTime() === checkDate.getTime();
    });
    
    if (hasRepOnDate) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (currentStreak === 0 && checkDate.getTime() === today.getTime()) {
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  //calculate weakest dimension
  const getWeakestDimension = () => {
    if (reps.length === 0) return null;
  
    const dimensionTotals = {
      pace: 0,
      clarity: 0,
      confidence: 0,
      pauses: 0,
      tone: 0
    };
  
    let count = 0;
  
    reps.forEach(rep => {
      const delivery = Array.isArray(rep.delivery_scores)
        ? rep.delivery_scores[0]
        : null;
  
      if (delivery) {
        dimensionTotals.pace += delivery.pace ?? 0;
        dimensionTotals.clarity += delivery.clarity ?? 0;
        dimensionTotals.confidence += delivery.confidence ?? 0;
        dimensionTotals.pauses += delivery.pauses ?? 0;
        dimensionTotals.tone += delivery.tone ?? 0;
        count++;
      }
    });
  
    if (count === 0) return null;
  
    Object.keys(dimensionTotals).forEach(key => {
      dimensionTotals[key as keyof typeof dimensionTotals] /= count;
    });
  
    const weakest = Object.entries(dimensionTotals)
      .sort((a, b) => a[1] - b[1])[0];
  
    return {
      dimension: weakest[0].charAt(0).toUpperCase() + weakest[0].slice(1),
      score: Math.round(weakest[1])
    };
  };

  const weakestDimension = getWeakestDimension();

  // Get suggestion for weakest dimension
  const getSuggestion = (dimension: string) => {
    const suggestions: Record<string, string> = {
      Clarity: "Focus on eliminating filler words and stating your core idea in the first 10 seconds.",
      Structure: "Use signposting language like 'First,' 'Second,' and 'Finally' to mark transitions.",
      Specificity: "Replace abstract terms with concrete examples, numbers, or real scenarios.",
      Pacing: "Slow down transitions and pause between key points to let ideas land.",
      Presence: "Reduce vocal hesitations and project confidence through deliberate word choice."
    };
    return suggestions[dimension] || "Continue practicing to identify specific improvement areas.";
  };

  // Calculate trend (last 5 reps)
  const getTrend = () => {
    if (reps.length < 2) return null;
    
    const recent = reps.slice(-5);
    const scores = recent.map(calculateOverallScore);
    
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.ceil(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    
    if (diff > 3) return "improving";
    if (diff < -3) return "declining";
    return "stable";
  };

  const trend = getTrend();

  // Prepare chart data
  const chartData = reps.length > 0
    ? reps.slice(-5).map((rep, index) => ({
        index,
        score: calculateOverallScore(rep)
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Compact Hero */}
        <div className="text-center mb-8">
          <div className="inline-block mb-3">
            <div className="hidden md:block">
              <CognifyHeroLogo size={96} />
            </div>
            <div className="block md:hidden">
              <CognifyHeroLogo size={72} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Communication Gym</h1>
          <p className="text-sm text-gray-500">Deliberate reps. Measurable progress.</p>
        </div>

        {/* Performance Strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 mb-0.5">{totalReps}</div>
            <div className="text-xs text-gray-500">Total Reps</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-1 mb-0.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <div className="text-2xl font-bold text-gray-900">{currentStreak}</div>
            </div>
            <div className="text-xs text-gray-500">Current Streak</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 mb-0.5">{avgScore}</div>
            <div className="text-xs text-gray-500">Avg Score</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 mb-0.5">{lastScore || "—"}</div>
            <div className="text-xs text-gray-500">Last Score</div>
          </div>
        </div>

        {/* Current Focus Panel */}
        {reps.length > 0 && weakestDimension ? (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  Current Weakest Dimension: {weakestDimension.dimension} ({weakestDimension.score}/100)
                </div>
                <div className="text-xs text-blue-800">
                  {getSuggestion(weakestDimension.dimension)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Target className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-600">
                  Complete your first rep to unlock personalized performance insights.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Cards - Asymmetric Layout */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Perform Rep - Dominant (2 columns) */}
          <button
            type="button"
            onClick={() => navigate("/app/rep")}
            className="col-span-2 bg-gradient-to-br from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg p-6 text-white hover:shadow-lg transition-shadow group text-left w-full"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Perform a Rep</h2>
                <p className="text-sm text-white/80 leading-relaxed">
                  Practice under realistic constraints and receive AI diagnostic feedback across 5 core dimensions.
                </p>
              </div>
              <div className="flex-shrink-0 ml-4">
                <CognifyHeroLogo size={40} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              Start Rep
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* History - Secondary (1 column) */}
          <Link
            to="/app/history"
            className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Rep History</h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                Review audio, feedback, and track long-term improvement trends.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              View History
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Performance Trend Section */}
        {reps.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Improvement Over Time</h3>
              {trend && (
                <div className="flex items-center gap-1.5 text-xs">
                  {trend === "improving" && (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-700">Improving</span>
                    </>
                  )}
                  {trend === "declining" && (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-red-700">Declining</span>
                    </>
                  )}
                  {trend === "stable" && (
                    <>
                      <Minus className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Stable</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#9D7BF5"
                    strokeWidth={2}
                    dot={{ fill: "#9D7BF5", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Last 5 reps</span>
              <span className="font-medium">Score: 0-100</span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 mb-6 text-center">
            <BarChart3 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-600 mb-1">Improvement Over Time</h3>
            <p className="text-xs text-gray-500">Your progress graph will appear after your first session.</p>
          </div>
        )}

        {/* What You're Training */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">What Cognify Measures</h3>
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              </div>
              <div className="text-xs font-semibold text-gray-900 mb-1">Clarity</div>
              <div className="text-xs text-gray-500 leading-tight">Simple, direct language</div>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              </div>
              <div className="text-xs font-semibold text-gray-900 mb-1">Structure</div>
              <div className="text-xs text-gray-500 leading-tight">Logical flow & transitions</div>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center mx-auto mb-2">
                <div className="w-2 h-2 rounded-full bg-pink-600"></div>
              </div>
              <div className="text-xs font-semibold text-gray-900 mb-1">Specificity</div>
              <div className="text-xs text-gray-500 leading-tight">Concrete examples</div>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-2">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
              </div>
              <div className="text-xs font-semibold text-gray-900 mb-1">Pacing</div>
              <div className="text-xs text-gray-500 leading-tight">Rhythm & timing</div>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mx-auto mb-2">
                <div className="w-2 h-2 rounded-full bg-orange-600"></div>
              </div>
              <div className="text-xs font-semibold text-gray-900 mb-1">Presence</div>
              <div className="text-xs text-gray-500 leading-tight">Confidence & authority</div>
            </div>
          </div>
        </div>

        {/* First Rep CTA - Only show when no reps */}
        {totalReps === 0 && (
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-700 mb-4">
              Your first rep unlocks performance tracking and personalized improvement guidance.
            </p>
            <Link
              to="/app/perform"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5CB3FF] to-[#9D7BF5] text-white text-sm font-medium rounded-lg hover:shadow-lg transition-shadow"
            >
              Start First Rep
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
