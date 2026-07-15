"use client";

import { useEffect } from "react";
import { ArrowRight, Clock3, Dumbbell, Flame, Lock, RotateCcw } from "lucide-react";
import type { WorkoutSessionPlan } from "@/lib/workout/lab-plan";
import { DIMENSION_LABELS } from "@/types/domain";

type Props = {
  plan: WorkoutSessionPlan;
  streakDays?: number | null;
  /** When true, render the "you paused earlier" resume banner above the
   *  intro. Replaces the standalone ResumePrompt screen so the user
   *  always sees today's workout overview. */
  canResume?: boolean;
  onResume?: () => void;
  onStart: () => void;
};

const SESSION_TYPE_LABEL: Record<WorkoutSessionPlan["sessionType"], string> = {
  combined: "Combined Session",
  focus: "Focus Session",
  flow: "Flow Session",
};

/**
 * Daily Workout pre-start landing.
 *
 * Layout cribbed from Hunter's mockup (resume banner → "Ready to train?"
 * header → pill row → two-column overview/CTA). Brand polish on top:
 * gradient-bordered training list, magenta-tinted glow on the CTA card,
 * soft entrance animation. Single CTA → countdown.
 */
export function WorkoutIntro({
  plan,
  streakDays,
  canResume = false,
  onResume,
  onStart,
}: Props) {
  const minutes = Math.max(1, Math.round(plan.estimatedDurationSec / 60));
  const repCount = plan.reps.length;
  const sessionLabel = SESSION_TYPE_LABEL[plan.sessionType];

  return (
    <div className="mx-auto w-full max-w-5xl">
      {canResume && onResume && (
        <ResumeBanner onResume={onResume} />
      )}

      <header className={canResume ? "mt-8" : undefined}>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
          Today&rsquo;s workout
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
          Ready to train?
        </h1>
        <p className="mt-2 text-sm text-ink-500 md:text-base">
          No notes. No prep. Just reps.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Pill highlighted>{sessionLabel}</Pill>
          <Pill icon={<Dumbbell className="size-3.5" strokeWidth={2.5} />}>
            {repCount} exercises
          </Pill>
          <Pill icon={<Clock3 className="size-3.5" strokeWidth={2.5} />}>
            ~{minutes} min
          </Pill>
          <Pill icon={<Flame className="size-3.5" strokeWidth={2.5} />}>
            {streakDays && streakDays > 0
              ? `${streakDays} day streak`
              : "Start a streak"}
          </Pill>
        </div>
      </header>

      <div className="mt-6 space-y-5">
        <EnterTheGymCard onStart={onStart} />
        <TrainingList plan={plan} />
      </div>

      <SpaceToStart onTrigger={onStart} />
    </div>
  );
}

function ResumeBanner({ onResume }: { onResume: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-purple/10 text-brand-purple">
        <RotateCcw className="size-4" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
          You paused earlier
        </p>
        <p className="mt-0.5 text-sm font-bold text-ink-900">
          Resume where you left off or start fresh below.
        </p>
      </div>
      <button
        type="button"
        onClick={onResume}
        className="brand-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(151,136,255,0.6)]"
      >
        Resume
      </button>
    </div>
  );
}

function TrainingList({ plan }: { plan: WorkoutSessionPlan }) {
  return (
    <div className="rounded-2xl border border-ink-200/70 bg-white p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-400">
        Today&rsquo;s training
      </p>
      <ul className="mt-3 grid gap-2">
        {plan.reps.map((rep, i) => {
          const isPressure = !!rep.pressureArchetype;
          const title = isPressure
            ? rep.pressureArchetype!.name
            : rep.repType.name;
          const subtitle = isPressure
            ? `Pressure · ${rep.pressureArchetype!.tagline.toLowerCase()}`
            : `${DIMENSION_LABELS[rep.repType.primaryDimension]} · ${(rep.repType.instruction ?? "").toLowerCase()}`;
          const seconds = Math.round(rep.timeBudgetMs / 1000);
          return (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl px-2 py-2"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink-100 text-[12px] font-extrabold text-ink-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink-900">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-500">
                  {subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <p className="text-[11px] font-semibold tabular-nums text-ink-500">
                  {seconds}s
                </p>
                <Lock className="size-3 text-ink-400" strokeWidth={2.5} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EnterTheGymCard({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="brand-gradient group relative flex w-full min-h-[220px] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl px-8 py-12 text-center text-white shadow-[0_32px_80px_-24px_rgba(151,136,255,0.65)] transition-transform hover:scale-[1.01] active:scale-[0.995] md:min-h-[260px] md:py-14"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 size-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/15"
        aria-hidden="true"
      />

      <h2 className="relative inline-flex items-center gap-4 text-5xl font-extrabold tracking-[-0.02em] md:text-7xl">
        Start workout
        <span className="grid size-12 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:translate-x-1 md:size-16">
          <ArrowRight className="size-6 md:size-8" strokeWidth={2.75} />
        </span>
      </h2>

      <p className="relative mt-1 text-sm font-medium text-white/85 md:text-base">
        Your first prompt appears the moment you tap.
      </p>

      <p className="relative mt-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
        <kbd className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-extrabold tracking-normal">
          Space
        </kbd>
        or click anywhere
      </p>
    </button>
  );
}

function Pill({
  children,
  icon,
  highlighted,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  highlighted?: boolean;
}) {
  if (highlighted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple/10 px-3 py-1.5 text-[12px] font-bold text-brand-purple ring-1 ring-brand-purple/20">
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700">
      {icon}
      {children}
    </span>
  );
}

function SpaceToStart({ onTrigger }: { onTrigger: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
          return;
        e.preventDefault();
        onTrigger();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTrigger]);
  return null;
}
