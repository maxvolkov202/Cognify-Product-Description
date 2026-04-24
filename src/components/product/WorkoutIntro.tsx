"use client";

import {
  Flame,
  Target,
  Timer,
  RotateCcw,
  Zap,
  ArrowRight,
  Lock,
} from "lucide-react";
import type { SessionType, WorkoutSessionPlan } from "@/lib/ai/workout-prompts";
import type { SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
import { SessionTypePicker } from "./SessionTypePicker";
import { cn } from "@/lib/utils/cn";

type Props = {
  plan: WorkoutSessionPlan;
  hasResumeState?: boolean;
  onStart: () => void;
  onResume?: () => void;
  /** Current streak in days — shown as a chip on the hero (mockup #1). */
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

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  focus: "Focus Session",
  combined: "Combined Session",
  flow: "Flow Session",
};

/**
 * Daily Workout Home — mockup #1 parity.
 *
 * Layout:
 *   - Optional "You paused earlier" banner at top
 *   - Header: "TODAY'S WORKOUT" kicker + "Ready to train?" H1 + "No
 *     notes. No prep. Just reps." sub
 *   - Session-type picker (existing SessionTypePicker, now at top)
 *   - Chip row: Session Type · X exercises · ~N min · N-day streak
 *   - Two-column grid:
 *       Left: "Today's training" numbered list — each rep shows its
 *             displayTitle, dimension label, duration, and a "hidden"
 *             lock badge. Active (first) rep revealed; later reps
 *             gated per mockup.
 *       Right: gradient "Enter the gym" hero — arrow icon, copy
 *              "Prompts are revealed one at a time. No prep needed.",
 *              big "Start training →" CTA, "Your first prompt appears
 *              the moment you start." footer.
 *
 * Mobile: columns stack (right-card above left-list on narrow viewports
 * so the CTA stays visible without a scroll).
 */
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
  const tagline = SESSION_TYPE_TAGLINES[plan.sessionType];
  const sessionTypeLabel =
    plan.sessionType === "focus" && plan.focusDimension
      ? `Focus · ${DIMENSION_LABELS[plan.focusDimension]}`
      : SESSION_TYPE_LABELS[plan.sessionType];

  return (
    <div className="mx-auto w-full max-w-5xl">
      {hasResumeState && onResume && (
        <div className="surface-card mb-5 flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-lg">
              <RotateCcw
                className="size-4 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
                You paused earlier
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink-900">
                Resume where you left off or start fresh below.
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

      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
          Today&rsquo;s workout
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
          Ready to train?
        </h1>
        <p className="mt-2 text-lg text-ink-500">No notes. No prep. Just reps.</p>
        <p className="mt-1 text-sm text-ink-500">{tagline}</p>
      </div>

      {/* Session-type picker */}
      {onChangeSessionType && (
        <div className="mb-5 surface-card p-5">
          <SessionTypePicker
            value={plan.sessionType}
            focusDimension={plan.focusDimension ?? null}
            onChange={onChangeSessionType}
          />
        </div>
      )}

      {/* Chip row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-lavender/50 bg-brand-lavender/10 px-3 py-1.5 text-[11px] font-bold text-brand-purple">
          {plan.sessionType === "flow" ? (
            <Zap className="size-3" strokeWidth={2.5} />
          ) : plan.sessionType === "focus" ? (
            <Target className="size-3" strokeWidth={2.5} />
          ) : (
            <Flame className="size-3" strokeWidth={2.5} />
          )}
          {sessionTypeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700">
          <Target className="size-3" strokeWidth={2.5} aria-hidden="true" />
          {repCount} exercises
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700">
          <Timer className="size-3" strokeWidth={2.5} aria-hidden="true" />
          ~{estimatedMinutes} min
        </span>
        {typeof streakDays === "number" && streakDays > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-900">
            <Flame
              className="size-3 text-orange-600"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            {streakDays} day streak
          </span>
        )}
      </div>

      {/* Two-column: today's training + enter the gym */}
      <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
        {/* Today's training list */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-brand-lavender/30 bg-white p-5 md:p-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
            Today&rsquo;s training
          </p>
          <ol className="mt-4 space-y-3">
            {plan.reps.map((rep, i) => {
              const hidden = i > 0;
              const durationSec = Math.round(rep.timeBudgetMs / 1000);
              const dimLabel = rep.pressureArchetype
                ? "Adaptability · respond under pressure"
                : `${DIMENSION_LABELS[rep.repType.primaryDimension]} · ${rep.repType.tagline.toLowerCase()}`;
              return (
                <li
                  key={`${rep.repType.id}-${i}`}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-3",
                    hidden && "bg-ink-50/30",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold",
                      hidden
                        ? "bg-ink-100 text-ink-400"
                        : "brand-gradient text-white",
                    )}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        hidden ? "text-ink-400" : "text-ink-900",
                      )}
                    >
                      {rep.pressureArchetype
                        ? rep.pressureArchetype.name
                        : rep.repType.name}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[11px]",
                        hidden ? "text-ink-400" : "text-ink-500",
                      )}
                    >
                      {dimLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "text-[10px] font-bold tabular-nums",
                        hidden ? "text-ink-400" : "text-ink-700",
                      )}
                    >
                      {durationSec} sec
                    </span>
                    {hidden && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-ink-400">
                        <Lock
                          className="size-2.5"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        hidden
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Enter the gym */}
        <div className="brand-gradient relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-[var(--shadow-glow)]">
          <div
            className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-8 size-56 rounded-full bg-brand-magenta/30 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex h-full flex-col items-center justify-between gap-6 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <ArrowRight
                className="size-6 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight md:text-4xl">
                Enter the gym
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/85 md:text-base">
                Prompts are revealed one at a time. No prep needed.
              </p>
            </div>
            <div className="w-full">
              <button
                type="button"
                onClick={onStart}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-extrabold text-brand-purple shadow-lg transition hover:shadow-xl"
              >
                Start training
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </button>
              <p className="mt-3 text-[11px] font-medium text-white/80">
                Your first prompt appears the moment you start.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
