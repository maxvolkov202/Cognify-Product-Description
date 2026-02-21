import { TrendingUp, TrendingDown, Minus, ArrowRight, ArrowUp, ArrowDown } from "lucide-react";
import { RepComparison as RepComparisonData, getProgressTrend } from "../../utils/repComparison";

interface RepComparisonProps {
  comparison: RepComparisonData;
  repNumber: number;
  scoreDelta?: number;
}

export function RepComparison({ comparison, repNumber, scoreDelta }: RepComparisonProps) {
  const trend = getProgressTrend(comparison);
  const showScoreDelta = scoreDelta !== undefined && scoreDelta !== 0;

  return (
    <div className={`rounded-2xl p-6 border-2 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500 ${
      trend === "improving"
        ? "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-400"
        : trend === "regressing"
        ? "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-400"
        : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-400"
    }`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          trend === "improving"
            ? "bg-green-600"
            : trend === "regressing"
            ? "bg-orange-600"
            : "bg-blue-600"
        }`}>
          {trend === "improving" && <TrendingUp className="w-6 h-6 text-white" strokeWidth={2.5} />}
          {trend === "regressing" && <TrendingDown className="w-6 h-6 text-white" strokeWidth={2.5} />}
          {trend === "stable" && <Minus className="w-6 h-6 text-white" strokeWidth={2.5} />}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900">
              Rep {repNumber - 1} → Rep {repNumber}
            </h3>
            {trend === "improving" && (
              <span className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-full font-bold uppercase tracking-wide">
                Progress
              </span>
            )}
            {trend === "regressing" && (
              <span className="text-xs px-2.5 py-1 bg-orange-600 text-white rounded-full font-bold uppercase tracking-wide">
                Fluctuation
              </span>
            )}
            {trend === "stable" && (
              <span className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-full font-bold uppercase tracking-wide">
                Steady
              </span>
            )}
            {/* Score Delta Badge */}
            {showScoreDelta && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-sm ${
                scoreDelta! > 0
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-orange-100 text-orange-700 border border-orange-300"
              }`}>
                {scoreDelta! > 0 ? (
                  <ArrowUp className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" strokeWidth={3} />
                )}
                <span>{Math.abs(scoreDelta!)} pts</span>
              </div>
            )}
          </div>

          {/* Main Summary */}
          <div className={`p-4 rounded-xl mb-3 ${
            trend === "improving"
              ? "bg-white/60 border-2 border-green-200"
              : trend === "regressing"
              ? "bg-white/60 border-2 border-orange-200"
              : "bg-white/60 border-2 border-blue-200"
          }`}>
            <p className="text-lg text-gray-900 font-bold">
              {comparison.summary}
            </p>
          </div>

          {/* Detailed Changes */}
          {(comparison.improvements.length > 0 || comparison.regressions.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {/* Improvements */}
              {comparison.improvements.map((improvement, index) => (
                <div
                  key={`improvement-${index}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 border border-green-300 rounded-lg"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-green-700" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-green-800">{improvement}</span>
                </div>
              ))}

              {/* Regressions */}
              {comparison.regressions.map((regression, index) => (
                <div
                  key={`regression-${index}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 border border-orange-300 rounded-lg"
                >
                  <TrendingDown className="w-3.5 h-3.5 text-orange-700" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-orange-800">{regression}</span>
                </div>
              ))}
            </div>
          )}

          {/* Encouragement Messages */}
          {trend === "improving" && comparison.improvements.length >= 3 && (
            <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
              <p className="text-sm text-green-900 font-medium">
                🔥 Strong improvement across multiple areas—you're building momentum
              </p>
            </div>
          )}
          {trend === "improving" && comparison.improvements.length > 0 && comparison.improvements.length < 3 && (
            <p className="text-sm text-green-800 mt-3 font-medium">
              Keep building on this progress in your next rep
            </p>
          )}
          {trend === "stable" && (
            <p className="text-sm text-blue-800 mt-3 italic">
              Maintaining consistency while building the skill
            </p>
          )}
          {trend === "regressing" && comparison.regressions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-orange-800 italic">
                Progress isn't always linear—each rep builds the skill
              </p>
              {comparison.regressions.length === 1 && (
                <p className="text-sm text-orange-900 font-medium mt-1">
                  Next rep: focus specifically on {comparison.regressions[0].toLowerCase()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
