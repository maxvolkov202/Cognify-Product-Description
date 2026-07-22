"use client";

import { Beaker, Flame, Mic, Sparkles } from "lucide-react";

/**
 * Shared mode identity for in-rep surfaces. Each mode gets a distinct
 * palette + icon so the user always knows which product they're in
 * once recording starts. Daily Workout = warm amber (the daily habit).
 * Skill Lab = cool blue (the lab). Build a Rep = magenta (the spotlight,
 * preparing for a real moment).
 *
 *   - DailyWorkoutMode → warm amber, Flame
 *   - SkillLabMode     → cool blue, Beaker
 *   - BuildARepMode    → magenta, Mic
 *   - ScenarioMode     → fallback for legacy callers
 */
export type ModeKind =
  | "daily_workout"
  | "skill_lab"
  | "build_a_rep"
  | "scenario";

type Accent = {
  /** Background tint for the badge pill. */
  pill: string;
  /** Border color for the badge pill. */
  pillBorder: string;
  /** Foreground (text + icon) for the badge pill. */
  pillFg: string;
  /** Halo color used by countdowns and rep surfaces for ambient identity. */
  halo: string;
  /** Halo seam used as a thin underline below mode chrome. */
  seam: string;
  Icon: typeof Flame;
  label: string;
};

const ACCENTS: Record<ModeKind, Accent> = {
  daily_workout: {
    pill: "bg-amber-50",
    pillBorder: "border-amber-200",
    pillFg: "text-amber-700",
    halo: "rgba(251, 191, 36, 0.32)",
    seam: "from-amber-300/60 via-orange-300/40 to-amber-200/0",
    Icon: Flame,
    label: "Daily Workout",
  },
  skill_lab: {
    pill: "bg-brand-blue/10",
    pillBorder: "border-brand-blue/30",
    pillFg: "text-brand-blue",
    halo: "rgba(106, 163, 255, 0.32)",
    seam: "from-brand-blue/60 via-brand-lavender/40 to-brand-blue/0",
    Icon: Beaker,
    label: "Application Lab",
  },
  build_a_rep: {
    pill: "bg-brand-magenta/10",
    pillBorder: "border-brand-magenta/30",
    pillFg: "text-brand-magenta",
    halo: "rgba(231, 124, 240, 0.34)",
    seam: "from-brand-magenta/60 via-brand-purple/40 to-brand-magenta/0",
    Icon: Mic,
    label: "Build a Rep",
  },
  scenario: {
    pill: "bg-brand-purple/10",
    pillBorder: "border-brand-purple/30",
    pillFg: "text-brand-purple",
    halo: "rgba(176, 114, 255, 0.32)",
    seam: "from-brand-purple/60 via-brand-magenta/40 to-brand-purple/0",
    Icon: Sparkles,
    label: "Scenario",
  },
};

export function getModeAccent(mode: ModeKind): Accent {
  return ACCENTS[mode];
}

export function ModeBadge({
  mode,
  label,
  className = "",
}: {
  mode: ModeKind;
  /** Optional override (e.g., "Focus · Clarity"). Falls back to the canonical label. */
  label?: string;
  className?: string;
}) {
  const accent = ACCENTS[mode];
  const { Icon } = accent;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] ${accent.pill} ${accent.pillBorder} ${accent.pillFg} ${className}`}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {label ?? accent.label}
    </span>
  );
}

/**
 * Soft ambient halo behind the in-rep / countdown surface that picks up
 * the mode's accent. Sits behind content as a -z-10 absolute element.
 */
export function ModeHalo({ mode }: { mode: ModeKind }) {
  const accent = ACCENTS[mode];
  return (
    <div
      className="pointer-events-none absolute inset-x-0 -top-12 -z-10 mx-auto h-72 max-w-3xl rounded-[2rem] opacity-70"
      aria-hidden="true"
      style={{
        background: `radial-gradient(60% 80% at 20% 10%, ${accent.halo}, transparent 60%), radial-gradient(60% 80% at 90% 30%, ${accent.halo}, transparent 60%)`,
      }}
    />
  );
}

/** A 1px gradient seam used under top chrome to color-code the surface. */
export function ModeSeam({ mode }: { mode: ModeKind }) {
  const accent = ACCENTS[mode];
  return (
    <div
      className={`mt-2 h-0.5 w-full rounded-full bg-gradient-to-r ${accent.seam}`}
      aria-hidden="true"
    />
  );
}
