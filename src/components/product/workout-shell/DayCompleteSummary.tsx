"use client";

// HC-4 — end-of-day "Here's how you did" summary. Standard depth per
// Max's 2026-05-22 direction: composite + delta vs last same-dim day,
// 4 rep mini-bars, per-dim trend line across the 4 reps, 1 biggest
// takeaway. Light theme matching the rest of the workout shell.

import Link from "next/link";
import { useEffect } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  DIMENSION_LABELS,
  MUSCLE_GROUP_LABELS,
  type MuscleGroupId,
  type SkillDimension,
} from "@/types/domain";
import type {
  DayRepBreakdown,
  MuscleGroupComparison,
} from "@/lib/db/queries/muscle-group-progress";

export type DayCompleteSummaryProps = {
  dim: MuscleGroupId;
  comparison: MuscleGroupComparison | null;
  reps: DayRepBreakdown[];
  /** PRD v3 Phase 2.7 (C17) — progression stats for the celebratory
   *  completion. Null when unavailable (guest / degraded fetch). */
  lifetimeReps?: number | null;
  streakDays?: number | null;
};

const DIM_LINE_COLORS: Record<SkillDimension, string> = {
  clarity: "#7c3aed",
  structure: "#4f46e5",
  conciseness: "#db2777",
  thinking_quality: "#a21caf",
  delivery: "#059669",
  tone: "#b45309",
};

const ALL_DIMS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

