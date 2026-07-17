"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { deriveTopWeakness } from "@/lib/ai/coach-focus";
import { motion } from "motion/react";
import { RepSurface } from "./RepSurface";
import { WorkoutPromptSelect } from "./WorkoutPromptSelect";
import { WorkoutCountdown } from "./WorkoutCountdown";
import { SkillsFocusScope } from "./SkillsFocusContext";
import { ModeBadge, ModeSeam } from "./ModeBadge";
import { bumpCompletedRepCount } from "./InstallPrompt";
import type { RepScore, SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS, SKILL_DIMENSION_GROUPS } from "@/types/domain";
import type { WorkoutSessionPlan } from "@/lib/workout/lab-plan";
import type { PreviousRepSummary } from "./feedback";

type Phase = "countdown" | "prompt-select" | "rep" | "done";

type Style = "focus" | "mixed" | "pressure";

type Props = {
  plan: WorkoutSessionPlan;
  label: string;
  /** Which Skill Lab mode the user picked. Drives the in-session
   *  atmosphere (background wash, accent color, session chip) so a
   *  Pressure rep doesn't look like a Focus rep. */
  style?: Style;
  onExit: () => void;
};

/**
 * In-session runner for Skill Lab — minimal counterpart to WorkoutSession
 * that does not own a session-type picker, intro, or pause-to-dashboard
 * flow. Exit routes back to the lab lobby (provided by parent), not to
 * /dashboard, so the user stays in the lab between sets.
 */
