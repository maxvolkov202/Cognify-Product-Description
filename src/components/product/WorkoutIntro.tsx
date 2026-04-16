"use client";

import { Flame, Target, Timer, RotateCcw } from "lucide-react";
import type { WorkoutSessionPlan } from "@/lib/ai/workout-prompts";

type Props = {
  plan: WorkoutSessionPlan;
  hasResumeState?: boolean;
  onStart: () => void;
  onResume?: () => void;
};

export function WorkoutIntro({
  plan,
  hasResumeState,
  onStart,
  onResume,
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
            <Flame className="size-3.5" />
            Today&rsquo;s Workout
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
            Ready to train?
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">
            {repCount} reps across {uniqueRepTypes.length} speaking drills. No
            notes. No prep. Just reps and structure.
          </p>

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