export default function DayCompleteSummary({
  dim,
  comparison,
  reps,
  lifetimeReps = null,
  streakDays = null,
}: DayCompleteSummaryProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "day_summary_opened",
          dim,
          composite: comparison?.todayComposite,
          deltaVsLast: comparison?.deltaComposite,
          repCount: reps.length,
        }),
      );
    }
  }, [dim, comparison, reps.length]);

  const composite = comparison?.todayComposite ?? null;
  const delta = comparison?.deltaComposite ?? null;
  const isImprovement = delta != null && delta > 0;
  const isRegression = delta != null && delta < 0;

  const takeaway = buildTakeaway(comparison, reps);
  const mostImproved = findMostImprovedDim(reps);
  const recommendation = buildCoachRecommendation(dim, reps);
  const weakestToday = findWeakestDim(reps);

  return (
    <div className="space-y-5">
      {/* Hero — celebratory framing per PRD §5.7 + Hunter C16. */}
      <div className="text-center">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600 dark:text-brand-lavender">
          🎉 {MUSCLE_GROUP_LABELS[dim]} day complete
        </div>
        <div className="mt-2 text-6xl sm:text-7xl font-extrabold text-slate-900 dark:text-white leading-none tabular-nums">
          {composite != null ? Math.round(composite) : "—"}
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-ink-400 uppercase tracking-wider">
          Composite
        </div>
        {delta != null && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 text-sm font-semibold",
              isImprovement && "text-emerald-700 dark:text-emerald-400",
              isRegression && "text-rose-700 dark:text-rose-400",
              !isImprovement && !isRegression && "text-slate-600 dark:text-ink-300",
            )}
          >
            {isImprovement && <ArrowUpRight className="w-4 h-4" aria-hidden />}
            {isRegression && (
              <ArrowDownRight className="w-4 h-4" aria-hidden />
            )}
            {!isImprovement && !isRegression && (
              <ArrowRight className="w-4 h-4" aria-hidden />
            )}
            {delta > 0 ? "+" : ""}
            {Math.round(delta)} vs last {MUSCLE_GROUP_LABELS[dim]} day
            {comparison?.daysSince != null
              ? ` (${comparison.daysSince}d ago)`
              : ""}
          </div>
        )}
        {delta == null && comparison?.lastComposite == null && (
          <div className="mt-3 text-sm text-slate-500 dark:text-ink-400">
            First {MUSCLE_GROUP_LABELS[dim]} day — baseline set.
          </div>
        )}
      </div>

      {/* PRD v3 Phase 2.7 — progression stats row (C17: reps earned +
          all-time reps + streak, together on the completion screen). */}
      <div className="flex justify-center gap-3 text-center">
        <StatPill label="Reps today" value={reps.length} />
        {lifetimeReps != null && (
          <StatPill label="All-time reps" value={lifetimeReps} />
        )}
        {streakDays != null && streakDays > 0 && (
          <StatPill label="Day streak" value={streakDays} emoji="🔥" />
        )}
      </div>

      {/* Most improved Core Skill (PRD §5.7). */}
      {mostImproved && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
            Most improved: {DIMENSION_LABELS[mostImproved.dim]} +
            {Math.round(mostImproved.delta)}
          </span>
        </div>
      )}

      {/* Per-rep mini-bars */}
      {reps.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-ink-400 mb-3">
            Today&apos;s reps
          </div>
          <div className="flex items-end justify-around gap-3 h-32">
            {reps.map((rep) => (
              <RepMiniBar key={rep.repId} rep={rep} />
            ))}
          </div>
        </div>
      )}

      {/* Per-dim trend line */}
      {reps.length >= 2 && (
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-ink-400 mb-2">
            Per-dimension trend
          </div>
          <DimTrendChart reps={reps} />
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {ALL_DIMS.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-ink-200"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: DIM_LINE_COLORS[d] }}
                  aria-hidden
                />
                {DIMENSION_LABELS[d]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Biggest takeaway */}
      {takeaway && (
        <div className="rounded-2xl border border-purple-200 dark:border-brand-purple/40 bg-gradient-to-br from-purple-50/80 to-white dark:from-purple-500/15 dark:to-ink-900 p-4 shadow-sm flex items-start gap-3">
          <Sparkles
            className="w-5 h-5 text-purple-600 dark:text-brand-lavender mt-0.5 shrink-0"
            strokeWidth={2.5}
            aria-hidden
          />
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600 dark:text-brand-lavender mb-0.5">
              Biggest takeaway
            </div>
            <p className="text-sm text-slate-800 dark:text-ink-100 leading-snug">{takeaway}</p>
          </div>
        </div>
      )}

      {/* Coach recommendation (PRD §5.7) — the next highest-value move. */}
      {recommendation && (
        <div className="text-center text-xs text-slate-500 dark:text-ink-400">
          <span className="font-semibold text-purple-700 dark:text-brand-lavender">
            Coach&apos;s call:
          </span>{" "}
          {recommendation}
        </div>
      )}

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          href={`/progress/muscle-groups?dim=${dim}`}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          See {MUSCLE_GROUP_LABELS[dim]} timeline →
        </Link>
        {/* D9 (2026-07-06) — Focus Drills live here as a Daily Workout
            extra. /drills bounces to the legacy Skill Lab when the apps
            flag is off, so this link is safe in every flag state. */}
        {weakestToday && (
          <Link
            href={`/drills?focus=${weakestToday}`}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold border border-purple-200 dark:border-brand-purple/40 bg-white dark:bg-ink-900 text-purple-700 dark:text-brand-lavender hover:bg-purple-50 dark:hover:bg-ink-800 transition-colors"
          >
            Extra reps: drill {DIMENSION_LABELS[weakestToday]}
          </Link>
        )}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-slate-700 dark:text-ink-200 hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function RepMiniBar({ rep }: { rep: DayRepBreakdown }) {
  const heightPct = Math.max(8, Math.min(100, rep.composite));
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[80px]">
      <div className="w-full h-24 flex items-end">
        <div
          className={cn(
            "w-full rounded-t-lg transition-all",
            rep.composite >= 80
              ? "bg-emerald-500"
              : rep.composite >= 60
                ? "bg-purple-500"
                : rep.composite >= 40
                  ? "bg-amber-500"
                  : "bg-rose-500",
          )}
          style={{ height: `${heightPct}%` }}
        />
      </div>
      <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
        {rep.composite}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-ink-400 uppercase tracking-wider">
        {rep.isGraduationRep ? "Grad" : `Rep ${rep.repIndex + 1}`}
      </div>
    </div>
  );
}

function DimTrendChart({ reps }: { reps: DayRepBreakdown[] }) {
  const width = 320;
  const height = 140;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xFor = (i: number) =>
    padX + (reps.length === 1 ? innerW / 2 : (i / (reps.length - 1)) * innerW);
  const yFor = (score: number) => padY + (1 - score / 100) * innerH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      aria-label="Per-dimension scores across the 4 reps"
    >
      {/* Gridlines at 25, 50, 75 */}
      {[25, 50, 75].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={width - padX}
          y1={yFor(g)}
          y2={yFor(g)}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      ))}
      {/* Lines per dim */}
      {ALL_DIMS.map((d) => {
        const points = reps
          .map((r, i) => {
            const s = r.perDim[d];
            if (s == null) return null;
            return `${xFor(i)},${yFor(s)}`;
          })
          .filter((p): p is string => p !== null);
        if (points.length === 0) return null;
        return (
          <g key={d}>
            <polyline
              fill="none"
              stroke={DIM_LINE_COLORS[d]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.join(" ")}
            />
            {points.map((p, i) => {
              const [x, y] = p.split(",");
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#ffffff"
                  stroke={DIM_LINE_COLORS[d]}
                  strokeWidth="2"
                />
              );
            })}
          </g>
        );
      })}
      {/* X-axis labels */}
      {reps.map((r, i) => (
        <text
          key={r.repId}
          x={xFor(i)}
          y={height - 2}
          textAnchor="middle"
          fontFamily="system-ui"
          fontSize="9"
          fill="#94a3b8"
        >
          {r.isGraduationRep ? "G" : `R${r.repIndex + 1}`}
        </text>
      ))}
    </svg>
  );
}

