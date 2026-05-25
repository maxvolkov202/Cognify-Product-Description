"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  Crosshair,
  Dumbbell,
  Flame,
  Layers,
  Minus,
  Plus,
  Target,
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SKILL_DIMENSIONS, DIMENSION_LABELS } from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import {
  planFocusWorkout,
  planMixedSession,
  planPressureSession,
  type WorkoutSessionPlan,
} from "@/lib/ai/workout-prompts";
import type { ImprovementGoalId } from "@/lib/onboarding/constants";
import { SUB_SKILL_LABELS, type SubSkillId } from "@/types/sub-skills";
import { primaryExerciseFor } from "@/lib/ai/exercises";
import { SkillLabSession } from "./SkillLabSession";
import { cn } from "@/lib/utils/cn";
import {
  MODE_THEMES,
  DIMENSION_ACCENTS,
  type ModeId,
} from "@/lib/skill-lab/mode-theme";

type Style = "focus" | "mixed" | "pressure";

type RepCountChoice = 1 | 3 | 5 | 999; // 999 = unlimited / full sequence

type Props = {
  currentScores: Partial<Record<SkillDimension, number | null>>;
  improvementGoals?: readonly ImprovementGoalId[];
  /** Ch.12 — when set, opens directly into focus-reps for this dim
   *  (skipping the lobby + skill picker). Drives the "drill this
   *  sub-skill" routing from the dashboard's WeakestLinkCard /
   *  SubSkillBreakdownCard. */
  initialFocus?: SkillDimension;
  /** Ch.12 — accompanying sub-skill id from the routing query param.
   *  Currently surface-only: rendered as a "Focusing on {label}" pill
   *  in the rep-count step. Slate-bias is a follow-up — requires
   *  adding `preferSubSkills` plumbing through `planFocusWorkout`,
   *  which today selects rep types by primary dimension only. */
  initialSubSkill?: SubSkillId;
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
export function SkillLabClient({
  currentScores,
  improvementGoals = [],
  initialFocus,
  initialSubSkill,
}: Props) {
  // Ch.12 routing — when ?focus=<dim> is in the URL, jump straight to
  // the focus-reps step for that dim. Lobby is skipped entirely so the
  // "drill this sub-skill" CTA is one click away from a recording rep.
  const [phase, setPhase] = useState<Phase>(() =>
    initialFocus
      ? { kind: "focus-reps", dim: initialFocus }
      : { kind: "lobby" },
  );

  // Cross-session prompt history. Fetched on mount; passed to each
  // planner call so the initial slate excludes already-seen prompts.
  // Empty for guests / no-DB; failure to fetch is non-fatal (planner
  // falls back to no exclusions = legacy behavior).
  const [seenPromptIds, setSeenPromptIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const seenIdsLoadedRef = useRef(false);
  useEffect(() => {
    if (seenIdsLoadedRef.current) return;
    seenIdsLoadedRef.current = true;
    fetch("/api/prompt-history", { method: "GET" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((json: { ids?: string[] }) => {
        if (Array.isArray(json.ids)) setSeenPromptIds(new Set(json.ids));
      })
      .catch(() => {});
  }, []);

  // ——— Session start ————————————————————————————————————————

  function startFocus(dim: SkillDimension, reps: RepCountChoice) {
    const count = reps === 999 ? 6 : reps;
    // Ch.16b — when the user reached this step via a deep-link with a
    // sub-skill query param (initialSubSkill), forward that bias to
    // planFocusWorkout. The planner routes through the drill bank for
    // drillable dims so the slate is biased toward prompts targeting
    // that specific sub-skill. Non-drillable dims ignore the bias.
    const planSubSkill =
      initialFocus === dim && initialSubSkill ? initialSubSkill : undefined;
    const plan = planFocusWorkout({
      focusDimension: dim,
      count,
      goals: improvementGoals,
      excludePromptIds: seenPromptIds,
      ...(planSubSkill ? { preferSubSkill: planSubSkill } : {}),
    });
    setPhase({
      kind: "session",
      style: "focus",
      label: `Focus · ${DIMENSION_LABELS[dim]}`,
      planSeed: plan,
    });
  }

  function startMixed(skillReps: { dimension: SkillDimension; reps: number }[]) {
    const plan = planMixedSession({
      skillReps,
      excludePromptIds: seenPromptIds,
    });
    setPhase({
      kind: "session",
      style: "mixed",
      label: "Mixed session",
      planSeed: plan,
    });
  }

  function startPressure(reps: RepCountChoice) {
    const count = reps === 999 ? 5 : reps;
    const plan = planPressureSession({
      count,
      excludePromptIds: seenPromptIds,
    });
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
        style={phase.style}
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
      {phase.kind === "focus-reps" && (() => {
        // Ch.16 — surface today's named exercise above the rep-count
        // step. Bias toward the exercise that targets the deep-linked
        // sub-skill when present; otherwise pick the dim's primary
        // exercise. Pure surface — exerciseId isn't yet plumbed
        // through to the prompt picker (per-prompt tagging is the
        // Ch.16 follow-up that wires this data into selection).
        const exercise = primaryExerciseFor(
          phase.dim,
          initialFocus === phase.dim ? initialSubSkill : undefined,
        );
        return (
          <RepCountStep
            title={`Drill ${DIMENSION_LABELS[phase.dim]}`}
            subtitle={
              initialSubSkill && initialFocus === phase.dim
                ? `Focusing on ${SUB_SKILL_LABELS[initialSubSkill]}. How many reps today?`
                : "How many reps today?"
            }
            exerciseLabel={`Today's exercise: ${exercise.name}`}
            exerciseTagline={exercise.tagline}
            onBack={
              initialFocus === phase.dim
                ? backToLobby
                : () => setPhase({ kind: "focus-skill" })
            }
            onPick={(reps) => startFocus(phase.dim, reps)}
          />
        );
      })()}
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
        <>
          <PressureLobbyHero />
          <RepCountStep
            title="Pressure training"
            subtitle="How many pressure reps today?"
            unlimitedLabel="Full sequence"
            onBack={backToLobby}
            onPick={startPressure}
          />
        </>
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
        <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-white/90 px-3 py-1.5 backdrop-blur dark:border-ink-700 dark:bg-ink-900/90">
          <Beaker className="size-3.5 text-brand-purple dark:text-brand-lavender" strokeWidth={2.5} />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink-700 dark:text-ink-200">
            Skill Lab
          </p>
        </div>
        {showHomeLink && (
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-500 hover:border-ink-300 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400 dark:hover:border-ink-600 dark:hover:text-white"
          >
            <ArrowLeft className="size-3" strokeWidth={2.5} />
            Lab home
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
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
}> = [
  {
    id: "focus",
    icon: Crosshair,
    title: "Focus",
    blurb: "Train one communication skill deeply.",
    pitch: "Lock in on one skill. Every rep targets the same muscle. Depth.",
  },
  {
    id: "mixed",
    icon: Layers,
    title: "Mixed",
    blurb: "Build a stack of skills.",
    pitch: "Pick the skills you want, stack the reps, interleave them. Breadth.",
  },
  {
    id: "pressure",
    icon: Flame,
    title: "Pressure Training",
    blurb: "Train under stress, speed, pushback.",
    pitch: "Cycle the pressure catalog. Train the version of you under heat.",
  },
];

function Lobby({ onPick }: { onPick: (s: Style) => void }) {
  return (
    <div>
      <div className="mb-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
          Skill Lab
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl dark:text-white">
          Choose how you want to train.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-500 md:text-base dark:text-ink-400">
          The lab is yours. Daily Workout picks for you — in here you set the
          intent, pick the skill, and decide how many reps you want to put in.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple/10 px-3 py-1.5 text-[12px] font-bold text-brand-purple ring-1 ring-brand-purple/20 dark:bg-brand-purple/20 dark:text-brand-lavender">
            3 modes
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            <Crosshair className="size-3.5" strokeWidth={2.5} />
            Any skill
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            <Layers className="size-3.5" strokeWidth={2.5} />
            Any rep count
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            <Flame className="size-3.5" strokeWidth={2.5} />
            No session cap
          </span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {STYLES.map((s, i) => {
          const theme = MODE_THEMES[s.id as ModeId];
          return (
            <motion.button
              key={s.id}
              type="button"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              whileHover={{ y: -3 }}
              onClick={() => onPick(s.id)}
              className={cn(
                "group relative overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br p-6 text-left transition-all hover:border-brand-purple/40 hover:shadow-[0_24px_60px_-22px_rgba(176,114,255,0.5)] dark:border-ink-700",
                theme.lobbyGlow,
              )}
            >
              {/* Mode-tinted icon tile uses the mode's accent color, not the
               *  generic brand gradient — gives each lobby card its own
               *  signature at first glance. */}
              <div
                className="mb-4 grid size-12 place-items-center rounded-2xl shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)]"
                style={{ backgroundColor: theme.accentColor }}
              >
                <s.icon className="size-5 text-white" strokeWidth={2.5} />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em]",
                  theme.chipBorder,
                  theme.chipBg,
                  theme.chipText,
                )}
              >
                {theme.imperative}
              </span>
              <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm font-semibold text-ink-700 dark:text-ink-200">
                {s.blurb}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">
                {s.pitch}
              </p>
              <div
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: theme.accentColor }}
              >
                Enter
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </div>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-6 flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-50/60 p-4 text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400">
        <Dumbbell className="size-3.5 text-ink-400 dark:text-ink-500" strokeWidth={2.5} />
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

  const theme = MODE_THEMES.focus;

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Back
      </button>

      {/* Focus hero — crosshair + "lock in" framing makes Focus feel like
       *  a sniper drill, not a sampler platter. The suggested dim is the
       *  prominent target; the rest is the candidate roster. */}
      <div
        className={cn(
          "mb-7 overflow-hidden rounded-3xl border border-brand-blue/20 p-6 md:p-7",
          theme.heroBg,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em]",
                theme.chipBorder,
                theme.chipBg,
                theme.chipText,
              )}
            >
              <Crosshair className="size-3" strokeWidth={3} />
              Focus mode
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl dark:text-white">
              {theme.pickerHeadline}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
              {theme.pickerSubhead}
            </p>
          </div>
          {focusDim && (
            <div
              className="hidden shrink-0 items-center gap-3 rounded-2xl border border-brand-blue/30 bg-white/80 p-3 backdrop-blur md:flex dark:bg-ink-900/80"
              title="Recommended target based on your weakest dim"
            >
              <div
                className="grid size-10 place-items-center rounded-xl"
                style={{ backgroundColor: DIMENSION_ACCENTS[focusDim] }}
              >
                <Crosshair className="size-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  Recommended
                </p>
                <p className="text-base font-extrabold tracking-tight text-ink-900 dark:text-white">
                  {DIMENSION_LABELS[focusDim]}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SKILL_DIMENSIONS.map((dim, i) => {
          const score = currentScores[dim];
          const hasScore = typeof score === "number";
          const isFocus = dim === focusDim;
          const dimColor = DIMENSION_ACCENTS[dim];
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
                "group relative overflow-hidden rounded-3xl border bg-white p-5 text-left transition-all dark:bg-ink-900",
                isFocus
                  ? "shadow-[0_18px_50px_-20px_rgba(106,163,255,0.55)]"
                  : "border-ink-200 hover:shadow-[0_12px_30px_-16px_rgba(106,163,255,0.45)] dark:border-ink-700",
              )}
              style={
                isFocus
                  ? { borderColor: dimColor, boxShadow: `inset 0 0 0 2px ${dimColor}` }
                  : undefined
              }
            >
              {/* Crosshair-style corner brackets evoke "target lock" — the
               *  visual signature for Focus mode. Brackets render only on
               *  the suggested tile and on hover. */}
              <span
                className={cn(
                  "absolute left-2 top-2 size-3 border-l-2 border-t-2 transition-opacity",
                  isFocus ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{ borderColor: dimColor }}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "absolute right-2 top-2 size-3 border-r-2 border-t-2 transition-opacity",
                  isFocus ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{ borderColor: dimColor }}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "absolute bottom-2 left-2 size-3 border-b-2 border-l-2 transition-opacity",
                  isFocus ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{ borderColor: dimColor }}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "absolute bottom-2 right-2 size-3 border-b-2 border-r-2 transition-opacity",
                  isFocus ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{ borderColor: dimColor }}
                aria-hidden="true"
              />

              {isFocus && (
                <span
                  className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
                  style={{ backgroundColor: dimColor }}
                >
                  <Zap className="size-2.5" strokeWidth={3} />
                  Lock on
                </span>
              )}

              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ backgroundColor: `${dimColor}1a`, color: dimColor }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: dimColor }}
                />
                Target
              </span>
              <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
                {DIMENSION_LABELS[dim]}
              </h3>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  Avg score
                </p>
                {hasScore ? (
                  <p
                    className="text-3xl font-extrabold tabular-nums leading-none"
                    style={{ color: dimColor }}
                  >
                    {score}
                  </p>
                ) : (
                  <span className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
                    Untrained
                  </span>
                )}
              </div>
              <div
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: dimColor }}
              >
                Lock in {DIMENSION_LABELS[dim].toLowerCase()}
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
  exerciseLabel,
  exerciseTagline,
  onBack,
  onPick,
  unlimitedLabel = "Unlimited",
}: {
  title: string;
  subtitle: string;
  /** Ch.16 — when set, renders a "Today's exercise: X" pill above the
   *  rep-count buttons. Lets the user see which named curriculum
   *  exercise they're about to train, vs an anonymous prompt id. */
  exerciseLabel?: string;
  exerciseTagline?: string;
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
      {exerciseLabel && (
        <div className="mb-5 flex flex-wrap items-baseline gap-2 rounded-2xl border border-brand-purple/20 bg-brand-purple/5 px-4 py-3 dark:bg-brand-purple/15">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
            {exerciseLabel}
          </span>
          {exerciseTagline && (
            <span className="text-[12px] text-ink-600 dark:text-ink-300">
              {exerciseTagline}
            </span>
          )}
        </div>
      )}
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
            className="group rounded-3xl border border-ink-200 bg-white p-5 text-left transition-all hover:border-brand-purple/40 hover:shadow-[0_18px_44px_-22px_rgba(176,114,255,0.5)] dark:border-ink-700 dark:bg-ink-900"
          >
            <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink-900 dark:text-white">
              {c.label}
            </p>
            <p className="mt-1 text-xs font-semibold text-ink-500 dark:text-ink-400">{c.sub}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-purple opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-lavender">
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
  const theme = MODE_THEMES.mixed;

  function toggle(dim: SkillDimension) {
    setSelected((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim],
    );
  }

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Back
      </button>

      {/* Mixed hero — Layers icon + live stack visualization. The live
       *  stack reads like a vertical recipe of dimension cards the user
       *  is adding to. Distinct visual metaphor from Focus's crosshair. */}
      <div
        className={cn(
          "mb-7 overflow-hidden rounded-3xl border border-brand-purple/20 p-6 md:p-7",
          theme.heroBg,
        )}
      >
        <div className="grid items-start gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <p
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em]",
                theme.chipBorder,
                theme.chipBg,
                theme.chipText,
              )}
            >
              <Layers className="size-3" strokeWidth={3} />
              Mixed mode
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl dark:text-white">
              {theme.pickerHeadline}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
              {theme.pickerSubhead}
            </p>
          </div>
          <StackPreview selected={selected} onRemove={toggle} />
        </div>
      </div>

      <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        Tap to add to your stack
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SKILL_DIMENSIONS.map((dim, i) => {
          const isOn = selected.includes(dim);
          const score = currentScores[dim];
          const hasScore = typeof score === "number";
          const dimColor = DIMENSION_ACCENTS[dim];
          const stackPos = isOn ? selected.indexOf(dim) + 1 : null;
          return (
            <motion.button
              key={dim}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              onClick={() => toggle(dim)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-5 text-left transition-all",
                isOn
                  ? "border-transparent shadow-[0_18px_50px_-20px_rgba(176,114,255,0.6)]"
                  : "border-ink-200 bg-white hover:border-brand-purple/30 hover:shadow-[0_12px_30px_-16px_rgba(176,114,255,0.4)] dark:border-ink-700 dark:bg-ink-900",
              )}
              style={
                isOn
                  ? {
                      backgroundImage: `linear-gradient(135deg, ${dimColor}26, ${dimColor}0d 50%, white)`,
                    }
                  : undefined
              }
            >
              {isOn && stackPos !== null && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full text-[12px] font-extrabold tabular-nums text-white shadow-sm"
                  style={{ backgroundColor: dimColor }}
                  aria-label={`Position ${stackPos} in stack`}
                >
                  {stackPos}
                </motion.span>
              )}
              {!isOn && (
                <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full border border-ink-200 bg-white text-ink-400 transition-colors group-hover:border-brand-purple/40 group-hover:text-brand-purple dark:border-ink-700 dark:bg-ink-900 dark:text-ink-500">
                  <Plus className="size-3.5" strokeWidth={3} />
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ backgroundColor: `${dimColor}1a`, color: dimColor }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: dimColor }}
                />
                Layer
              </span>
              <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
                {DIMENSION_LABELS[dim]}
              </h3>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  Avg score
                </p>
                {hasScore ? (
                  <p
                    className="text-2xl font-extrabold tabular-nums leading-none"
                    style={{ color: dimColor }}
                  >
                    {score}
                  </p>
                ) : (
                  <span className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
                    Untrained
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
      <div
        className={cn(
          "sticky bottom-3 mt-8 flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-[0_12px_30px_-16px_rgba(176,114,255,0.45)] dark:bg-ink-900",
          theme.chipBorder,
        )}
      >
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            Stack
          </p>
          <p className="text-sm font-bold text-ink-800 dark:text-ink-100">
            {selected.length === 0
              ? "Empty — pick at least one layer"
              : `${selected.length} layer${selected.length === 1 ? "" : "s"} selected`}
          </p>
        </div>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onContinue(selected)}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: theme.accentColor }}
        >
          Set reps per layer
          <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}

