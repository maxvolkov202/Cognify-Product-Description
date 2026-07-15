"use client";

// HC-4 — end-of-day "Here's how you did" summary. Standard depth per
// Max's 2026-05-22 direction: composite + delta vs last same-dim day,
// 4 rep mini-bars, per-dim trend line across the 4 reps, 1 biggest
// takeaway. Light theme matching the rest of the workout shell.

import Link from "next/link";
import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Mic,
  Sparkles,
} from "lucide-react";
import CelebrationSparkles from "./CelebrationSparkles";
import CountUpScore from "./CountUpScore";
import ProgressionStrip from "@/components/product/progression/ProgressionStrip";
import { softenScoreDelta } from "@/lib/ai/coach-focus";
import {
  APPLICATION_LABELS,
  type ApplicationId,
} from "@/types/application-skills";
import { cn } from "@/lib/utils/cn";
import { DIM_THEMES } from "@/lib/workout/dim-theme";
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
  const recommendation = buildCoachRecommendation(reps);
  const weakestToday = findWeakestDim(reps);
  const workoutMovement = computeWorkoutMovement(reps);

  // W6 — group the day's reps into per-exercise First → Retry loops.
  // Legacy reps (no exercise linkage) keep the flat mini-bar rendering.
  const exercisePairs = groupRepsByExercise(reps);
  const gradReps = reps.filter((r) => r.isGraduationRep);
  const legacyReps = reps.filter((r) => !r.exerciseId && !r.isGraduationRep);

  // Cognify treatment — single source for the day's dim identity.
  const theme = DIM_THEMES[dim];

  return (
    // Ambient dim-tinted glow painted as the container's own background so
    // it sits beneath every card without touching stacking or layout.
    <div className="space-y-5" style={{ backgroundImage: theme.ambient }}>
      {/* Hero — celebratory framing per PRD §5.7 + Hunter C16. */}
      <div className="relative text-center">
        <CelebrationSparkles />
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600 dark:text-brand-lavender">
          🎉 {MUSCLE_GROUP_LABELS[dim]} day complete
        </div>
        {/* Gradient hero score — the one bg-clip-text headline on screen. */}
        <div
          className={cn(
            "mt-2 text-6xl sm:text-7xl font-extrabold leading-none tabular-nums",
            "bg-gradient-to-br bg-clip-text text-transparent",
            theme.scoreGradient,
          )}
        >
          {composite != null ? <CountUpScore value={Math.round(composite)} /> : "—"}
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

      {/* PRD v3 Phase 6 (§10.8) — unified progression celebration:
          rank + progress + streak + achievements + weekly challenges. */}
      <ProgressionStrip />

      {/* §5.7 Workout Improvement — beginning-to-end of THIS workout. */}
      {workoutMovement.length > 0 && (
        <div className="text-center">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500 mb-1.5">
            This workout
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {workoutMovement.map((m) => (
              <span
                key={m.label}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                  m.delta > 0
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    : "border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-slate-500 dark:text-ink-400",
                )}
              >
                {m.label} {m.delta > 0 ? `+${m.delta}` : m.delta}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {/* Per-rep breakdown — W6 (§5.2): the day is a set of improvement
          LOOPS (First → Retry per exercise), not a flat run of reps.
          Exercise-linked reps render as one First → Retry row per
          exercise; reps with no exercise (legacy data) keep the flat
          mini-bars. */}
      {reps.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          {/* Dim-gradient hairline across the card top. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r",
              theme.tile,
            )}
          />
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-ink-400 mb-3">
            Today&apos;s reps
          </div>
          {exercisePairs.length > 0 ? (
            <div className="space-y-2.5">
              {exercisePairs.map((pair, i) => (
                <ExercisePairRow key={pair.exerciseId} pair={pair} index={i} />
              ))}
              {gradReps.map((rep) => (
                <div
                  key={rep.repId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-ink-800 bg-slate-50/60 dark:bg-ink-800/40 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-ink-200">
                    {rep.exerciseName ?? "Graduation rep"}
                    <span className="ml-1.5 rounded-full bg-purple-100 dark:bg-brand-purple/30 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-brand-lavender">
                      Grad
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {rep.composite}
                  </span>
                </div>
              ))}
              {legacyReps.length > 0 && (
                <div className="flex items-end justify-around gap-3 h-32 pt-1">
                  {legacyReps.map((rep) => (
                    <RepMiniBar key={rep.repId} rep={rep} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-end justify-around gap-3 h-32">
              {reps.map((rep) => (
                <RepMiniBar key={rep.repId} rep={rep} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — no reps recorded for this day (degraded fetch or a
          freeze-preserved day). Friendly, on-voice, no dead air. */}
      {reps.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 shadow-sm text-center">
          <Mic
            className="mx-auto w-5 h-5 text-slate-300 dark:text-ink-600"
            aria-hidden
          />
          <p className="mt-2 text-sm text-slate-500 dark:text-ink-400">
            No reps to show for this day. Tomorrow: no notes, no prep — just
            reps.
          </p>
        </div>
      )}

      {/* Per-dim trend line */}
      {reps.length >= 2 && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          {/* Dim-gradient hairline across the card top. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r",
              theme.tile,
            )}
          />
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

      {/* Coach recommendation (PRD §5.7) — the next highest-value move:
          either a targeted drill or (W7) a related Skill Lab application. */}
      {recommendation && (
        <div className="text-center text-xs text-slate-500 dark:text-ink-400">
          <span className="font-semibold text-purple-700 dark:text-brand-lavender">
            Coach&apos;s call:
          </span>{" "}
          {recommendation.kind === "lab" ? (
            <Link
              href={`/skill-lab/${recommendation.applicationId}`}
              className="font-semibold text-purple-700 dark:text-brand-lavender underline decoration-purple-300 dark:decoration-brand-purple/60 underline-offset-2 hover:text-purple-900 dark:hover:text-white"
            >
              Train {recommendation.label} in the Skill Lab →
            </Link>
          ) : (
            recommendation.text
          )}
        </div>
      )}

      {/* §5.7 — Reps Earned is the completion structure's FINAL element
          (C17: with all-time reps + streak). */}
      <div className="flex justify-center gap-3 text-center">
        <StatPill label="Reps today" value={reps.length} tile={theme.tile} />
        {lifetimeReps != null && (
          <StatPill label="All-time reps" value={lifetimeReps} tile={theme.tile} />
        )}
        {streakDays != null && streakDays > 0 && (
          <StatPill
            label="Day streak"
            value={streakDays}
            emoji="🔥"
            tile={theme.tile}
          />
        )}
      </div>

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

// ─── W6 (§5.2) — per-exercise First → Retry loop rows ─────────────────────

type ExercisePair = {
  exerciseId: string;
  exerciseName: string;
  /** Earliest first attempt on this exercise (reps arrive chronological). */
  first: DayRepBreakdown | null;
  /** Best-scoring retry/again attempt on this exercise. */
  bestFollowUp: DayRepBreakdown | null;
};

function groupRepsByExercise(reps: DayRepBreakdown[]): ExercisePair[] {
  const byExercise = new Map<string, ExercisePair>();
  for (const rep of reps) {
    if (!rep.exerciseId || rep.isGraduationRep) continue;
    let pair = byExercise.get(rep.exerciseId);
    if (!pair) {
      pair = {
        exerciseId: rep.exerciseId,
        exerciseName: rep.exerciseName ?? "Exercise",
        first: null,
        bestFollowUp: null,
      };
      byExercise.set(rep.exerciseId, pair);
    }
    if (rep.attemptKind === "first") {
      if (!pair.first) pair.first = rep;
    } else if (
      !pair.bestFollowUp ||
      rep.composite > pair.bestFollowUp.composite
    ) {
      pair.bestFollowUp = rep;
    }
  }
  return [...byExercise.values()];
}

function ExercisePairRow({
  pair,
  index = 0,
}: {
  pair: ExercisePair;
  index?: number;
}) {
  const { first, bestFollowUp } = pair;
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.25 + index * 0.08,
        duration: 0.4,
        ease: [0.32, 0.72, 0, 1],
      }}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-ink-800 bg-slate-50/60 dark:bg-ink-800/40 px-3 py-2"
    >
      <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-ink-200">
        {pair.exerciseName}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
        {first && bestFollowUp ? (
          <>
            <span>
              First {first.composite}{" "}
              <span aria-hidden className="text-slate-400 dark:text-ink-500">
                →
              </span>{" "}
              Retry {bestFollowUp.composite}
            </span>
            <PairDeltaChip
              delta={bestFollowUp.composite - first.composite}
            />
          </>
        ) : first ? (
          <span>First {first.composite}</span>
        ) : bestFollowUp ? (
          <span>Retry {bestFollowUp.composite}</span>
        ) : null}
      </span>
    </motion.div>
  );
}

/** Delta chip for a First → Retry pair. softenScoreDelta (Owen C10)
 *  governs the tone: celebrate positives, show small negatives plainly,
 *  and hide big negatives behind soft copy. */
function PairDeltaChip({ delta }: { delta: number }) {
  const soft = softenScoreDelta(Math.round(delta));
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
        soft.tone === "celebrate" &&
          "border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
        soft.tone !== "celebrate" &&
          "border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-slate-500 dark:text-ink-400",
      )}
    >
      {soft.showNumeric
        ? `${Math.round(delta) > 0 ? "+" : ""}${Math.round(delta)}`
        : "still settling"}
    </span>
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
      aria-label={`Per-dimension scores across the ${reps.length} rep${
        reps.length === 1 ? "" : "s"
      }`}
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
  tile,
}: {
  label: string;
  value: number;
  emoji?: string;
  /** Dim-gradient hairline classes (decorative, from DIM_THEMES). */
  tile?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-2 shadow-sm">
      {tile && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80",
            tile,
          )}
        />
      )}
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
 *  per-dim gain. Graduation rep excluded (pressure reps skew dims) AND
 *  W6: FIRST attempts only — retries improve on a rep the user just got
 *  coached on, so mixing them in double-counts the loop instead of
 *  measuring apples-to-apples movement across the day's exercises. */
