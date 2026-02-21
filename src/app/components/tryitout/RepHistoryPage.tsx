import { useState, useMemo } from "react";
import { ArrowLeft, ChevronDown, TrendingUp, Award, Target, BarChart3, ChevronRight } from "lucide-react";
import { Rep } from "../../types/rep";
import { FRAMEWORKS } from "../../types/rep";
import { PerformanceTrendChart } from "./PerformanceTrendChart";
import { RepDetailModal } from "./RepDetailModal";
import { PatternInsights } from "./PatternInsights";

interface RepHistoryPageProps {
  reps: Rep[];
  onBack: () => void;
  onRepClick?: (repId: string) => void; // Optional: use for routing instead of modal
}

type SortOption = "newest" | "highest" | "lowest";
type TrendMetric = "overall" | "clarity" | "structure" | "specificity" | "pacing" | "presence";

export function RepHistoryPage({ reps, onBack, onRepClick }: RepHistoryPageProps) {
  const [selectedRep, setSelectedRep] = useState<Rep | null>(null);
  const [filterScenario, setFilterScenario] = useState<string>("all");
  const [filterFramework, setFilterFramework] = useState<string>("all");
  const [filterScoreRange, setFilterScoreRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("overall");

  // Calculate summary stats
  const stats = useMemo(() => {
    if (reps.length === 0) {
      return {
        totalReps: 0,
        averageScore: 0,
        bestScore: 0,
        mostPracticedScenario: "N/A"
      };
    }

    const scores = reps.map(r => r.detailedScores?.clarity || r.clarityScore || 0);
    const overallScores = reps.map(r => {
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

    const scenarioCounts: Record<string, number> = {};
    reps.forEach(r => {
      scenarioCounts[r.scenarioCategory] = (scenarioCounts[r.scenarioCategory] || 0) + 1;
    });

    const mostPracticed = Object.entries(scenarioCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      totalReps: reps.length,
      averageScore: Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length),
      bestScore: Math.max(...overallScores),
      mostPracticedScenario: mostPracticed
    };
  }, [reps]);

  // Get unique scenarios and frameworks for filters
  const uniqueScenarios = useMemo(() => {
    const scenarios = new Set(reps.map(r => r.scenarioCategory));
    return Array.from(scenarios).sort();
  }, [reps]);

  const uniqueFrameworks = useMemo(() => {
    const frameworks = new Set(reps.map(r => r.framework));
    return Array.from(frameworks).map(id => FRAMEWORKS.find(f => f.id === id)).filter(Boolean);
  }, [reps]);

  // Filter and sort reps
  const filteredAndSortedReps = useMemo(() => {
    let filtered = [...reps];

    // Apply filters
    if (filterScenario !== "all") {
      filtered = filtered.filter(r => r.scenarioCategory === filterScenario);
    }

    if (filterFramework !== "all") {
      filtered = filtered.filter(r => r.framework === filterFramework);
    }

    if (filterScoreRange !== "all") {
      filtered = filtered.filter(r => {
        const score = r.detailedScores ? 
          Math.round(
            (r.detailedScores.clarity * 0.2) +
            (r.detailedScores.structure * 0.25) +
            (r.detailedScores.specificity * 0.25) +
            (r.detailedScores.pacing * 0.15) +
            (r.detailedScores.presence * 0.15)
          ) : r.clarityScore;

        if (filterScoreRange === "90+") return score >= 90;
        if (filterScoreRange === "75-89") return score >= 75 && score < 90;
        if (filterScoreRange === "60-74") return score >= 60 && score < 75;
        if (filterScoreRange === "<60") return score < 60;
        return true;
      });
    }

    // Apply sorting
    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    } else if (sortBy === "highest" || sortBy === "lowest") {
      filtered.sort((a, b) => {
        const scoreA = a.detailedScores ? 
          Math.round(
            (a.detailedScores.clarity * 0.2) +
            (a.detailedScores.structure * 0.25) +
            (a.detailedScores.specificity * 0.25) +
            (a.detailedScores.pacing * 0.15) +
            (a.detailedScores.presence * 0.15)
          ) : a.clarityScore;
        
        const scoreB = b.detailedScores ? 
          Math.round(
            (b.detailedScores.clarity * 0.2) +
            (b.detailedScores.structure * 0.25) +
            (b.detailedScores.specificity * 0.25) +
            (b.detailedScores.pacing * 0.15) +
            (b.detailedScores.presence * 0.15)
          ) : b.clarityScore;

        return sortBy === "highest" ? scoreB - scoreA : scoreA - scoreB;
      });
    }

    return filtered;
  }, [reps, filterScenario, filterFramework, filterScoreRange, sortBy]);

  const getOverallScore = (rep: Rep) => {
    if (rep.detailedScores) {
      return Math.round(
        (rep.detailedScores.clarity * 0.2) +
        (rep.detailedScores.structure * 0.25) +
        (rep.detailedScores.specificity * 0.25) +
        (rep.detailedScores.pacing * 0.15) +
        (rep.detailedScores.presence * 0.15)
      );
    }
    return rep.clarityScore || 0;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Elite";
    if (score >= 75) return "Strong";
    if (score >= 60) return "Developing";
    return "Needs Work";
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (reps.length === 0) {
    return (
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Browse</span>
          </button>

          <div className="text-center py-20">
            <div className="bg-white rounded-2xl border border-gray-200 p-12">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No reps yet</h3>
              <p className="text-gray-600">
                Your rep history will appear here after you complete your first training session.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Browse</span>
        </button>

        {/* Top Section - History Overview Header */}
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Rep History</h1>
            <p className="text-gray-600">
              Review past performances, track patterns, and refine your communication over time.
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 min-w-[120px]">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-600">Total Reps</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReps}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 min-w-[120px]">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-600">Avg Score</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.averageScore}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 min-w-[120px]">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-600">Best Score</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.bestScore}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 min-w-[120px]">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-600">Most Practiced</p>
              </div>
              <p className="text-sm font-bold text-gray-900 truncate">{stats.mostPracticedScenario}</p>
            </div>
          </div>
        </div>

        {/* Performance Trend Panel */}
        <PerformanceTrendChart 
          reps={reps} 
          metric={trendMetric}
          onMetricChange={setTrendMetric}
        />

        {/* Rep List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">All Reps</h2>
            <p className="text-sm text-gray-600">{filteredAndSortedReps.length} of {reps.length} shown</p>
          </div>

          {/* Filtering Controls */}
          <div className="flex flex-wrap gap-3">
            {/* Filter by Scenario */}
            <div className="relative">
              <select
                value={filterScenario}
                onChange={(e) => setFilterScenario(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent cursor-pointer"
              >
                <option value="all">All Scenarios</option>
                {uniqueScenarios.map(scenario => (
                  <option key={scenario} value={scenario}>{scenario}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* Filter by Framework */}
            <div className="relative">
              <select
                value={filterFramework}
                onChange={(e) => setFilterFramework(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent cursor-pointer"
              >
                <option value="all">All Frameworks</option>
                {uniqueFrameworks.map(framework => (
                  <option key={framework!.id} value={framework!.id}>{framework!.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* Filter by Score Range */}
            <div className="relative">
              <select
                value={filterScoreRange}
                onChange={(e) => setFilterScoreRange(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent cursor-pointer"
              >
                <option value="all">All Scores</option>
                <option value="90+">Elite (90+)</option>
                <option value="75-89">Strong (75-89)</option>
                <option value="60-74">Developing (60-74)</option>
                <option value="<60">Needs Work (&lt;60)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* Sort By */}
            <div className="relative ml-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="highest">Highest Score</option>
                <option value="lowest">Lowest Score</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Rep Cards List */}
          <div className="space-y-3">
            {filteredAndSortedReps.map((rep, index) => {
              const framework = FRAMEWORKS.find(f => f.id === rep.framework);
              const overallScore = getOverallScore(rep);

              return (
                <button
                  key={rep.id ?? `rep-${index}`}
                  onClick={() => onRepClick ? onRepClick(rep.id) : setSelectedRep(rep)}
                  className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:border-[#9D7BF5] hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    {/* Left Side - Scenario Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-[#5CB3FF]/20 via-[#9D7BF5]/20 to-[#E86DE1]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">📝</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900 group-hover:text-[#9D7BF5] truncate">
                            {rep.scenario}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{framework?.name || rep.framework}</span>
                            <span>•</span>
                            <span>{formatDate(rep.completedAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Mini Score Breakdown */}
                      {rep.detailedScores && (
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">C</span>
                            <span className="font-semibold text-gray-700">{rep.detailedScores.clarity}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">S</span>
                            <span className="font-semibold text-gray-700">{rep.detailedScores.structure}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Sp</span>
                            <span className="font-semibold text-gray-700">{rep.detailedScores.specificity}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">P</span>
                            <span className="font-semibold text-gray-700">{rep.detailedScores.pacing}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Pr</span>
                            <span className="font-semibold text-gray-700">{rep.detailedScores.presence}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Side - Score + Arrow */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
                          {overallScore}
                        </p>
                        <p className={`text-xs font-medium ${getScoreColor(overallScore)}`}>
                          {getScoreLabel(overallScore)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#9D7BF5]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pattern Insights */}
        <PatternInsights reps={reps} />
      </div>

      {/* Rep Detail Modal */}
      {selectedRep && (
        <RepDetailModal
          rep={selectedRep}
          onClose={() => setSelectedRep(null)}
        />
      )}
    </section>
  );
}
