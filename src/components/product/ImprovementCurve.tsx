"use client";

import { useMemo, useState } from "react";
import type { DailyCompositePoint } from "@/lib/db/queries/progress";

type Props = {
  points: DailyCompositePoint[];
  /** Optional baseline composite drawn as a reference line. */
  baselineComposite?: number | null;
  /** Optional personal-best composite drawn as the peak marker. */
  peakComposite?: number | null;
};

/**
 * Daily composite trend over a 30/60/90 day window — macro trajectory view.
 *
 * Shows:
 *   - Line chart of daily avg composite (chronological).
 *   - Baseline reference line (user's first rep composite).
 *   - Peak marker at the highest point.
 *   - Linear-regression trend line (dashed) so the user can see the
 *     direction of travel even through noisy day-to-day variance.
 *   - Simple range selector (30 / 60 / 90 days) client-side.
 *
 * Designed to sit beside the per-dimension SkillTrendChart on /progress.
 * The curve is the "you're getting better overall" signal; the trend
 * chart is the "which dimension drove it" breakdown.
 */
export function ImprovementCurve({
  points,
  baselineComposite,
  peakComposite,
}: Props) {
  const [range, setRange] = useState<30 | 60 | 90>(30);

  const filtered = useMemo(() => {
    if (!points.length) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return points.filter((p) => new Date(p.date) >= cutoff);
  }, [points, range]);

  const { slope, intercept, stdErr } = useMemo(() => {
    if (filtered.length < 2) return { slope: 0, intercept: 0, stdErr: 0 };
    const n = filtered.length;
    const xs = filtered.map((_, i) => i);
    const ys = filtered.map((p) => p.composite);
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i]!, 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const d = n * sumX2 - sumX * sumX;
    if (d === 0) return { slope: 0, intercept: ys[0]!, stdErr: 0 };
    const slope = (n * sumXY - sumX * sumY) / d;
    const intercept = (sumY - slope * sumX) / n;
    // Standard error of the residuals — root-mean-square of
    // (observed - predicted). With n<3 the residual degrees of freedom
    // are zero so we use a floor of 1 to avoid divide-by-zero.
    const resSS = ys.reduce((s, y, i) => {
      const yhat = intercept + slope * xs[i]!;
      return s + (y - yhat) ** 2;
    }, 0);
    const dof = Math.max(1, n - 2);
    const stdErr = Math.sqrt(resSS / dof);
    return { slope, intercept, stdErr };
  }, [filtered]);

  if (filtered.length < 2) {
    return (
      <div className="surface-card p-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">
            Improvement curve
          </h2>
          <RangeTabs range={range} onChange={setRange} />
        </div>
        <p className="mt-6 rounded-xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
          Needs at least 2 days of reps. Keep training — the curve fills in.
        </p>
      </div>
    );
  }

  const W = 640;
  const H = 260;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 30;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xAt = (i: number) =>
    PAD_L + (filtered.length === 1 ? innerW / 2 : (i / (filtered.length - 1)) * innerW);
  const yAt = (score: number) => PAD_T + innerH - (score / 100) * innerH;

  const linePath = filtered
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.composite)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xAt(filtered.length - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;

  const trendStart = { x: xAt(0), y: yAt(intercept) };
  const trendEnd = {
    x: xAt(filtered.length - 1),
    y: yAt(intercept + slope * (filtered.length - 1)),
  };

  // 95% confidence interval band around the trend line — ±1.96 * SE of
  // the regression residuals, clamped to [0, 100] so the band never
  // leaves the chart. Drawn as a filled polygon bounded above by
  // predicted+ci and below by predicted-ci, clipped to the plot area.
  const CI_MULTIPLIER = 1.96;
  const ciBandPath = (() => {
    if (stdErr === 0 || filtered.length < 3) return null;
    const upperPts: string[] = [];
    const lowerPts: string[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const yhat = intercept + slope * i;
      const upper = Math.min(100, yhat + CI_MULTIPLIER * stdErr);
      const lower = Math.max(0, yhat - CI_MULTIPLIER * stdErr);
      upperPts.push(`${xAt(i)},${yAt(upper)}`);
      lowerPts.push(`${xAt(i)},${yAt(lower)}`);
    }
    // Build a closed polygon: upper boundary left→right, then lower
    // boundary right→left.
    return `M ${upperPts.join(" L ")} L ${lowerPts.reverse().join(" L ")} Z`;
  })();

  const peakIdx = filtered.reduce(
    (best, p, i) => (p.composite > filtered[best]!.composite ? i : best),
    0,
  );
  const peakPoint = filtered[peakIdx]!;

  const latest = filtered[filtered.length - 1]!;
  const earliest = filtered[0]!;
  const windowDelta = Math.round(latest.composite - earliest.composite);

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-8">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">
              Improvement curve
            </h2>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Daily composite score · all reps, all dimensions averaged
            </p>
          </div>
          <RangeTabs range={range} onChange={setRange} />
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-xs">
          <Stat label="Latest" value={latest.composite} />
          <Stat
            label="vs window start"
            value={windowDelta >= 0 ? `+${windowDelta}` : `${windowDelta}`}
            accent={
              windowDelta > 0
                ? "positive"
                : windowDelta < 0
                  ? "warn"
                  : "neutral"
            }
          />
          <Stat
            label="trajectory"
            value={
              slope > 0.3
                ? "trending up"
                : slope < -0.3
                  ? "trending down"
                  : "flat"
            }
            accent={
              slope > 0.3
                ? "positive"
                : slope < -0.3
                  ? "warn"
                  : "neutral"
            }
          />
          {peakComposite !== undefined && peakComposite !== null && (
            <Stat label="Personal best" value={peakComposite} />
          )}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-6 h-auto w-full overflow-visible"
          role="img"
          aria-label="Daily composite score over time"
        >
          {/* Horizontal gridlines at 25 / 50 / 75 / 100 */}
          {[25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yAt(g)}
                y2={yAt(g)}
                stroke="currentColor"
                className="text-ink-100 dark:text-ink-800"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 6}
                y={yAt(g) + 3}
                textAnchor="end"
                className="fill-ink-400 text-[10px] font-semibold"
              >
                {g}
              </text>
            </g>
          ))}

          {/* Baseline reference line */}
          {baselineComposite != null && (
            <g>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yAt(baselineComposite)}
                y2={yAt(baselineComposite)}
                stroke="currentColor"
                className="text-ink-300 dark:text-ink-600"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={W - PAD_R}
                y={yAt(baselineComposite) - 4}
                textAnchor="end"
                className="fill-ink-500 text-[10px] font-semibold dark:fill-ink-400"
              >
                baseline {baselineComposite}
              </text>
            </g>
          )}

          {/* Area fill under the line */}
          <defs>
            <linearGradient id="ic-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b072ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#b072ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#ic-fill)" />

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke="#b072ff"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 95% confidence-interval band around the regression */}
          {ciBandPath && (
            <path
              d={ciBandPath}
              fill="#e77cf0"
              fillOpacity={0.12}
              stroke="none"
            />
          )}

          {/* Trend line (regression) */}
          <line
            x1={trendStart.x}
            y1={trendStart.y}
            x2={trendEnd.x}
            y2={trendEnd.y}
            stroke="#e77cf0"
            strokeWidth={1.8}
            strokeDasharray="5 4"
            opacity={0.75}
          />

          {/* Dots */}
          {filtered.map((p, i) => (
            <circle
              key={p.date}
              cx={xAt(i)}
              cy={yAt(p.composite)}
              r={i === peakIdx ? 5 : 3}
              fill={i === peakIdx ? "#e77cf0" : "currentColor"}
              className={i === peakIdx ? undefined : "text-white dark:text-ink-900"}
              stroke="#b072ff"
              strokeWidth={1.5}
            >
              <title>
                {p.date}: {p.composite} ({p.repCount} rep
                {p.repCount === 1 ? "" : "s"})
              </title>
            </circle>
          ))}

          {/* Peak label */}
          <g>
            <line
              x1={xAt(peakIdx)}
              x2={xAt(peakIdx)}
              y1={yAt(peakPoint.composite) - 14}
              y2={yAt(peakPoint.composite) - 6}
              stroke="#e77cf0"
              strokeWidth={1.2}
            />
            <text
              x={xAt(peakIdx)}
              y={yAt(peakPoint.composite) - 18}
              textAnchor="middle"
              className="fill-[#e77cf0] text-[10px] font-bold"
            >
              peak {peakPoint.composite}
            </text>
          </g>

          {/* X-axis labels: first, middle, last */}
          {[0, Math.floor(filtered.length / 2), filtered.length - 1].map(
            (i, k) => (
              <text
                key={`${i}-${k}`}
                x={xAt(i)}
                y={H - 10}
                textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
                className="fill-ink-400 text-[10px] font-semibold"
              >
                {shortDate(filtered[i]!.date)}
              </text>
            ),
          )}
        </svg>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          Solid line = daily avg composite. Dashed pink = fitted trajectory.
          Pink band = 95% confidence interval on that trajectory — narrow
          band means your improvement is steady; wide band means your
          day-to-day score is still noisy. Flat lines over weeks usually
          mean the rep variety got too narrow — try a new rep type or a
          pressure archetype.
        </p>
      </div>
    </div>
  );
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function RangeTabs({
  range,
  onChange,
}: {
  range: 30 | 60 | 90;
  onChange: (r: 30 | 60 | 90) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-ink-50 p-1 dark:bg-ink-800">
      {([30, 60, 90] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={
            r === range
              ? "brand-gradient rounded-full px-3 py-1 text-[11px] font-bold text-white"
              : "rounded-full px-3 py-1 text-[11px] font-semibold text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
          }
        >
          {r}d
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "positive" | "warn" | "neutral";
}) {
  const color =
    accent === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : accent === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-ink-900 dark:text-white";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className={`text-lg font-extrabold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
