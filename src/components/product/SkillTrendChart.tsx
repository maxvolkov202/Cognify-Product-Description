import type { SkillTrend } from "@/lib/db/queries/progress";
import type { SkillDimension } from "@/types/domain";

const LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking Quality",
  delivery: "Delivery",
  tone: "Tone",
};

type Props = {
  trends: SkillTrend[];
};

export function SkillTrendChart({ trends }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {trends.map((trend) => (
        <TrendTile key={trend.dimension} trend={trend} />
      ))}
    </div>
  );
}

function TrendTile({ trend }: { trend: SkillTrend }) {
  const label = LABELS[trend.dimension];
  const points = trend.points;
  const latest = points[points.length - 1]?.score ?? null;
  const earliest = points[0]?.score ?? null;
  const delta = latest !== null && earliest !== null ? latest - earliest : null;

  const width = 240;
  const height = 64;
  const padding = 4;

  let path = "";
  if (points.length >= 2) {
    const xs = points.map((_, i) => (i / (points.length - 1)) * (width - padding * 2) + padding);
    const ys = points.map(
      (p) => height - padding - (Math.max(0, Math.min(100, p.score)) / 100) * (height - padding * 2),
    );
    path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join(" ");
  } else if (points.length === 1) {
    const y = height - padding - (points[0]!.score / 100) * (height - padding * 2);
    path = `M ${padding} ${y} L ${width - padding} ${y}`;
  }

  const gradientId = `trend-${trend.dimension}`;

  return (
    <div className="surface-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink-800">{label}</span>
        {latest !== null ? (
          <span className="brand-gradient-text text-2xl font-extrabold tabular-nums">
            {Math.round(latest)}
          </span>
        ) : (
          <span className="text-lg font-semibold text-ink-400">—</span>
        )}
      </div>
      {delta !== null && Math.abs(delta) >= 1 && (
        <div className="mt-0.5 text-[11px] font-medium text-ink-500">
          {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))} in last {points.length} reps
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-14 w-full"
        preserveAspectRatio="none"
        aria-label={`${label} trend`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6aa3ff" />
            <stop offset="50%" stopColor="#9788ff" />
            <stop offset="100%" stopColor="#e77cf0" />
          </linearGradient>
        </defs>
        {points.length === 0 ? (
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="#e5e5ec"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ) : (
          <path
            d={path}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {points.length === 0 && (
        <p className="mt-1 text-[11px] text-ink-400">No reps yet — baseline will appear here.</p>
      )}
    </div>
  );
}