export function SkillLabSession({ plan, label, style = "focus", onExit }: Props) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [scores, setScores] = useState<RepScore[]>([]);
  const [previousRepSummary, setPreviousRepSummary] =
    useState<PreviousRepSummary | null>(null);
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

  const currentRep = plan.reps[currentIndex];
  const activePrompt = selectedPrompts[currentIndex];

  // Pressure plans (sessionType='flow') auto-pick the first prompt so the
  // user goes straight into the rep — pressure is about reaction speed.
  // Goes through handlePromptSelected so the history POST fires.
  useEffect(() => {
    if (
      phase === "prompt-select" &&
      plan.sessionType === "flow" &&
      currentRep &&
      !selectedPrompts[currentIndex]
    ) {
      const auto = currentRep.prompts[0];
      const autoId = currentRep.promptIds[0];
      if (auto) handlePromptSelected(auto, autoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  function handleCountdownComplete() {
    setPhase("prompt-select");
  }

  function handlePromptSelected(prompt: string, promptId?: string) {
    setSelectedPrompts((prev) => {
      const next = [...prev];
      next[currentIndex] = prompt;
      return next;
    });
    if (promptId) {
      setSeenPromptIds((prev) => {
        if (prev.has(promptId)) return prev;
        const next = new Set(prev);
        next.add(promptId);
        return next;
      });
      void fetch("/api/prompt-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      }).catch(() => {});
    }
    setPhase("rep");
  }

  function handleRepComplete({
    score,
    transcript,
  }: {
    score: RepScore;
    transcript: string;
  }) {
    bumpCompletedRepCount();
    setScores((prev) => [...prev, score]);
    const topWeakness = deriveTopWeakness(score);
    setPreviousRepSummary({
      composite: score.composite,
      dimensions: score.dimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
      })),
      topWeakness,
      transcript,
      promptText: activePrompt ?? "",
      ...(score.headline ? { headline: score.headline } : {}),
      ...(score.nextRepHint ? { nextRepHint: score.nextRepHint } : {}),
      pressureArchetypeId: currentRep?.pressureArchetype?.id ?? null,
    });
  }

  function handleNext() {
    if (currentIndex + 1 >= plan.reps.length) {
      setPhase("done");
      return;
    }
    setCurrentIndex((i) => i + 1);
    setPhase("prompt-select");
  }

  if (phase === "countdown") {
    return (
      <SessionShell label={label} style={style} onExit={onExit}>
        <WorkoutCountdown
          from={3}
          mode="skill_lab"
          onComplete={handleCountdownComplete}
        />
      </SessionShell>
    );
  }

  if (phase === "done") {
    const avg =
      scores.length === 0
        ? 0
        : Math.round(
            scores.reduce((s, x) => s + x.composite, 0) / scores.length,
          );
    return (
      <SessionShell label={label} style={style} onExit={onExit}>
        <DoneCard
          label={label}
          totalReps={scores.length}
          plannedReps={plan.reps.length}
          averageComposite={avg}
          scores={scores}
          onExit={onExit}
        />
      </SessionShell>
    );
  }

  if (!currentRep) return null;

  if (phase === "prompt-select") {
    return (
      <SessionShell label={label} style={style} onExit={onExit}>
        <SessionProgress
          index={currentIndex}
          total={plan.reps.length}
          style={style}
          plan={plan}
        />
        <WorkoutPromptSelect
          key={currentIndex}
          repType={currentRep.repType}
          exerciseId={currentRep.exerciseId}
          initialPrompts={currentRep.prompts}
          initialPromptIds={currentRep.promptIds}
          excludePromptIds={seenPromptIds}
          repIndex={currentIndex}
          totalReps={plan.reps.length}
          focus={currentRep.focus}
          pressureArchetype={currentRep.pressureArchetype ?? null}
          timeBudgetSec={Math.round(currentRep.timeBudgetMs / 1000)}
          sessionType={plan.sessionType}
          focusDimension={plan.focusDimension ?? null}
          onSelect={handlePromptSelected}
        />
      </SessionShell>
    );
  }

  if (!activePrompt) return null;

  return (
    <SessionShell label={label} style={style} onExit={onExit}>
      <SkillsFocusScope
        primary={currentRep.repType.primaryDimension}
        secondary={currentRep.repType.secondaryDimensions}
      />
      <SessionProgress
        index={currentIndex}
        total={plan.reps.length}
        style={style}
        plan={plan}
      />
      <RepSurface
        key={currentIndex}
        prompt={activePrompt}
        exerciseId={currentRep.exerciseId}
        mode="skill_lab"
        topic={
          currentRep.pressureArchetype
            ? `Pressure · ${currentRep.pressureArchetype.name}`
            : currentRep.repType.name
        }
        maxDurationMs={currentRep.timeBudgetMs}
        previousRepSummary={previousRepSummary}
        repTypeFramework={currentRep.framework}
        speakingThreshold={{ minRatio: 0.6 }}
        feedbackMode={plan.sessionType === "flow" ? "flow" : "full"}
        flowRepIndex={currentIndex + 1}
        flowTotalReps={plan.reps.length}
        flowArchetypeName={currentRep.pressureArchetype?.name}
        pressureArchetypeId={currentRep.pressureArchetype?.id ?? null}
        pressureContext={
          currentRep.pressureArchetype
            ? {
                archetypeName: currentRep.pressureArchetype.name,
                archetypeTagline: currentRep.pressureArchetype.tagline,
              }
            : null
        }
        feedbackRepIndex={currentIndex + 1}
        feedbackTotalReps={plan.reps.length}
        feedbackModeLabel={
          currentRep.pressureArchetype
            ? currentRep.pressureArchetype.tagline.toUpperCase()
            : style === "focus" && plan.focusDimension
              ? `${DIMENSION_LABELS[plan.focusDimension].toUpperCase()} FOCUS`
              : "MIXED"
        }
        feedbackLastRepFocus={
          previousRepSummary && previousRepSummary.dimensions.length > 0
            ? {
                dimension:
                  [...previousRepSummary.dimensions].sort(
                    (a, b) => a.score - b.score,
                  )[0]?.dimension ?? "clarity",
                ...(previousRepSummary.nextRepHint
                  ? { customHint: previousRepSummary.nextRepHint }
                  : {}),
              }
            : null
        }
        onFeedbackSaveExit={onExit}
        scoreModeContext={(() => {
          const weakest =
            previousRepSummary && previousRepSummary.dimensions.length > 0
              ? [...previousRepSummary.dimensions].sort(
                  (a, b) => a.score - b.score,
                )[0]
              : null;
          const previousRepFocus =
            previousRepSummary &&
            previousRepSummary.headline &&
            weakest
              ? {
                  dimension: weakest.dimension,
                  headline: previousRepSummary.headline,
                  score: weakest.score,
                }
              : null;
          return {
            sessionType: plan.sessionType,
            ...(plan.focusDimension
              ? { focusDimension: plan.focusDimension }
              : {}),
            ...(currentRep.pressureArchetype
              ? { pressureArchetypeId: currentRep.pressureArchetype.id }
              : {}),
            ...(previousRepFocus ? { previousRepFocus } : {}),
            repIndex: currentIndex,
            totalReps: plan.reps.length,
          };
        })()}
        onComplete={handleRepComplete}
        onNext={handleNext}
        nextLabel={
          currentIndex === plan.reps.length - 1
            ? "Finish set"
            : "Next rep"
        }
      />
    </SessionShell>
  );
}

function SessionShell({
  label,
  style,
  onExit,
  children,
}: {
  label: string;
  style: Style;
  onExit: () => void;
  children: React.ReactNode;
}) {
  // Per-style ambient wash. The brand-gradient mark on every interior
  // surface stays dominant — these are atmospherics that the user feels
  // in their peripheral vision but doesn't read as "different brand".
  const ambient =
    style === "pressure"
      ? "radial-gradient(70% 80% at 90% 0%, rgba(244,158,11,0.18), transparent 60%), radial-gradient(60% 70% at 10% 30%, rgba(231,124,240,0.18), transparent 60%)"
      : style === "mixed"
        ? "radial-gradient(60% 70% at 15% 0%, rgba(106,163,255,0.18), transparent 60%), radial-gradient(60% 70% at 90% 30%, rgba(231,124,240,0.18), transparent 60%)"
        : "radial-gradient(60% 80% at 30% 0%, rgba(106,163,255,0.22), transparent 60%), radial-gradient(60% 80% at 90% 30%, rgba(176,114,255,0.16), transparent 60%)";
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 -top-12 -z-10 mx-auto h-72 max-w-5xl rounded-[2rem] opacity-90"
        style={{ background: ambient }}
        aria-hidden="true"
      />
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-500 hover:border-ink-300 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400 dark:hover:border-ink-600 dark:hover:text-white"
          >
            <ArrowLeft className="size-3" strokeWidth={2.5} />
            Exit lab
          </button>
          <ModeBadge mode="skill_lab" label={label} />
        </div>
        <ModeSeam mode="skill_lab" />
      </div>
      {children}
    </div>
  );
}