function buildTakeaway(
  comparison: MuscleGroupComparison | null,
  reps: DayRepBreakdown[],
): string | null {
  if (reps.length === 0) return null;

  // Look for the biggest jump or biggest drop across the day's reps.
  const firstRep = reps[0]!;
  const lastNonGradRep = [...reps].reverse().find((r) => !r.isGraduationRep) ?? reps[reps.length - 1]!;

  const compositeJump = lastNonGradRep.composite - firstRep.composite;

  if (compositeJump >= 10) {
    return `You started at ${firstRep.composite} and finished at ${lastNonGradRep.composite} — you adjusted in real time. That ${compositeJump}-point climb is the muscle you came here to build.`;
  }
  if (compositeJump <= -10) {
    return `Your composite dropped ${Math.abs(compositeJump)} points from rep 1 to ${lastNonGradRep.isGraduationRep ? "graduation" : "rep " + (lastNonGradRep.repIndex + 1)}. Fatigue or overconfidence — either way, set the next day up to finish strong.`;
  }

  // Otherwise: find biggest cross-rep gap per dim
  const dimMovement: { dim: string; delta: number }[] = [];
  for (const d of ALL_DIMS) {
    const firstScore = firstRep.perDim[d];
    const lastScore = lastNonGradRep.perDim[d];
    if (firstScore == null || lastScore == null) continue;
    dimMovement.push({ dim: d, delta: lastScore - firstScore });
  }
  dimMovement.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const biggest = dimMovement[0];
  if (biggest && Math.abs(biggest.delta) >= 8) {
    const dimLabel = DIMENSION_LABELS[biggest.dim as SkillDimension];
    if (biggest.delta > 0) {
      return `${dimLabel} climbed ${biggest.delta} points across today's reps — that's the dim you adapted on. Carry the same instinct into tomorrow.`;
    }
    return `${dimLabel} dropped ${Math.abs(biggest.delta)} points across the day. That's where your attention loosened — next session, hold the line there from rep 1.`;
  }

  // Default: comment on overall composite tier
  const avg = Math.round(
    reps.reduce((s, r) => s + r.composite, 0) / reps.length,
  );
  if (avg >= 75) {
    return `Steady ${avg} composite across the day. Strong execution — the next move is breaking 85 on at least one rep.`;
  }
  if (avg >= 55) {
    return `Average composite ${avg}. The bones are there. Pick one dim to push harder on tomorrow rather than spreading effort across all six.`;
  }
  return `Composite landed at ${avg}. The next session, slow down — most of these reps lost points to rushed delivery and undercooked thinking, not missing skill.`;
}


