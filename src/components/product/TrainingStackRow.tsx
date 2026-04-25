"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Flame, Zap, Mic } from "lucide-react";

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
 * Three-up training-mode card row. Each card mirrors the Skill Lab
 * Station visual language (rounded-3xl, soft branded gradient, hover
 * lift, brand glow on hover) so the dashboard reads as part of the
 * same product, not a separate page.
 */
export function TrainingStackRow({ modes }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {modes.map((mode, i) => (
        <ModeStation key={mode.href} mode={mode} index={i} />
      ))}
    </div>
  );
}

function ModeStation({ mode, index }: { mode: Mode; index: number }) {
  const Icon =
    mode.iconKey === "workout" ? Flame : mode.iconKey === "lab" ? Zap : Mic;
  const accentTint =
    mode.iconKey === "workout"
      ? "from-amber-200/20 via-white to-brand-magenta/5"
      : mode.iconKey === "lab"
        ? "from-brand-blue/10 via-brand-lavender/5 to-brand-magenta/5"
        : "from-brand-magenta/10 via-white to-brand-blue/5";

  const nudge =
    mode.repsThisWeek === 0
      ? "Run one this week"
      : mode.repsThisWeek === 1
        ? "1 rep this week — keep going"
        : `${mode.repsThisWeek} reps this week`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      whileHover={{ y: -3 }}
    >
      <Link
        href={mode.href as never}
        className={`group relative block overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br ${accentTint} p-5 transition-all hover:border-brand-purple/30 hover:shadow-[0_14px_40px_-16px_rgba(176,114,255,0.45)]`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="brand-gradient grid size-10 place-items-center rounded-2xl shadow-[0_6px_18px_-6px_rgba(176,114,255,0.55)]">
            <Icon className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <div
            className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-600"
          >
            {mode.repsThisWeek}
            <span className="text-ink-400">/wk</span>
          </div>
        </div>
        <h3 className="mt-4 text-lg font-extrabold tracking-tight text-ink-900">
          {mode.label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">{mode.tagline}</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-ink-500">{nudge}</p>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-purple opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
