import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Rep } from "../../types/rep";

interface PerformanceTrendChartProps {
  reps: Rep[];
  metric: "overall" | "clarity" | "structure" | "specificity" | "pacing" | "presence";
  onMetricChange: (metric: "overall" | "clarity" | "structure" | "specificity" | "pacing" | "presence") => void;
}

export function PerformanceTrendChart({ reps, metric, onMetricChange }: PerformanceTrendChartProps) {
  // Prepare data for chart
  const chartData = reps
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .map((rep, index) => {
      let score = 0;
      
      if (metric === "overall") {
        if (rep.detailedScores) {
          score = Math.round(
            (rep.detailedScores.clarity * 0.2) +
            (rep.detailedScores.structure * 0.25) +
            (rep.detailedScores.specificity * 0.25) +
            (rep.detailedScores.pacing * 0.15) +
            (rep.detailedScores.presence * 0.15)
          );
        } else {
          score = rep.clarityScore || 0;
        }
      } else {
        score = rep.detailedScores?.[metric] || 0;
      }

      const date = new Date(rep.completedAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        name: dateStr,
        score,
        prompt: rep.scenario,
        index: index + 1,
        fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
    });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-xs text-gray-600 mb-1">{payload[0].payload.fullDate}</p>
          <p className="text-sm font-bold text-gray-900 mb-1">Score: {payload[0].value}</p>
          <p className="text-xs text-gray-600 truncate max-w-[200px]">{payload[0].payload.prompt}</p>
        </div>
      );
    }
    return null;
  };

  const getMetricColor = () => {
    switch(metric) {
      case "overall": return "#9D7BF5";
      case "clarity": return "#5CB3FF";
      case "structure": return "#E86DE1";
      case "specificity": return "#10B981";
      case "pacing": return "#F59E0B";
      case "presence": return "#8B5CF6";
      default: return "#9D7BF5";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Score Trend Over Time</h2>
        
        {/* Metric Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onMetricChange("overall")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "overall"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => onMetricChange("clarity")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "clarity"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Clarity
          </button>
          <button
            onClick={() => onMetricChange("structure")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "structure"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Structure
          </button>
          <button
            onClick={() => onMetricChange("specificity")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "specificity"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Specificity
          </button>
          <button
            onClick={() => onMetricChange("pacing")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "pacing"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pacing
          </button>
          <button
            onClick={() => onMetricChange("presence")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "presence"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Presence
          </button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6B7280' }}
          />
          <YAxis 
            domain={[0, 100]}
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#6B7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke={getMetricColor()}
            strokeWidth={3}
            dot={{ fill: getMetricColor(), strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-500 mt-4">
        Hover over data points to see rep details. Toggle between metrics to track specific improvements.
      </p>
    </div>
  );
}
