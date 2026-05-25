"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Beaker, Flame, Mic } from "lucide-react";

type Mode = {
  href: "/workout" | "/skill-lab" | "/build-a-rep";
  label: string;
  tagline: string;
  repsThisWeek: number;
  iconKey: "workout" | "lab" | "build";
};

type Props = {
  modes: readonly Mode[];
};

/**
 * Three-mode training row (V2 Updates dashboard redesign). Layout is
 * 1.7fr / 1fr / 1fr — Daily Workout reads as the primary action through
 * proportion alone. Daily Workout is full brand gradient with soft orbs
 * and a white CTA. Skill Lab and Build a Rep are white with an outlined
 * CTA so secondary actions stay obvious without being de-emphasized.
 */
export function TrainingStackRow({ modes }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.7fr_1fr_1fr]">
      {modes.map((mode, i) => {
        if (mode.iconKey === "workout") {
          return <DailyWorkoutCard key={mode.href} mode={mode} index={i} />;
        }
        return <SecondaryCard key={mode.href} mode={mode} index={i} />;
      })}
    </div>
  );
}

function DailyWorkoutCard({ mode, index }: { mode: Mode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      whileHover={{ y: -3 }}
    >
      <Link
        href={mode.href as never}
        className="brand-gradient group relative block overflow-hidden rounded-3xl p-6 text-white transition-all hover:shadow-[0_24px_60px_-22px_rgba(176,114,255,0.7)]"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-12 size-48 rounded-full bg-white/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-brand-magenta/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Flame className="size-5 text-white" strokeWidth={2.5} />
            </span>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/80">
              Daily Workout
            </p>
          </div>
          <h3 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.02em] md:text-4xl">
            {mode.label}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
            {mode.tagline}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-brand-purple shadow-lg transition group-hover:shadow-xl">
              Start Workout
              <ArrowRight className="size-4" strokeWidth={3} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              {mode.repsThisWeek === 0
                ? "Run one today"
                : `${mode.repsThisWeek} rep${mode.repsThisWeek === 1 ? "" : "s"} this week`}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SecondaryCard({ mode, index }: { mode: Mode; index: number }) {
  const Icon = mode.iconKey === "lab" ? Beaker : Mic;
  const accent =
    mode.iconKey === "lab"
      ? "from-brand-blue/10 via-white to-brand-lavender/5 dark:from-brand-blue/10 dark:via-ink-900 dark:to-brand-lavender/10"
      : "from-brand-magenta/10 via-white to-brand-blue/5 dark:from-brand-magenta/10 dark:via-ink-900 dark:to-brand-blue/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      whileHover={{ y: -3 }}
    >
      <Link
        href={mode.href as never}
        className={`group relative flex h-full flex-col rounded-3xl border border-ink-200 bg-gradient-to-br ${accent} p-5 transition-all hover:border-brand-purple/40 hover:shadow-[0_14px_40px_-16px_rgba(176,114,255,0.45)] dark:border-ink-700 dark:hover:border-brand-purple/50`}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-brand-blue/15 to-brand-magenta/15 dark:from-brand-blue/20 dark:to-brand-magenta/20">
            <Icon
              className="size-4.5 text-brand-purple dark:text-brand-lavender"
              strokeWidth={2.5}
            />
          </span>
        </div>
        <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
          {mode.label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
          {mode.tagline}
        </p>
        <div className="mt-auto pt-5">
          <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-brand-purple/30 bg-white px-4 py-2.5 text-xs font-bold text-brand-purple transition-colors group-hover:border-brand-purple group-hover:bg-brand-purple/5 dark:border-brand-purple/40 dark:bg-ink-800 dark:text-brand-lavender dark:group-hover:bg-brand-purple/15">
            Open
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