// ─── PRD v3 Phase 2.7 helpers ─────────────────────────────────────────────

function StatPill({
  label,
  value,
  emoji,
}: {
  label: string;
  value: number;
  emoji?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-2 shadow-sm">
      <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums leading-tight">
        {emoji ? `${emoji} ` : ""}
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500">
        {label}
      </div>
    </div>
  );
}

/** Most improved Core Skill across the day: biggest first-rep → last-rep
 *  per-dim gain (graduation rep excluded — pressure reps skew dims). */
function findMostImprovedDim(
  reps: DayRepBreakdown[],
): { dim: SkillDimension; delta: number } | null {
  const normal = reps.filter((r) => !r.isGraduationRep);
  if (normal.length < 2) return null;
  const first = normal[0]!;
  const last = normal[normal.length - 1]!;
  let best: { dim: SkillDimension; delta: number } | null = null;
  for (const dim of ALL_DIMS) {
    const a = first.perDim[dim];
    const b = last.perDim[dim];
    if (a == null || b == null) continue;
    const delta = b - a;
    if (delta > 0 && (!best || delta > best.delta)) {
      best = { dim, delta };
    }
  }
  return best && best.delta >= 3 ? best : null;
}

/** The day's weakest average dimension (graduation rep excluded) — drives
 *  the "extra reps" Focus Drill CTA. */
function findWeakestDim(reps: DayRepBreakdown[]): SkillDimension | null {
  const normal = reps.filter((r) => !r.isGraduationRep);
  if (normal.length === 0) return null;
  let weakest: { dim: SkillDimension; avg: number } | null = null;
  for (const d of ALL_DIMS) {
    const vals = normal
      .map((r) => r.perDim[d])
      .filter((v): v is number => v != null);
    if (vals.length === 0) continue;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (!weakest || avg < weakest.avg) weakest = { dim: d, avg };
  }
  return weakest?.dim ?? null;
}

/** Coach recommendation (PRD §5.7): the next highest-value move, from the
 *  day's weakest average dimension. Deterministic Phase 2 copy — Phase 3's
 *  coaching memory replaces this with a personalized recommendation. */
function buildCoachRecommendation(
  dim: MuscleGroupId,
  reps: DayRepBreakdown[],
): string | null {
  const normal = reps.filter((r) => !r.isGraduationRep);
  if (normal.length === 0) return null;
  const sums = new Map<SkillDimension, { total: number; n: number }>();
  for (const rep of normal) {
    for (const d of ALL_DIMS) {
      const v = rep.perDim[d];
      if (v == null) continue;
      const cur = sums.get(d) ?? { total: 0, n: 0 };
      sums.set(d, { total: cur.total + v, n: cur.n + 1 });
    }
  }
  let weakest: { dim: SkillDimension; avg: number } | null = null;
  for (const [d, { total, n }] of sums) {
    if (n === 0) continue;
    const avg = total / n;
    if (!weakest || avg < weakest.avg) weakest = { dim: d, avg };
  }
  if (!weakest) return null;
  const label = DIMENSION_LABELS[weakest.dim];
  const trainedLabel = MUSCLE_GROUP_LABELS[dim];
  if (Math.round(weakest.avg) >= 80) {
    return `Solid across the board — keep the ${trainedLabel} streak going next session.`;
  }
  return `${label} averaged ${Math.round(weakest.avg)} today — it's the highest-value muscle to hit next.`;
}
