import type { SkillTrend } from "@/lib/db/queries/progress";
import { DIMENSION_LABELS } from "@/types/domain";

// D6 terminology — the canonical label source says "Pacing" for the
// delivery enum; a local copy here had drifted back to "Delivery".
const LABELS = DIMENSION_LABELS;

type Props = {
  trends: SkillTrend[];
};

export function SkillTrendChart({ trends }: Props) {
  return (
    // Phones: 2 charts per row so the page doesn't scroll forever.
    // Desktop unchanged (3-up on lg).
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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

  // Y domain hugs the data (±4pt breathing room, clamped to 0–100)
  // instead of a fixed 0–100 — small week-over-week movements stay
  // visible instead of flattening into a near-horizontal line.
  const clamped = points.map((p) => Math.max(0, Math.min(100, p.score)));
  const yMin = clamped.length ? Math.max(0, Math.min(...clamped) - 4) : 0;
  const yMax = clamped.length ? Math.min(100, Math.max(...clamped) + 4) : 100;
  const ySpan = yMax - yMin || 1; // guard: flat data at a clamp boundary
  const yFor = (score: number) =>
    height - padding - ((score - yMin) / ySpan) * (height - padding * 2);

  let path = "";
  let endDot: { x: number; y: number } | null = null;
  if (points.length >= 2) {
    const xs = points.map((_, i) => (i / (points.length - 1)) * (width - padding * 2) + padding);
    const ys = clamped.map(yFor);
    path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join(" ");
    endDot = { x: xs[xs.length - 1]!, y: ys[ys.length - 1]! };
  } else if (points.length === 1) {
    const y = yFor(clamped[0]!);
    path = `M ${padding} ${y} L ${width - padding} ${y}`;
    endDot = { x: width - padding, y };
  }
  const areaPath = path
    ? `${path} L ${(width - padding).toFixed(1)} ${height - padding} L ${padding} ${height - padding} Z`
    : "";

  const gradientId = `trend-${trend.dimension}`;
  const fillGradientId = `trend-fill-${trend.dimension}`;

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-sm font-semibold text-ink-800 dark:text-ink-200">{label}</span>
        {latest !== null ? (
          <span className="brand-gradient-text text-2xl font-extrabold tabular-nums">
            {Math.round(latest)}
          </span>
        ) : (
          <span className="text-lg font-semibold text-ink-400">—</span>
        )}
      </div>
      {delta !== null && Math.abs(delta) >= 1 && (
        <div className="mt-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              delta > 0
                ? "bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
            }`}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))} in last {points.length} reps
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 aspect-[15/4] w-full"
        aria-label={`${label} trend`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6aa3ff" />
            <stop offset="50%" stopColor="#9788ff" />
            <stop offset="100%" stopColor="#e77cf0" />
          </linearGradient>
          <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9788ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#9788ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length === 0 ? (
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="currentColor"
            className="text-ink-200 dark:text-ink-700"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ) : (
          <>
            <path d={areaPath} fill={`url(#${fillGradientId})`} />
            <path
              d={path}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {endDot && (
              <circle
                cx={endDot.x}
                cy={endDot.y}
                r="3.5"
                fill="#e77cf0"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-white dark:text-ink-900"
              />
            )}
          </>
        )}
      </svg>
      {points.length === 0 && (
        <p className="mt-1 text-[11px] text-ink-400">No reps yet — baseline will appear here.</p>
      )}
    </div>
  );
}
