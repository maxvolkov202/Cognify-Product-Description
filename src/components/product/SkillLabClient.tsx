"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  Check,
  Dumbbell,
  Flame,
  Layers,
  Minus,
  Plus,
  Target,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import {
  planFocusWorkout,
  planMixedSession,
  planPressureSession,
  type WorkoutSessionPlan,
} from "@/lib/ai/workout-prompts";
import type { ImprovementGoalId } from "@/lib/onboarding/constants";
import { SkillLabSession } from "./SkillLabSession";
import { cn } from "@/lib/utils/cn";

type Style = "focus" | "mixed" | "pressure";

type RepCountChoice = 1 | 3 | 5 | 999; // 999 = unlimited / full sequence

type Props = {
  currentScores: Partial<Record<SkillDimension, number | null>>;
  improvementGoals?: readonly ImprovementGoalId[];
};

type Phase =
  | { kind: "lobby" }
  | { kind: "focus-skill" }
  | { kind: "focus-reps"; dim: SkillDimension }
  | { kind: "mixed-skills" }
  | { kind: "mixed-reps"; selected: SkillDimension[] }
  | { kind: "pressure-reps" }
  | {
      kind: "session";
      style: Style;
      label: string;
      planSeed: WorkoutSessionPlan;
    };

/**
 * Skill Lab — team-spec restructure (V2 Updates 2026-04-24).
 *
 * Three training styles the user controls explicitly:
 *   - Focus: pick one dimension + rep count, drill it.
 *   - Mixed: multi-select dimensions + assign reps per dimension.
 *   - Pressure Training: pick rep count, cycle through pressure archetypes.
 *
 * Daily Workout is the zero-friction system-picked counterpart; Skill Lab
 * is the inverse — full user control. The visual identity here is
 * deliberately distinct: ink-heavy "training facility" palette with
 * brand glow accents, vs. Daily Workout's bright gradient hero.
 */
export function SkillLabClient({ currentScores, improvementGoals = [] }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "lobby" });

  // ——— Session start ————————————————————————————————————————

  function startFocus(dim: SkillDimension, reps: RepCountChoice) {
    const count = reps === 999 ? 6 : reps;
    const plan = planFocusWorkout({
      focusDimension: dim,
      count,
      goals: improvementGoals,
    });
    setPhase({
      kind: "session",
      style: "focus",
      label: `Focus · ${DIMENSION_LABELS[dim]}`,
      planSeed: plan,
    });
  }

  function startMixed(skillReps: { dimension: SkillDimension; reps: number }[]) {
    const plan = planMixedSession({ skillReps });
    setPhase({
      kind: "session",
      style: "mixed",
      label: "Mixed session",
      planSeed: plan,
    });
  }

  function startPressure(reps: RepCountChoice) {
    const count = reps === 999 ? 5 : reps;
    const plan = planPressureSession({ count });
    setPhase({
      kind: "session",
      style: "pressure",
      label: "Pressure training",
      planSeed: plan,
    });
  }

  function backToLobby() {
    setPhase({ kind: "lobby" });
  }

  // ——— Render —————————————————————————————————————————————

  if (phase.kind === "session") {
    return (
      <SkillLabSession
        plan={phase.planSeed}
        label={phase.label}
        onExit={backToLobby}
      />
    );
  }

  return (
    <LabShell phase={phase} onLeave={backToLobby}>
      {phase.kind === "lobby" && (
        <Lobby onPick={(s) => setPhase(stylePhase(s))} />
      )}
      {phase.kind === "focus-skill" && (
        <FocusSkillStep
          currentScores={currentScores}
          onBack={backToLobby}
          onPick={(dim) => setPhase({ kind: "focus-reps", dim })}
        />
      )}
      {phase.kind === "focus-reps" && (
        <RepCountStep
          title={`Drill ${DIMENSION_LABELS[phase.dim]}`}
          subtitle="How many reps today?"
          onBack={() => setPhase({ kind: "focus-skill" })}
          onPick={(reps) => startFocus(phase.dim, reps)}
        />
      )}
      {phase.kind === "mixed-skills" && (
        <MixedSkillStep
          currentScores={currentScores}
          onBack={backToLobby}
          onContinue={(selected) =>
            setPhase({ kind: "mixed-reps", selected })
          }
        />
      )}
      {phase.kind === "mixed-reps" && (
        <MixedRepsStep
          selected={phase.selected}
          onBack={() => setPhase({ kind: "mixed-skills" })}
          onStart={startMixed}
        />
      )}
      {phase.kind === "pressure-reps" && (
        <RepCountStep
          title="Pressure training"
          subtitle="How many pressure reps today?"
          unlimitedLabel="Full sequence"
          onBack={backToLobby}
          onPick={startPressure}
        />
      )}
    </LabShell>
  );
}