function SessionProgress({
  index,
  total,
  style,
  plan,
}: {
  index: number;
  total: number;
  style: Style;
  plan: WorkoutSessionPlan;
}) {
  const slot = plan.reps[index];
  const styleChip =
    style === "pressure"
      ? {
          label: slot?.pressureArchetype
            ? `Pressure · ${slot.pressureArchetype.name}`
            : "Pressure",
          tone: "amber" as const,
        }
      : style === "mixed"
        ? {
            label: `Mixed · ${
              slot ? DIMENSION_LABELS[slot.repType.primaryDimension] : ""
            }`.trim(),
            tone: "blue" as const,
          }
        : {
            label: plan.focusDimension
              ? `Focus · ${DIMENSION_LABELS[plan.focusDimension]}`
              : "Focus",
            tone: "purple" as const,
          };
  const chipClass =
    styleChip.tone === "amber"
      ? "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300"
      : styleChip.tone === "blue"
        ? "border-brand-blue/30 bg-brand-blue/5 text-brand-blue dark:bg-brand-blue/15"
        : "border-brand-purple/30 bg-brand-lavender/10 text-brand-purple dark:bg-brand-purple/15 dark:text-brand-lavender";
  const dotClass =
    styleChip.tone === "amber"
      ? "bg-amber-500"
      : styleChip.tone === "blue"
        ? "bg-brand-blue"
        : "bg-brand-purple";

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] ${chipClass}`}
        >
          <span className={`size-1.5 rounded-full ${dotClass}`} />
          {styleChip.label}
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Rep {index + 1} of {total}
        </p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              i < index
                ? "brand-gradient h-1.5 w-8 rounded-full"
                : i === index
                  ? "h-1.5 w-8 rounded-full bg-ink-400 dark:bg-ink-500"
                  : "h-1.5 w-8 rounded-full bg-ink-200 dark:bg-ink-700"
            }
          />
        ))}
      </div>
    </div>
  );
}

function DoneCard({
  label,
  totalReps,
  plannedReps,
  averageComposite,
  scores,
  onExit,
}: {
  label: string;
  totalReps: number;
  plannedReps: number;
  averageComposite: number;
  scores: RepScore[];
  onExit: () => void;
}) {
  const allDims: SkillDimension[] = [
    ...SKILL_DIMENSION_GROUPS.content,
    ...SKILL_DIMENSION_GROUPS.delivery,
  ];
  const dimAverages = allDims
    .map((dim) => {
      const vals = scores
        .map((rep) => rep.dimensions.find((d) => d.dimension === dim)?.score)
        .filter((v): v is number => typeof v === "number");
      const avg =
        vals.length === 0
          ? null
          : Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
      return { dim, avg };
    })
    .filter((x): x is { dim: SkillDimension; avg: number } => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="mx-auto max-w-2xl"
    >
      <div className="rounded-3xl border border-ink-200 bg-gradient-to-br from-brand-blue/10 via-white to-brand-magenta/10 p-7 shadow-[0_24px_64px_-24px_rgba(176,114,255,0.5)] dark:border-ink-700 dark:from-brand-blue/15 dark:via-ink-900 dark:to-brand-magenta/15">
        <div className="brand-gradient mx-auto grid size-14 place-items-center rounded-2xl">
          <Trophy className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <p className="mt-4 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
          {label} complete
        </p>
        <p className="mt-2 text-center text-5xl font-extrabold tabular-nums tracking-tight text-ink-900 dark:text-white">
          {averageComposite}
        </p>
        <p className="mt-1 text-center text-sm text-ink-500 dark:text-ink-400">
          Average composite over {totalReps} of {plannedReps} reps.
        </p>
        {dimAverages.length > 0 && (
          <div className="mt-6 grid gap-2">
            {dimAverages.map(({ dim, avg }) => (
              <div
                key={dim}
                className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
              >
                <span className="font-semibold text-ink-700 dark:text-ink-200">
                  {DIMENSION_LABELS[dim]}
                </span>
                <span className="brand-gradient-text font-extrabold tabular-nums">
                  {avg}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onExit}
            className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm"
          >
            <RotateCcw className="size-4" strokeWidth={2.5} />
            Run another set
          </button>
        </div>
      </div>
    </motion.div>
  );
}
