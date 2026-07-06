"use client";

// PRD v3 Phase 4 — Skill Lab v2 application session runner (PRD §6).
//
// The user picked the APPLICATION (route param); this client runs:
//   length pick (3/5/10) → per exercise: prompt pick → Coach's Insight →
//   First Rep → feedback ("Start your Retry") → required Retry →
//   Improvement Review → next exercise → Session Complete.
//
// Reuses the Universal Training Engine surfaces (PromptPicker,
// InsightScreen, RepSurface retry wiring, ImprovementReview) with a
// local phase state instead of the muscle-group day machine — there is
// no day/station/graduation lifecycle here, just N engine loops.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  APPLICATION_DESCRIPTIONS,
  APPLICATION_LABELS,
  RELATED_APPLICATION,
  applicationSkillLabel,
  type ApplicationId,
} from "@/types/application-skills";
import {
  startSkillLabSessionV2,
  completeSkillLabSessionV2,
  type AppExercise,
  type SkillLabSessionSummary,
} from "@/server/actions/skill-lab-v2";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSIONS,
  type SkillDimension,
} from "@/types/domain";
import PromptPicker from "@/components/product/workout/PromptPicker";
import InsightScreen from "@/components/product/workout-shell/InsightScreen";
import ImprovementReview, {
  type AttemptPayload,
} from "@/components/product/workout-shell/ImprovementReview";
import { RepSurface } from "@/components/product/RepSurface";
import ProgressionStrip from "@/components/product/progression/ProgressionStrip";
import { deriveCoachFocus } from "@/lib/ai/coach-focus";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";
import type { ShellStation } from "@/lib/workout/types";
import type { Callout, MuscleGroupId, RepScore } from "@/types/domain";
import type { ScoreRepModeContext } from "@/lib/ai/score";

type Phase =
  | { kind: "length-pick" }
  | { kind: "starting" }
  | { kind: "prompt" }
  | { kind: "insight" }
  | { kind: "rep"; attempt: "first" | "retry" | "again" }
  | { kind: "review" }
  | { kind: "complete"; quitEarly: boolean };

type ExerciseOutcome = {
  exercise: AppExercise;
  first: AttemptPayload | null;
  retry: AttemptPayload | null;
};