function stylePhase(s: Style): Phase {
  if (s === "focus") return { kind: "focus-skill" };
  if (s === "mixed") return { kind: "mixed-skills" };
  return { kind: "pressure-reps" };
}

// ——— Shell —————————————————————————————————————————————

function LabShell({
  children,
  phase,
  onLeave,
}: {
  children: React.ReactNode;
  phase: Phase;
  onLeave: () => void;
}) {
  const showHomeLink = phase.kind !== "lobby";
  return (
    <div className="relative">
      {/* Lab atmosphere: dark ink panel with subtle grid + brand glow. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-12 -z-10 mx-auto h-72 max-w-5xl rounded-[2rem] opacity-90"
        style={{
          background:
            "radial-gradient(60% 80% at 20% 10%, rgba(106,163,255,0.18), transparent 60%), radial-gradient(60% 80% at 90% 30%, rgba(231,124,240,0.18), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-white/90 px-3 py-1.5 backdrop-blur">
          <Beaker className="size-3.5 text-brand-purple" strokeWidth={2.5} />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink-700">
            Skill Lab
          </p>
        </div>
        {showHomeLink && (
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-500 hover:border-ink-300 hover:text-ink-900"
          >
            <ArrowLeft className="size-3" strokeWidth={2.5} />
            Lab home
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={phase.kind}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ——— Lobby ——————————————————————————————————————————————

const STYLES: Array<{
  id: Style;
  icon: typeof Target;
  title: string;
  blurb: string;
  pitch: string;
  glow: string;
}> = [
  {
    id: "focus",
    icon: Target,
    title: "Focus",
    blurb: "Train one communication skill deeply.",
    pitch: "Pick a skill. Drill it. Every rep targets the same dimension.",
    glow: "from-brand-blue/15 via-white to-brand-blue/5",
  },
  {
    id: "mixed",
    icon: Layers,
    title: "Mixed",
    blurb: "Train multiple skills together.",
    pitch: "Choose what to work on, set your reps per skill, train your stack.",
    glow: "from-brand-lavender/20 via-white to-brand-magenta/5",
  },
  {
    id: "pressure",
    icon: Flame,
    title: "Pressure Training",
    blurb: "Train under stress, speed, pushback, unpredictability.",
    pitch: "Run pressure reps to stay sharp when the heat is on.",
    glow: "from-brand-magenta/15 via-white to-amber-100/40",
  },
];

function Lobby({ onPick }: { onPick: (s: Style) => void }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl">
          Choose how you want to train.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-500">
          The lab is yours. Daily Workout picks for you. In here you set the
          intent, pick the skill, and decide how many reps you want to put in.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {STYLES.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            onClick={() => onPick(s.id)}
            className={cn(
              "group relative overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br p-6 text-left transition-all hover:border-brand-purple/40 hover:shadow-[0_24px_60px_-22px_rgba(176,114,255,0.5)]",
              s.glow,
            )}
          >
            <div className="brand-gradient mb-4 grid size-12 place-items-center rounded-2xl shadow-[0_8px_24px_-8px_rgba(176,114,255,0.6)]">
              <s.icon className="size-5 text-white" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-ink-900">
              {s.title}
            </h3>
            <p className="mt-1.5 text-sm font-semibold text-ink-700">
              {s.blurb}
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
              {s.pitch}
            </p>
            <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-brand-purple">
              Enter
              <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </div>
          </motion.button>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-50/60 p-4 text-xs text-ink-500">
        <Dumbbell className="size-3.5 text-ink-400" strokeWidth={2.5} />
        <span>
          Pick the lab when you know what to train. If you just want to put
          in a workout, the dashboard&rsquo;s Daily Workout chooses for you.
        </span>
      </p>
    </div>
  );
}

// ——— Focus: skill picker + rep count ——————————————————————

function FocusSkillStep({
  currentScores,
  onBack,
  onPick,
}: {
  currentScores: Partial<Record<SkillDimension, number | null>>;
  onBack: () => void;
  onPick: (dim: SkillDimension) => void;
}) {
  const focusDim = useMemo<SkillDimension | null>(() => {
    const unscored = SKILL_DIMENSIONS.find(
      (d) => typeof currentScores[d] !== "number",
    );
    if (unscored) return unscored;
    let weakest: SkillDimension | null = null;
    let min = Infinity;
    for (const d of SKILL_DIMENSIONS) {
      const s = currentScores[d];
      if (typeof s === "number" && s < min) {
        min = s;
        weakest = d;
      }
    }
    return weakest;
  }, [currentScores]);

  return (
    <section>
      <StepHeader
        eyebrow="Focus mode"
        title="Pick a skill to drill."
        subtitle="Your current averages across the six core skills. Pick the one you want to train."
        onBack={onBack}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SKILL_DIMENSIONS.map((dim, i) => {
          const score = currentScores[dim];
          const hasScore = typeof score === "number";
          const isContent = (
            SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
          ).includes(dim);
          const isFocus = dim === focusDim;
          return (
            <motion.button
              key={dim}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              onClick={() => onPick(dim)}
              className={cn(
                "group relative rounded-3xl border p-5 text-left transition-all",
                isFocus
                  ? "border-transparent bg-gradient-to-br from-brand-blue/10 via-brand-lavender/10 to-brand-magenta/10 shadow-[0_18px_50px_-20px_rgba(176,114,255,0.5)]"
                  : "border-ink-200 bg-white hover:border-brand-purple/30 hover:shadow-[0_12px_30px_-16px_rgba(176,114,255,0.4)]",
              )}
            >
              {isFocus && (
                <span className="brand-gradient absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                  <Zap className="size-2.5" strokeWidth={3} />
                  Suggested
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
                  isContent
                    ? "bg-brand-blue/10 text-brand-blue"
                    : "bg-brand-magenta/10 text-brand-magenta",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isContent ? "bg-brand-blue" : "bg-brand-magenta",
                  )}
                />
                {isContent ? "Content" : "Delivery"}
              </span>
              <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900">
                {DIMENSION_LABELS[dim]}
              </h3>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Avg score
                </p>
                {hasScore ? (
                  <p className="brand-gradient-text text-3xl font-extrabold tabular-nums leading-none">
                    {score}
                  </p>
                ) : (
                  <span className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    Untrained
                  </span>
                )}
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-purple opacity-0 transition-opacity group-hover:opacity-100">
                Drill {DIMENSION_LABELS[dim].toLowerCase()}
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function RepCountStep({
  title,
  subtitle,
  onBack,
  onPick,
  unlimitedLabel = "Unlimited",
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onPick: (reps: RepCountChoice) => void;
  unlimitedLabel?: string;
}) {
  const choices: { value: RepCountChoice; label: string; sub: string }[] = [
    { value: 1, label: "1 rep", sub: "Quick set" },
    { value: 3, label: "3 reps", sub: "Build volume" },
    { value: 5, label: "5 reps", sub: "Real workout" },
    { value: 999, label: unlimitedLabel, sub: "Go until you call it" },
  ];
  return (
    <section>
      <StepHeader
        eyebrow="Rep count"
        title={title}
        subtitle={subtitle}
        onBack={onBack}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {choices.map((c, i) => (
          <motion.button
            key={String(c.value)}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            onClick={() => onPick(c.value)}
            className="group rounded-3xl border border-ink-200 bg-white p-5 text-left transition-all hover:border-brand-purple/40 hover:shadow-[0_18px_44px_-22px_rgba(176,114,255,0.5)]"
          >
            <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink-900">
              {c.label}
            </p>
            <p className="mt-1 text-xs font-semibold text-ink-500">{c.sub}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-purple opacity-0 transition-opacity group-hover:opacity-100">
              Start
              <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

// ——— Mixed: skill multi-select + reps per skill ————————————

function MixedSkillStep({
  currentScores,
  onBack,
  onContinue,
}: {
  currentScores: Partial<Record<SkillDimension, number | null>>;
  onBack: () => void;
  onContinue: (selected: SkillDimension[]) => void;
}) {
  const [selected, setSelected] = useState<SkillDimension[]>([]);
  function toggle(dim: SkillDimension) {
    setSelected((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim],
    );
  }
  return (
    <section>
      <StepHeader
        eyebrow="Mixed mode"
        title="Pick the skills you want to work on."
        subtitle="Multi-select. Next step you decide how many reps each one gets."
        onBack={onBack}
      />
      <div className="flex flex-wrap gap-2.5">
        {SKILL_DIMENSIONS.map((dim) => {
          const isOn = selected.includes(dim);
          const score = currentScores[dim];
          return (
            <motion.button
              key={dim}
              type="button"
              onClick={() => toggle(dim)}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all",
                isOn
                  ? "brand-gradient border-transparent text-white shadow-[0_8px_22px_-10px_rgba(176,114,255,0.6)]"
                  : "border-ink-200 bg-white text-ink-700 hover:border-brand-purple/40",
              )}
            >
              {isOn && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="grid size-4 place-items-center rounded-full bg-white/30"
                >
                  <Check className="size-2.5 text-white" strokeWidth={3} />
                </motion.span>
              )}
              {DIMENSION_LABELS[dim]}
              {typeof score === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-extrabold tabular-nums",
                    isOn ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500",
                  )}
                >
                  {score}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4">
        <p className="text-xs font-semibold text-ink-600">
          {selected.length === 0
            ? "Pick at least one skill to continue."
            : `${selected.length} skill${selected.length === 1 ? "" : "s"} selected`}
        </p>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onContinue(selected)}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Set reps per skill
          <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}

function MixedRepsStep({
  selected,
  onBack,
  onStart,
}: {
  selected: SkillDimension[];
  onBack: () => void;
  onStart: (skillReps: { dimension: SkillDimension; reps: number }[]) => void;
}) {
  const [reps, setReps] = useState<Record<SkillDimension, number>>(() => {
    const init: Partial<Record<SkillDimension, number>> = {};
    for (const d of selected) init[d] = 1;
    return init as Record<SkillDimension, number>;
  });
  const total = Object.values(reps).reduce((s, n) => s + n, 0);

  function bump(dim: SkillDimension, delta: number) {
    setReps((prev) => ({
      ...prev,
      [dim]: Math.max(0, Math.min(5, (prev[dim] ?? 0) + delta)),
    }));
  }

  return (
    <section>
      <StepHeader
        eyebrow="Mixed mode"
        title="Set reps per skill."
        subtitle="Total session length is the sum of your reps. We interleave them so you don't repeat the same skill back to back."
        onBack={onBack}
      />
      <div className="grid gap-3">
        {selected.map((dim, i) => (
          <motion.div
            key={dim}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-4"
          >
            <div>
              <p className="text-base font-extrabold tracking-tight text-ink-900">
                {DIMENSION_LABELS[dim]}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {reps[dim] === 0
                  ? "Skip"
                  : `${reps[dim]} rep${reps[dim] === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => bump(dim, -1)}
                disabled={reps[dim] === 0}
                className="grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Decrease ${DIMENSION_LABELS[dim]} reps`}
              >
                <Minus className="size-4" strokeWidth={2.5} />
              </button>
              <span className="w-10 text-center text-2xl font-extrabold tabular-nums text-ink-900">
                {reps[dim]}
              </span>
              <button
                type="button"
                onClick={() => bump(dim, 1)}
                disabled={reps[dim] === 5}
                className="grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Increase ${DIMENSION_LABELS[dim]} reps`}
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            Session total
          </p>
          <p className="brand-gradient-text text-3xl font-extrabold tabular-nums tracking-tight">
            {total} rep{total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          disabled={total === 0}
          onClick={() =>
            onStart(
              selected
                .map((d) => ({ dimension: d, reps: reps[d] ?? 0 }))
                .filter((s) => s.reps > 0),
            )
          }
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start session
          <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}

// ——— Step header ———————————————————————————————————————

function StepHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-7">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Back
      </button>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-base text-ink-500">{subtitle}</p>
    </div>
  );
}