/**
 * Live preview of the stack the user is building. Renders selected layers
 * as a vertical pile of dim-tinted strips. Empty state shows a hint frame
 * so the user understands what the box becomes once they tap a layer.
 */
function StackPreview({
  selected,
  onRemove,
}: {
  selected: SkillDimension[];
  onRemove: (dim: SkillDimension) => void;
}) {
  if (selected.length === 0) {
    return (
      <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-purple/30 bg-white/60 p-4 text-center dark:bg-ink-900/60">
        <Layers
          className="size-6 text-brand-purple/60 dark:text-brand-lavender/70"
          strokeWidth={2}
          aria-hidden="true"
        />
        <p className="text-[11px] font-semibold leading-snug text-ink-500 dark:text-ink-400">
          Your stack appears here as you tap layers below.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-brand-purple/20 bg-white/80 p-3 backdrop-blur dark:bg-ink-900/80">
      <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
        Today&rsquo;s stack
      </p>
      <ul className="space-y-1.5">
        {selected.map((dim, idx) => {
          const dimColor = DIMENSION_ACCENTS[dim];
          return (
            <motion.li
              key={dim}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5 dark:border-ink-700"
              style={{ backgroundColor: `${dimColor}10` }}
            >
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold tabular-nums text-white"
                style={{ backgroundColor: dimColor }}
              >
                {idx + 1}
              </span>
              <span className="flex-1 text-xs font-bold text-ink-800 dark:text-ink-100">
                {DIMENSION_LABELS[dim]}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(dim);
                }}
                className="grid size-5 place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
                aria-label={`Remove ${DIMENSION_LABELS[dim]} from stack`}
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
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
            className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900"
          >
            <div>
              <p className="text-base font-extrabold tracking-tight text-ink-900 dark:text-white">
                {DIMENSION_LABELS[dim]}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
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
                className="grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
                aria-label={`Decrease ${DIMENSION_LABELS[dim]} reps`}
              >
                <Minus className="size-4" strokeWidth={2.5} />
              </button>
              <span className="w-10 text-center text-2xl font-extrabold tabular-nums text-ink-900 dark:text-white">
                {reps[dim]}
              </span>
              <button
                type="button"
                onClick={() => bump(dim, 1)}
                disabled={reps[dim] === 5}
                className="grid size-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
                aria-label={`Increase ${DIMENSION_LABELS[dim]} reps`}
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
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

// ——— Pressure hero — atmosphere strip above rep-count tiles ————

const PRESSURE_ARCHETYPE_PREVIEW: Array<{ name: string; tagline: string }> = [
  { name: "Pushback", tagline: "Audience pushes; you steady the line." },
  { name: "Time Compression", tagline: "Same point. Half the time." },
  { name: "Audience Switch", tagline: "Mid-rep, the room changes." },
  { name: "Clarifying Interrupt", tagline: "Cut off — answer the asked thing." },
  { name: "Stakes Raise", tagline: "Same prompt. Higher cost." },
];

function PressureLobbyHero() {
  return (
    <div className="mb-7 overflow-hidden rounded-3xl border border-brand-magenta/30 bg-gradient-to-br from-brand-magenta/10 via-white to-brand-purple/5 p-6 md:p-7 dark:from-brand-magenta/20 dark:via-ink-900 dark:to-brand-purple/15">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-magenta/30 bg-brand-magenta/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-magenta">
            <Flame className="size-3" strokeWidth={3} />
            Pressure mode
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-[28px] dark:text-white">
            Train the version of you that shows up under heat.
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
            Each rep loads a different stress mechanic — pushback, time
            compression, audience switch — so &ldquo;pressure&rdquo; never
            collapses into one habit. You cycle the catalog.
          </p>
        </div>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {PRESSURE_ARCHETYPE_PREVIEW.map((a) => (
          <li
            key={a.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-magenta/25 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-ink-700 backdrop-blur dark:bg-ink-900/80 dark:text-ink-200"
            title={a.tagline}
          >
            <span className="size-1.5 rounded-full bg-brand-magenta" />
            {a.name}
          </li>
        ))}
      </ul>
    </div>
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
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Back
      </button>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl dark:text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-base text-ink-500 dark:text-ink-400">{subtitle}</p>
    </div>
  );
}
