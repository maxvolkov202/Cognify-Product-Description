"use client";

import Link from "next/link";
import { Check, TrendingUp, Target, Flame, Zap } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";
import type { RepScore, SkillDimension } from "@/types/domain";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import { groupComposite } from "@/lib/scoring/rubric";
import type { WorkoutSessionPlan } from "@/lib/ai/workout-prompts";

type Props = {
  scores: RepScore[];
  totalReps: number;
  streakDays?: number | null;
  /** Average composite score from yesterday's reps (team spec: show delta). */
  yesterdayComposite?: number | null;
  /** Full plan — used to surface session-type-specific sections (Flow's
   *  archetype trajectory, Focus's dimension-specific callout). Scores
   *  are index-aligned with plan.reps. Optional for backwards compat. */
  plan?: WorkoutSessionPlan;
};

/**
 * End-of-workout summary (team spec).
 *
 * Shows:
 *   - Daily score (average composite)
 *   - Content + Delivery sub-composites
 *   - Streak (if available)
 *   - Tomorrow's focus (weakest dimension of the day)
 *   - CTAs to dashboard and progress
 */
export function WorkoutEnd({
  scores,
  totalReps,
  streakDays,
  yesterdayComposite,
  plan,
}: Props) {
  if (scores.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="surface-card p-10 text-center">
          <p className="text-ink-600">No reps were scored this session.</p>
          <div className="mt-6">
            <GradientButton href="/dashboard" size="lg">
              Back to dashboard
            </GradientButton>
          </div>
        </div>
      </div>
    );
  }

  const average = Math.round(
    scores.reduce((sum, s) => sum + s.composite, 0) / scores.length,
  );

  // Delta vs yesterday (team spec: "82 / 100 (+4 from yesterday)")
  const delta =
    typeof yesterdayComposite === "number" && yesterdayComposite > 0
      ? Math.round(average - yesterdayComposite)
      : null;

  // Build dimension averages across all reps in this session
  const allDims: SkillDimension[] = [
    ...SKILL_DIMENSION_GROUPS.content,
    ...SKILL_DIMENSION_GROUPS.delivery,
  ];
  const dimAverages: Partial<Record<SkillDimension, number>> = {};
  for (const dim of allDims) {
    const vals: number[] = [];
    for (const rep of scores) {
      const entry = rep.dimensions.find((d) => d.dimension === dim);
      if (entry) vals.push(entry.score);
    }
    if (vals.length > 0) {
      dimAverages[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  const contentAvg = groupComposite(dimAverages, "content");
  const deliveryAvg = groupComposite(dimAverages, "delivery");

  // Tomorrow's focus = weakest scoring dimension
  const ranked = (Object.entries(dimAverages) as [SkillDimension, number][])
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => a[1] - b[1]);
  const weakest = ranked[0] ?? null;

  const isFlow = plan?.sessionType === "flow";
  const isFocus = plan?.sessionType === "focus";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ——— Hero card: daily score ——————————————— */}
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1.5" aria-hidden="true" />
        <div className="p-10 text-center">
          <div className="brand-gradient mx-auto grid size-16 place-items-center rounded-2xl shadow-sm">
            {isFlow ? (
              <Zap
                className="size-8 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            ) : (
              <Check
                className="size-8 text-white"
                strokeWidth={3}
                aria-hidden="true"
              />
            )}
          </div>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            {isFlow
              ? "Flow complete."
              : isFocus
                ? "Focus session complete."
                : "Workout complete."}
          </h2>
          <p className="mt-3 text-base text-ink-600">
            {isFlow
              ? `${totalReps} pressure reps, back to back. That's composure under sustained load.`
              : isFocus && plan?.focusDimension
                ? `${totalReps} reps all drilling ${DIMENSION_LABELS[plan.focusDimension].toLowerCase()}. Focused work.`
                : `${totalReps} reps done. One rep closer to clarity.`}
          </p>

          <div className="mt-8 inline-flex flex-col items-center rounded-2xl border border-ink-200 bg-white px-10 py-6">
            <div className="brand-gradient-text text-6xl font-extrabold tabular-nums md:text-7xl">
              {average}
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Daily score
            </p>
            {delta !== null && (
              <p
                className={`mt-2 text-xs font-semibold tabular-nums ${
                  delta > 0
                    ? "text-success"
                    : delta < 0
                      ? "text-danger"
                      : "text-ink-500"
                }`}
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} from
                yesterday
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <GroupCard label="Content" score={contentAvg} />
            <GroupCard label="Delivery" score={deliveryAvg} />
          </div>
        </div>
      </div>

      {/* ——— Flow archetype trajectory ——————————————— */}
      {isFlow && plan && (
        <div className="surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-purple">
              Flow trajectory · the five archetypes
            </p>
            <h3 className="mt-2 text-lg font-extrabold text-ink-900">
              How you held up across the ramp.
            </h3>
            <ol className="mt-4 space-y-2">
              {plan.reps.map((slot, i) => {
                const score = scores[i];
                const composite = score ? score.composite : null;
                const archetype = slot.pressureArchetype;
                return (
                  <li
                    key={`${slot.repType.id}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-extrabold text-amber-800">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink-900">
                        {archetype?.name ?? slot.repType.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-500">
                        {archetype?.tagline ?? slot.repType.tagline}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="brand-gradient-text text-lg font-extrabold tabular-nums">
                        {composite ?? "—"}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                        composite
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              Flow trains recall speed under sustained pressure. Watch the
              composite trend across the ramp — staying stable (or climbing)
              from archetype 1 to archetype 5 is the sign of real composure.
            </p>
          </div>
        </div>
      )}

      {/* ——— Tomorrow's focus ——————————————— */}
      {weakest && (
        <div className="surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="flex items-start gap-4 p-6">
            <div className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl shadow-sm">
              <Target
                className="size-5 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Tomorrow&rsquo;s focus
              </p>
              <p className="mt-1 text-lg font-bold text-ink-900">
                Work on {DIMENSION_LABELS[weakest[0]].toLowerCase()}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                Weakest dimension today was{" "}
                <strong className="text-ink-800">
                  {DIMENSION_LABELS[weakest[0]]}
                </strong>{" "}
                at {Math.round(weakest[1])}/100. Tomorrow&rsquo;s workout will
                bias toward drills that train it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ——— Streak card ——————————————— */}
      {streakDays !== null && streakDays !== undefined && streakDays > 0 && (
        <div className="surface-card flex items-center gap-4 p-6">
          <div className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl shadow-sm">
            <Flame
              className="size-5 text-white"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Streak
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
              {streakDays} {streakDays === 1 ? "day" : "days"}
            </p>
          </div>
          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple hover:text-brand-magenta"
          >
            <TrendingUp className="size-3.5" />
            See trends
          </Link>
        </div>
      )}

      {/* ——— CTAs ——————————————— */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <GradientButton href="/dashboard" size="lg">
          Back to dashboard
        </GradientButton>
        <Link
          href="/progress"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
        >
          See all progress
        </Link>
      </div>
    </div>
  );
}

function GroupCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="brand-gradient-text mt-2 text-3xl font-extrabold tabular-nums">
        {score}
      </p>
    </div>
  );
}
