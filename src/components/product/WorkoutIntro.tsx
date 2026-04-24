"use client";

import { Flame, Target, Timer, RotateCcw, Zap } from "lucide-react";
import type { SessionType, WorkoutSessionPlan } from "@/lib/ai/workout-prompts";
import type { SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
import { SessionTypePicker } from "./SessionTypePicker";

type Props = {
  plan: WorkoutSessionPlan;
  hasResumeState?: boolean;
  onStart: () => void;
  onResume?: () => void;
  /** Current streak in days — shown as a chip on the hero (mockup #1).
   *  Zero/null hides the chip. */
  streakDays?: number | null;
  /** Called when the user changes session type / focus dimension. The
   *  parent re-runs the relevant orchestrator and passes the new plan
   *  back in via the `plan` prop. */
  onChangeSessionType?: (next: {
    sessionType: SessionType;
    focusDimension: SkillDimension | null;
  }) => void;
};

const SESSION_TYPE_TAGLINES: Record<SessionType, string> = {
  focus: "Pick a muscle. Drill it. Everything today targets the same dimension.",
  combined:
    "A balanced mix. Multiple dimensions, goal-weighted, one pressure rep.",
  flow: "Five reps, pressure ramps, compressed feedback. Flow state work.",
};

export function WorkoutIntro({
  plan,
  hasResumeState,
  onStart,
  onResume,
  streakDays,
  onChangeSessionType,
}: Props) {
  const repCount = plan.reps.length;
  const estimatedMinutes = Math.max(
    5,
    Math.ceil(plan.estimatedDurationSec / 60),
  );
  // Unique rep types (a workout can, in theory, repeat a type; show each once)
  const uniqueRepTypes = Array.from(
    new Map(plan.reps.map((r) => [r.repType.id, r.repType])).values(),
  );
  const tagline = SESSION_TYPE_TAGLINES[plan.sessionType];

  return (
    <div className="mx-auto max-w-2xl">
      {hasResumeState && onResume && (
        <div className="surface-card mb-4 flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-lg">
              <RotateCcw
                className="size-4 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                You paused earlier
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink-900">
                Resume where you left off — or start fresh below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="brand-gradient shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm"
          >
            Resume
          </button>
        </div>
      )}

      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1.5" aria-hidden="true" />
        <div className="p-10 md:p-12">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            {plan.sessionType === "flow" ? (
              <Zap className="size-3.5" />
            ) : plan.sessionType === "focus" ? (
              <Target className="size-3.5" />
            ) : (
              <Flame className="size-3.5" />
            )}
            Today&rsquo;s Workout ·{" "}
            {plan.sessionType === "focus"
              ? `Focus${
                  plan.focusDimension
                    ? ` · ${DIMENSION_LABELS[plan.focusDimension]}`
                    : ""
                }`
              : plan.sessionType === "flow"
                ? "Flow"
                : "Combined"}
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
            Ready to train?
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">{tagline}</p>

          {streakDays !== undefined && streakDays !== null && streakDays > 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-orange-900">
              <Flame
                className="size-3 text-orange-600"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              {streakDays} {streakDays === 1 ? "day" : "days"} streak
            </div>
          )}

          {onChangeSessionType && (
            <div className="mt-6 border-t border-ink-200 pt-6">
              <SessionTypePicker
                value={plan.sessionType}
                focusDimension={plan.focusDimension ?? null}
                onChange={onChangeSessionType}
              />
            </div>
          )}

          <div className="mt-8 grid grid-cols-3 gap-4">
            <Stat
              icon={<Flame className="size-4 text-white" />}
              label="Reps"
              value={repCount.toString()}
            />
            <Stat
              icon={<Timer className="size-4 text-white" />}
              label="Minutes"
              value={`~${estimatedMinutes}`}
            />
            <Stat
              icon={<Target className="size-4 text-white" />}
              label="Drills"
              value={uniqueRepTypes.length.toString()}
            />
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Today&rsquo;s drills
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.reps.map((r, i) => (
                <span
                  key={`${r.repType.id}-${i}`}
                  className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700"
                >
                  {r.repType.name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <button
              type="button"
              onClick={onStart}
              className="brand-gradient inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              I&rsquo;m ready → start the countdown
            </button>
            <p className="mt-4 text-center text-xs text-ink-500">
              Each rep: pick one of 5 prompts, short countdown, speak. Feedback
              after every rep.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 text-center">
      <div className="flex justify-center">
        <span className="brand-gradient grid size-8 place-items-center rounded-lg">
          {icon}
        </span>
      </div>
      <div className="brand-gradient-text mt-3 text-3xl font-extrabold tabular-nums">
        {value}
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
    </div>
  );
}