function findMostImprovedDim(
  reps: DayRepBreakdown[],
): { dim: SkillDimension; delta: number } | null {
  const normal = reps.filter(
    (r) => !r.isGraduationRep && r.attemptKind === "first",
  );
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

/** §5.7 Workout Improvement — first→last rep deltas (composite + the
 *  dims that moved most), graduation rep excluded. Big negatives stay
 *  quiet per C10. W6: FIRST attempts only, so the beginning-to-end
 *  movement compares fresh takes on each exercise rather than crediting
 *  a coached retry against a cold first rep. */
function computeWorkoutMovement(
  reps: DayRepBreakdown[],
): { label: string; delta: number }[] {
  const normal = reps.filter(
    (r) => !r.isGraduationRep && r.attemptKind === "first",
  );
  if (normal.length < 2) return [];
  const first = normal[0]!;
  const last = normal[normal.length - 1]!;
  const out: { label: string; delta: number }[] = [];
  const compositeDelta = Math.round(last.composite - first.composite);
  if (compositeDelta >= -3) {
    out.push({ label: "Composite", delta: compositeDelta });
  }
  const dimDeltas = ALL_DIMS.map((d) => {
    const a = first.perDim[d];
    const b = last.perDim[d];
    return a != null && b != null
      ? { label: DIMENSION_LABELS[d], delta: Math.round(b - a) }
      : null;
  })
    .filter(
      (x): x is { label: string; delta: number } => x != null && x.delta > 0,
    )
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  return [...out, ...dimDeltas];
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

// W7 (PRD §5.7 lists "Train a related Application in the Skill Lab" as a
// legitimate Coach Recommendation) — weakest Core Skill → the Skill Lab
// application that most directly trains it:
//   structure         → storytelling  (a narrative arc IS structure applied)
//   clarity           → teaching      (explaining to a novice forces clarity)
//   thinking_quality  → persuasion    (argument construction under scrutiny)
//   conciseness       → presenting    (tight, audience-first delivery)
//   delivery          → presenting    (pacing/delivery is presenting's core)
//   tone              → interviewing  (calibrated warmth + credibility)
const DIM_TO_APPLICATION: Record<SkillDimension, ApplicationId> = {
  structure: "storytelling",
  clarity: "teaching",
  thinking_quality: "persuasion",
  conciseness: "presenting",
  delivery: "presenting",
  tone: "interviewing",
};

type CoachRecommendation =
  | { kind: "drill"; text: string }
  | { kind: "lab"; applicationId: ApplicationId; label: string };

/** Coach recommendation (PRD §5.7): the next highest-value move, from the
 *  day's weakest average dimension. Deterministic Phase 2 copy — Phase 3's
 *  coaching memory replaces this with a personalized recommendation.
 *
 *  W7 branch rule (deterministic, documented): recommend the Skill Lab
 *  when the weakest dim averaged >= 70 (the fundamentals aren't broken,
 *  so the next gain comes from applying them in a real-world context) OR
 *  on even UTC days-of-month (a simple alternating-day cadence so the
 *  Lab still surfaces regularly for users grinding below 70). Otherwise
 *  keep the targeted drill recommendation. */
function buildCoachRecommendation(
  reps: DayRepBreakdown[],
): CoachRecommendation | null {
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
  const roundedAvg = Math.round(weakest.avg);
  const isEvenUtcDay = new Date().getUTCDate() % 2 === 0;
  if (roundedAvg >= 70 || isEvenUtcDay) {
    const applicationId = DIM_TO_APPLICATION[weakest.dim];
    return {
      kind: "lab",
      applicationId,
      label: APPLICATION_LABELS[applicationId],
    };
  }
  return {
    kind: "drill",
    text: `${label} averaged ${roundedAvg} today — it's the highest-value muscle to hit next.`,
  };
}
