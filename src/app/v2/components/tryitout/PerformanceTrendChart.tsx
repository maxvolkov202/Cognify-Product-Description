import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { RepRow } from "./ResultsScreen";

export type TrendMetric = "overall" | "delivery" | "content" | "pace" | "clarity" | "confidence" | "pauses" | "tone";

interface PerformanceTrendChartProps {
  reps: RepRow[];
  metric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
}

export function PerformanceTrendChart({ reps, metric, onMetricChange }: PerformanceTrendChartProps) {
  // Prepare data for chart (overall_score, delivery_score, content_score, delivery_scores)
  const chartData = reps
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    .map((rep, index) => {
      // Normalize: Supabase can return delivery_scores as array or single object
      const raw = rep.delivery_scores;
      const delivery =
        Array.isArray(raw) && raw.length > 0
          ? raw[0]
          : raw && typeof raw === "object" && !Array.isArray(raw)
            ? raw
            : null;
      let score = 0;
      switch (metric) {
        case "overall": score = rep.overall_score ?? 0; break;
        case "delivery": score = rep.delivery_score ?? 0; break;
        case "content": score = rep.content_score ?? 0; break;
        case "pace": score = (delivery as { pace?: number | null } | null)?.pace ?? 0; break;
        case "clarity": score = (delivery as { clarity?: number | null } | null)?.clarity ?? 0; break;
        case "confidence": score = (delivery as { confidence?: number | null } | null)?.confidence ?? 0; break;
        case "pauses": score = (delivery as { pauses?: number | null } | null)?.pauses ?? 0; break;
        case "tone": score = (delivery as { tone?: number | null } | null)?.tone ?? 0; break;
      }
      const date = new Date(rep.created_at ?? 0);
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
    switch (metric) {
      case "overall": return "#9D7BF5";
      case "delivery": return "#5CB3FF";
      case "content": return "#10B981";
      case "pace": return "#F59E0B";
      case "clarity": return "#5CB3FF";
      case "confidence": return "#8B5CF6";
      case "pauses": return "#E86DE1";
      case "tone": return "#EC4899";
      default: return "#9D7BF5";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Score Trend Over Time</h2>
        
        {/* Metric Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 flex-wrap">
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
            onClick={() => onMetricChange("delivery")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "delivery"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Delivery
          </button>
          <button
            onClick={() => onMetricChange("content")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "content"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Content
          </button>
          <button
            onClick={() => onMetricChange("pace")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "pace"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pace
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
            onClick={() => onMetricChange("confidence")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "confidence"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Confidence
          </button>
          <button
            onClick={() => onMetricChange("pauses")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "pauses"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pauses
          </button>
          <button
            onClick={() => onMetricChange("tone")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              metric === "tone"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tone
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