export default function AppSessionClient({
  applicationId,
}: {
  applicationId: ApplicationId;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "length-pick" });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<AppExercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [selectedPrompt, setSelectedPrompt] = useState<{
    promptId: string;
    text: string;
  } | null>(null);
  const [attempts, setAttempts] = useState<{
    first: AttemptPayload | null;
    retry: AttemptPayload | null;
  }>({ first: null, retry: null });
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SkillLabSessionSummary | null>(null);

  const exercise = exercises[idx] ?? null;
  const label = APPLICATION_LABELS[applicationId];

  const start = useCallback(
    async (count: number) => {
      setPhase({ kind: "starting" });
      setStartError(null);
      const res = await startSkillLabSessionV2({ applicationId, count });
      if (!res.ok) {
        setStartError(
          res.reason === "no_catalog"
            ? "This application's exercises aren't seeded yet."
            : "Couldn't start the session. Try again.",
        );
        setPhase({ kind: "length-pick" });
        return;
      }
      setSessionId(res.sessionId);
      setExercises(res.exercises);
      setIdx(0);
      setOutcomes([]);
      setAttempts({ first: null, retry: null });
      setPhase({ kind: "prompt" });
    },
    [applicationId],
  );

  const advanceExercise = useCallback(() => {
    if (!exercise) return;
    const record: ExerciseOutcome = {
      exercise,
      first: attempts.first,
      retry: attempts.retry,
    };
    const nextOutcomes = [...outcomes, record];
    setOutcomes(nextOutcomes);
    setAttempts({ first: null, retry: null });
    setSelectedPrompt(null);
    if (idx + 1 >= exercises.length) {
      finishSession(nextOutcomes, false);
    } else {
      setIdx(idx + 1);
      setPhase({ kind: "prompt" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, attempts, outcomes, idx, exercises.length]);

  const finishSession = useCallback(
    (finalOutcomes: ExerciseOutcome[], quitEarly: boolean) => {
      const composites = finalOutcomes
        .flatMap((o) => [o.retry?.score.composite ?? o.first?.score.composite])
        .filter((c): c is number => c != null);
      const avg =
        composites.length > 0
          ? composites.reduce((s, c) => s + c, 0) / composites.length
          : null;
      if (sessionId) {
        // §6.8 summary reads the profile AFTER this session's folds; the
        // screen renders immediately and fills the score in when ready.
        void completeSkillLabSessionV2({
          sessionId,
          applicationId,
          compositeScore: avg,
        }).then((res) => {
          if (res.summary) setSummary(res.summary);
        });
      }
      setPhase({ kind: "complete", quitEarly });
    },
    [sessionId, applicationId],
  );

  const quit = useCallback(() => {
    if (!exercise) return;
    const record: ExerciseOutcome = {
      exercise,
      first: attempts.first,
      retry: attempts.retry,
    };
    finishSession([...outcomes, record], true);
  }, [exercise, attempts, outcomes, finishSession]);

  // ── Synthetic station + retry wiring (mirrors RepControls.ActiveRep) ──
  const station: ShellStation | null = useMemo(() => {
    if (!exercise) return null;
    return {
      index: Math.min(idx, 3),
      exerciseId: exercise.exerciseId,
      exerciseSlug: exercise.slug,
      exerciseName: exercise.name,
      rule: exercise.rule,
      why: exercise.why,
      status: "current",
      compositeScore: null,
      objective: exercise.objective,
      constraintTypes: null,
      responseWindow: exercise.responseWindow,
      coachInsight: exercise.coachInsight ?? null,
    };
  }, [exercise, idx]);

  const coachFocus =
    attempts.first != null ? deriveCoachFocus(attempts.first.score) : null;
  const retryFocusCallout: Callout | null = coachFocus
    ? {
        dimension: coachFocus.dimension,
        tone: "neutral",
        title: "Focus for this retry",
        body: coachFocus.text,
        quote: null,
        suggestedRewrite: null,
        transcriptStart: null,
        transcriptEnd: null,
      }
    : null;
  const skillDim = exercise
    ? muscleGroupToSkillDim(exercise.dimension)
    : null;

  const isRetryPhase = phase.kind === "rep" && phase.attempt !== "first";
  const retryModeContext: ScoreRepModeContext | null =
    isRetryPhase && attempts.first && coachFocus && skillDim
      ? {
          sessionType: "focus",
          focusDimension: skillDim,
          repIndex: idx,
          totalReps: exercises.length,
          retryContext: {
            attempt: phase.kind === "rep" && phase.attempt === "again" ? "again" : "retry",
            firstTranscript: attempts.first.transcript,
            firstComposite: attempts.first.score.composite ?? null,
            coachFocus: {
              dimension: coachFocus.dimension,
              subSkill: coachFocus.subSkill,
              text: coachFocus.text,
            },
          },
        }
      : null;

  const onRepComplete = useCallback(
    (payload: {
      score: RepScore;
      repId: string;
      transcript: string;
    }) => {
      const attemptPayload: AttemptPayload = {
        repId: payload.repId,
        score: payload.score,
        transcript: payload.transcript,
      };
      if (phase.kind === "rep" && phase.attempt === "first") {
        setAttempts((prev) => ({ ...prev, first: attemptPayload }));
        // Stay on RepSurface's done screen — its CTA drives the retry.
      } else {
        setAttempts((prev) => ({ ...prev, retry: attemptPayload }));
        setPhase({ kind: "review" });
      }
    },
    [phase],
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
      <header className="mb-5">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
          <FlaskConical className="w-3.5 h-3.5" />
          Skill Lab · {label}
        </div>
        {phase.kind !== "length-pick" && phase.kind !== "complete" && (
          <p className="mt-1 text-xs text-slate-500 dark:text-ink-400">
            Exercise {Math.min(idx + 1, exercises.length)} of {exercises.length}
            {exercise ? ` — ${exercise.name}` : ""}
          </p>
        )}
      </header>

      <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl p-5 sm:p-6 shadow-sm">
        {phase.kind === "length-pick" && (
          <LengthPick
            label={label}
            description={APPLICATION_DESCRIPTIONS[applicationId]}
            error={startError}
            onPick={start}
          />
        )}

        {phase.kind === "starting" && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <p className="text-sm text-slate-500 dark:text-ink-400">
              Building your {label} session…
            </p>
          </div>
        )}

        {phase.kind === "prompt" && exercise && (
          <PromptPicker
            exerciseId={exercise.exerciseId}
            exerciseName={exercise.name}
            rule={exercise.rule}
            why={exercise.why}
            workoutSessionId={sessionId}
            personalize
            onSelect={(params) => {
              setSelectedPrompt({
                promptId: params.promptId,
                text: params.promptText,
              });
              setPhase({ kind: "insight" });
            }}
          />
        )}

        {phase.kind === "insight" && station && selectedPrompt && (
          <InsightScreen
            station={station}
            promptText={selectedPrompt.text}
            dimension={exercise!.dimension as MuscleGroupId}
            onReady={() => setPhase({ kind: "rep", attempt: "first" })}
          />
        )}

        {phase.kind === "rep" && exercise && selectedPrompt && (
          <RepSurface
            key={`${exercise.exerciseId}:${selectedPrompt.promptId}:${phase.attempt}`}
            prompt={selectedPrompt.text}
            responseWindow={exercise.responseWindow}
            feedbackVariant="v2"
            mode="skill_lab"
            topic={exercise.name}
            sessionId={sessionId}
            speakingThreshold={{ minRatio: 0.6 }}
            feedbackRepIndex={idx + 1}
            feedbackTotalReps={exercises.length}
            feedbackModeLabel={phase.attempt === "first" ? "SKILL LAB" : "RETRY"}
            exerciseId={exercise.exerciseId}
            applicationId={applicationId}
            hideRunItAgain
            {...(phase.attempt !== "first" && retryFocusCallout
              ? { retryFocus: retryFocusCallout }
              : {})}
            {...(phase.attempt !== "first" && attempts.first
              ? {
                  previousRepSummary: {
                    composite: attempts.first.score.composite,
                    dimensions: attempts.first.score.dimensions.map((d) => ({
                      dimension: d.dimension,
                      score: d.score,
                    })),
                    topWeakness:
                      attempts.first.score.callouts.find(
                        (c) => c.tone === "warn" || c.tone === "critical",
                      ) ?? null,
                    transcript: attempts.first.transcript,
                    promptText: selectedPrompt.text,
                  },
                  attemptKind: phase.attempt,
                  parentRepId: attempts.first.repId,
                }
              : {})}
            {...(retryModeContext ? { scoreModeContext: retryModeContext } : {})}
            onComplete={(payload) =>
              onRepComplete({
                score: payload.score,
                repId: payload.repId,
                transcript: payload.transcript,
              })
            }
            onNext={() => {
              if (phase.attempt === "first") {
                setPhase({ kind: "rep", attempt: "retry" });
              }
            }}
            nextLabel="Start your Retry →"
          />
        )}

        {phase.kind === "review" && exercise && (
          <ImprovementReview
            dimension={exercise.dimension as MuscleGroupId}
            first={attempts.first}
            retry={attempts.retry}
            isLastStation={idx + 1 >= exercises.length}
            onRetryAgain={() => setPhase({ kind: "rep", attempt: "again" })}
            onAdvance={advanceExercise}
            onQuit={quit}
          />
        )}

        {phase.kind === "complete" && (
          <SessionComplete
            applicationId={applicationId}
            label={label}
            outcomes={outcomes}
            quitEarly={phase.quitEarly}
            summary={summary}
          />
        )}
      </div>
    </div>
  );
}

function LengthPick({
  label,
  description,
  error,
  onPick,
}: {
  label: string;
  description: string;
  error: string | null;
  onPick: (count: number) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {label} session
      </h2>
      <p className="text-sm text-slate-500 dark:text-ink-400 max-w-md">
        {description} Every exercise runs the full loop: rep → coaching →
        retry → improvement review.
      </p>
      <div className="mt-2 flex gap-2">
        {[3, 5, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "min-h-[48px] px-5 py-3 rounded-xl font-semibold",
              n === 3
                ? "bg-pink-500 hover:bg-pink-400 text-white"
                : "border border-slate-200 dark:border-ink-700 text-slate-700 dark:text-ink-200 hover:bg-slate-50 dark:hover:bg-ink-800",
            )}
          >
            {n} exercises{n === 3 ? " · recommended" : ""}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** PRD §6.8 Session Complete: Application Score → Improvement During
 *  Session → Most Improved Application Skill → Core Skill Breakdown →
 *  Coach Recommendation → Reps Earned. */
function SessionComplete({
  applicationId,
  label,
  outcomes,
  quitEarly,
  summary,
}: {
  applicationId: ApplicationId;
  label: string;
  outcomes: ExerciseOutcome[];
  quitEarly: boolean;
  summary: SkillLabSessionSummary | null;
}) {
  const pairs = outcomes.filter(
    (o) => o.first?.score.composite != null && o.retry?.score.composite != null,
  );
  const avgFirst =
    pairs.length > 0
      ? pairs.reduce((s, o) => s + (o.first!.score.composite ?? 0), 0) /
        pairs.length
      : null;
  const avgRetry =
    pairs.length > 0
      ? pairs.reduce((s, o) => s + (o.retry!.score.composite ?? 0), 0) /
        pairs.length
      : null;
  const delta =
    avgFirst != null && avgRetry != null ? Math.round(avgRetry - avgFirst) : null;
  const repsDone = outcomes.reduce(
    (s, o) => s + (o.first ? 1 : 0) + (o.retry ? 1 : 0),
    0,
  );

  // Most Improved Application Skill: attribute each exercise's
  // first→retry delta to the skills it targets, take the best average.
  const mostImproved = (() => {
    const bySkill = new Map<string, { total: number; n: number }>();
    for (const o of pairs) {
      const d =
        (o.retry!.score.composite ?? 0) - (o.first!.score.composite ?? 0);
      for (const s of o.exercise.applicationSkills ?? []) {
        const cur = bySkill.get(s) ?? { total: 0, n: 0 };
        cur.total += d;
        cur.n += 1;
        bySkill.set(s, cur);
      }
    }
    let best: { id: string; avg: number } | null = null;
    for (const [id, { total, n }] of bySkill) {
      const avg = total / n;
      if (!best || avg > best.avg) best = { id, avg };
    }
    return best && best.avg > 0 ? best : null;
  })();

  // Core Skill Breakdown: session average per dimension over ALL reps.
  const coreBreakdown = (() => {
    const byDim = new Map<string, { total: number; n: number }>();
    for (const o of outcomes) {
      for (const attempt of [o.first, o.retry]) {
        if (!attempt) continue;
        for (const d of attempt.score.dimensions) {
          const cur = byDim.get(d.dimension) ?? { total: 0, n: 0 };
          cur.total += d.score;
          cur.n += 1;
          byDim.set(d.dimension, cur);
        }
      }
    }
    return SKILL_DIMENSIONS.filter((dim) => byDim.has(dim)).map((dim) => ({
      dimension: dim,
      score: Math.round(byDim.get(dim)!.total / byDim.get(dim)!.n),
    }));
  })();

  // Coach Recommendation (PRD §6.8): focus a weak Application Skill →
  // shore up a lagging Core Skill in Daily Workout → expand to a
  // related application.
  const recommendation = (() => {
    const weakSkill = summary?.weakestApplicationSkill;
    if (weakSkill && weakSkill.score < 75) {
      return `Keep training ${label} — your biggest opportunity is ${applicationSkillLabel(weakSkill.id)}. Cognify will weight your next session toward it.`;
    }
    const weakCore = summary?.weakestCoreSkill;
    if (
      weakCore &&
      summary?.applicationScore != null &&
      weakCore.score < summary.applicationScore - 8
    ) {
      const dimLabel =
        DIMENSION_LABELS[weakCore.dimension as SkillDimension] ??
        weakCore.dimension;
      return `Your ${dimLabel} fundamentals are holding this back — a few Daily Workout sessions will raise every ${label} rep.`;
    }
    return `Strong base here. Try ${APPLICATION_LABELS[RELATED_APPLICATION[applicationId]]} next — it builds directly on your ${label} skills.`;
  })();

  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
        🎉 {label} session {quitEarly ? "banked" : "complete"}
      </div>

      {/* Application Score (post-session profile estimate). */}
      <div className="flex flex-col items-center">
        <div className="text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums">
          {summary?.applicationScore != null
            ? Math.round(summary.applicationScore)
            : avgRetry != null
              ? Math.round(avgRetry)
              : "—"}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500 mt-1">
          {label} score
        </div>
      </div>

      {/* §6.8 item 2 — always present; neutral copy when flat/negative. */}
      {delta != null && (
        <p
          className={cn(
            "text-sm font-semibold",
            delta > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-500 dark:text-ink-400",
          )}
        >
          {delta > 0
            ? `+${delta} average improvement between first takes and retries.`
            : "You held steady between first takes and retries — changing a habit mid-rep is the hard part."}
        </p>
      )}

      {mostImproved && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Most improved: {applicationSkillLabel(mostImproved.id)} (+
          {Math.round(mostImproved.avg)})
        </div>
      )}

      {coreBreakdown.length > 0 && (
        <div className="w-full max-w-md mt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500 mb-2">
            Core Skills this session
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {coreBreakdown.map((d) => (
              <div
                key={d.dimension}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700"
              >
                <span className="text-xs font-medium text-slate-600 dark:text-ink-300">
                  {DIMENSION_LABELS[d.dimension as SkillDimension] ?? d.dimension}
                </span>
                <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                  {d.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-md px-4 py-3 rounded-xl bg-purple-50 dark:bg-ink-800 border border-purple-100 dark:border-ink-700 text-left">
        <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-brand-lavender mb-1">
          Coach&apos;s call
        </div>
        <p className="text-sm text-slate-700 dark:text-ink-200">{recommendation}</p>
      </div>

      <p className="text-sm text-slate-500 dark:text-ink-400">
        {repsDone} {repsDone === 1 ? "rep" : "reps"} in the bank across{" "}
        {outcomes.length}{" "}
        {outcomes.length === 1 ? "exercise" : "exercises"}
        {summary != null ? ` — ${summary.lifetimeReps} all-time` : ""}.
      </p>

      {/* PRD v3 Phase 6 (§10.8) — rank + streak + achievements strip. */}
      <ProgressionStrip className="w-full max-w-md text-left" />

      <div className="flex gap-2 mt-2">
        <Link
          href="/skill-lab"
          className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold bg-pink-500 hover:bg-pink-400 text-white inline-flex items-center gap-1.5"
        >
          Back to Skill Lab <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard"
          className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold border border-slate-200 dark:border-ink-700 text-slate-600 dark:text-ink-300 hover:bg-slate-50 dark:hover:bg-ink-800 inline-flex items-center"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
