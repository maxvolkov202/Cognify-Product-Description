"use client";

// PRD v3 Phase 5 — Build a Rep v2 event surface (PRD §7).
//
// One screen per prep event: the editable Preparation Plan (Critical
// Moments — add/remove/rename/retime/reorder, §7.7), context uploads
// (§7.4), Guided Practice (per-moment engine loop with optional retry,
// §7.7), Full Simulation (uninterrupted long rep with framework
// sidebar, §7.8), and the Readiness Review (§7.9).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSIONS,
  type MuscleGroupId,
  type RepScore,
  type SkillDimension,
} from "@/types/domain";
import { RepSurface } from "@/components/product/RepSurface";
import ProgressionStrip from "@/components/product/progression/ProgressionStrip";
import ImprovementReview, {
  type AttemptPayload,
} from "@/components/product/workout-shell/ImprovementReview";
import {
  deriveCoachFocus,
  deriveRetryFocus,
  deriveTopWeakness,
} from "@/lib/ai/coach-focus";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";
import type { ScoreRepModeContext } from "@/lib/ai/score";
import {
  addCriticalMoment,
  archivePrepEvent,
  finishPrepSession,
  getPrepEvent,
  recordMomentPractice,
  regeneratePreparationPlan,
  removeCriticalMoment,
  reorderCriticalMoments,
  startPrepSession,
  updateCriticalMoment,
  type PrepEventDetail,
  type PrepMoment,
  type PrepWeakMoment,
} from "@/server/actions/prep-events";
import type { ReadinessReviewContent } from "@/lib/ai/prep/readiness-review";

type View =
  | { kind: "plan" }
  | {
      kind: "moment";
      moment: PrepMoment;
      stage: "insight" | "rep";
      attempt: "first" | "retry" | "again";
    }
  | { kind: "moment-review"; moment: PrepMoment }
  | { kind: "sim-setup" }
  | { kind: "sim-rep"; durationSec: number }
  | { kind: "finishing" }
  | {
      kind: "readiness";
      review: ReadinessReviewContent;
      /** L5 (§8.3.8) — server-computed "Sharpen next" targets. */
      weakestMoments: PrepWeakMoment[];
    };

const EVENT_TYPE_LABEL: Record<string, string> = {
  interview: "Interview",
  presentation: "Presentation",
  pitch: "Investor Pitch",
  toast: "Toast",
  demo: "Product Demo",
  meeting: "Meeting",
  speech: "Speech",
  other: "Event",
};

function momentPrompt(event: PrepEventDetail, moment: PrepMoment): string {
  const base = `${moment.title} — ${event.title}.`;
  const objective = moment.objective ? ` ${moment.objective}` : "";
  return `${base}${objective} Deliver it exactly as you would in the real ${EVENT_TYPE_LABEL[event.eventType]?.toLowerCase() ?? "event"}.`.slice(
    0,
    500,
  );
}

function simulationPrompt(event: PrepEventDetail): string {
  return `Full simulation: ${event.title}. Deliver the entire ${EVENT_TYPE_LABEL[event.eventType]?.toLowerCase() ?? "event"} from beginning to end without stopping. Your framework is beside you as a guide — use it or ignore it.`.slice(
    0,
    500,
  );
}

/** L2 (§7.5) — the event context attached to EVERY prep rep's scoring
 *  call (guided moments and the Full Simulation) so per-moment coaching
 *  is grounded in the real event, not just the moment's one-line prompt.
 *  The scoring paths render it as an uncached block only when present,
 *  keeping all non-prep prompts byte-identical (calibration guardrail —
 *  see renderEventContextBlock in lib/ai/score.ts). */
function eventScoringContext(
  event: PrepEventDetail,
): NonNullable<ScoreRepModeContext["eventContext"]> {
  return {
    title: event.title,
    eventType: event.eventType,
    description: event.description,
    // Cap ~1500 chars — keeps the uncached prompt block small; the full
    // summary still feeds plan generation + the Readiness Review.
    contextSummary: event.contextSummary?.slice(0, 1500) ?? null,
  };
}

export default function PrepEventClient({
  initialEvent,
}: {
  initialEvent: PrepEventDetail;
}) {
  const router = useRouter();
  const [event, setEvent] = useState<PrepEventDetail>(initialEvent);
  const [view, setView] = useState<View>({ kind: "plan" });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<{
    first: AttemptPayload | null;
    retry: AttemptPayload | null;
  }>({ first: null, retry: null });
  // Session-level readiness evidence, accumulated across every scored rep.
  const dimAcc = useRef(new Map<SkillDimension, { total: number; n: number }>());
  const calloutAcc = useRef<{ dimension: string; title: string; body: string }[]>(
    [],
  );
  const [practicedThisSession, setPracticedThisSession] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // §7.7 — "Users may edit the recommended time before beginning";
  // per-moment override edited on the rep screen (MomentInsight).
  const [momentSeconds, setMomentSeconds] = useState<number | null>(null);

  const refreshEvent = useCallback(async () => {
    const fresh = await getPrepEvent(event.id);
    if (fresh) setEvent(fresh);
  }, [event.id]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    const res = await startPrepSession({ eventId: event.id });
    if (res.ok && res.sessionId) {
      setSessionId(res.sessionId);
      return res.sessionId;
    }
    return null;
  }, [sessionId, event.id]);

  const accumulateScore = useCallback((score: RepScore) => {
    for (const d of score.dimensions) {
      const dim = d.dimension as SkillDimension;
      if (!(SKILL_DIMENSIONS as readonly string[]).includes(dim)) continue;
      const cur = dimAcc.current.get(dim) ?? { total: 0, n: 0 };
      cur.total += d.score;
      cur.n += 1;
      dimAcc.current.set(dim, cur);
    }
    for (const c of score.callouts) {
      if (c.tone === "warn" || c.tone === "critical") {
        calloutAcc.current.push({
          dimension: c.dimension,
          title: c.title,
          body: c.body,
        });
        if (calloutAcc.current.length > 12) calloutAcc.current.shift();
      }
    }
    // v4 scores ship callouts: [] — the readiness review's coaching
    // evidence comes from the Coach's Focus instead. Without this the
    // review LLM graded event readiness from dimension averages alone.
    if (score.callouts.length === 0 && score.coachFocus) {
      calloutAcc.current.push({
        dimension: score.coachFocus.dimension,
        title: score.coachFocus.behavior ?? score.coachFocus.text,
        body:
          score.coachFocus.why ??
          score.coachFocus.action ??
          score.coachFocus.text,
      });
      if (calloutAcc.current.length > 12) calloutAcc.current.shift();
    }
    setPracticedThisSession(true);
  }, []);

  const dimensionAverages = useCallback((): Partial<Record<string, number>> => {
    const out: Partial<Record<string, number>> = {};
    for (const [dim, { total, n }] of dimAcc.current) {
      if (n > 0) out[dim] = total / n;
    }
    return out;
  }, []);

  // ── Guided practice ──────────────────────────────────────────────────

  const startMoment = useCallback((moment: PrepMoment) => {
    setAttempts({ first: null, retry: null });
    setMomentSeconds(null);
    setView({ kind: "moment", moment, stage: "insight", attempt: "first" });
  }, []);

  const onMomentRepComplete = useCallback(
    (
      moment: PrepMoment,
      attempt: "first" | "retry" | "again",
      payload: { score: RepScore; repId: string; transcript: string },
    ) => {
      accumulateScore(payload.score);
      void recordMomentPractice({
        momentId: moment.id,
        composite: payload.score.composite,
      });
      const attemptPayload: AttemptPayload = {
        repId: payload.repId,
        score: payload.score,
        transcript: payload.transcript,
      };
      if (attempt === "first") {
        setAttempts({ first: attemptPayload, retry: null });
        // Stay on RepSurface's feedback — its CTA drives the retry.
      } else {
        setAttempts((prev) => ({ ...prev, retry: attemptPayload }));
        setView({ kind: "moment-review", moment });
      }
    },
    [accumulateScore],
  );

  const backToPlan = useCallback(() => {
    setView({ kind: "plan" });
    void refreshEvent();
  }, [refreshEvent]);

  /** §7.7 — "Continue to Next Critical Moment" branch target. */
  const nextMomentAfter = useCallback(
    (moment: PrepMoment): PrepMoment | null => {
      const idx = event.moments.findIndex((m) => m.id === moment.id);
      if (idx === -1) return null;
      return event.moments[idx + 1] ?? null;
    },
    [event.moments],
  );

  // ── Readiness ────────────────────────────────────────────────────────

  /** The finished session is closed server-side (endedAt set); reset the
   *  client session state so a follow-up practice (e.g. L5's "Sharpen
   *  next") opens a FRESH prep session instead of appending to a closed
   *  one. */
  const resetSessionState = useCallback(() => {
    setSessionId(null);
    dimAcc.current = new Map();
    calloutAcc.current = [];
    setPracticedThisSession(false);
  }, []);

  const finishGuided = useCallback(async () => {
    setView({ kind: "finishing" });
    const res = await finishPrepSession({
      eventId: event.id,
      mode: "guided",
      sessionId,
      dimensionAverages: dimensionAverages(),
      callouts: calloutAcc.current,
    });
    if (res.ok) {
      resetSessionState();
      setView({
        kind: "readiness",
        review: res.review,
        weakestMoments: res.weakestMoments,
      });
      void refreshEvent();
    } else {
      setView({ kind: "plan" });
    }
  }, [event.id, sessionId, dimensionAverages, refreshEvent, resetSessionState]);

  const onSimulationComplete = useCallback(
    async (payload: { score: RepScore; repId: string; transcript: string }) => {
      accumulateScore(payload.score);
      setView({ kind: "finishing" });
      const dims: Partial<Record<string, number>> = {};
      for (const d of payload.score.dimensions) dims[d.dimension] = d.score;
      const res = await finishPrepSession({
        eventId: event.id,
        mode: "simulation",
        sessionId,
        repId: payload.repId,
        dimensionAverages: dims,
        transcriptExcerpt: payload.transcript.slice(0, 8000),
        callouts: (payload.score.callouts.length === 0 &&
        payload.score.coachFocus
          ? [
              {
                dimension: payload.score.coachFocus.dimension as
                  | SkillDimension
                  | "structural_adherence",
                title:
                  payload.score.coachFocus.behavior ??
                  payload.score.coachFocus.text,
                body:
                  payload.score.coachFocus.why ??
                  payload.score.coachFocus.action ??
                  payload.score.coachFocus.text,
              },
            ]
          : payload.score.callouts
              .filter((c) => c.tone === "warn" || c.tone === "critical")
              .map((c) => ({
                dimension: c.dimension,
                title: c.title,
                body: c.body,
              }))
        ).slice(0, 8),
      });
      if (res.ok) {
        resetSessionState();
        setView({
          kind: "readiness",
          review: res.review,
          weakestMoments: res.weakestMoments,
        });
        void refreshEvent();
      } else {
        setView({ kind: "plan" });
      }
    },
    [event.id, sessionId, accumulateScore, refreshEvent, resetSessionState],
  );

  // ── Retry wiring (mirrors the engine loop hosts) ─────────────────────

  const coachFocus =
    attempts.first != null ? deriveCoachFocus(attempts.first.score) : null;
  const retryFocus =
    attempts.first != null ? deriveRetryFocus(attempts.first.score) : null;

  const anyPracticed =
    practicedThisSession || event.moments.some((m) => m.attempts > 0);

  // ── Render ───────────────────────────────────────────────────────────

  if (view.kind === "readiness") {
    return (
      <ReadinessReviewScreen
        event={event}
        review={view.review}
        weakestMoments={view.weakestMoments}
        onBackToPlan={backToPlan}
        // L5 — "Sharpen next" re-enters the existing startMoment flow for
        // that moment (fresh session, same as PlanScreen's Practice).
        onPracticeMoment={async (m) => {
          await ensureSession();
          startMoment(m);
        }}
      />
    );
  }

  if (view.kind === "finishing") {
    return <FinishingCard />;
  }

  if (view.kind === "moment" || view.kind === "moment-review") {
    const moment = view.moment;
    const skillDim = coachFocus ? muscleGroupToSkillDim(coachFocus.dimension) : null;
    const isRetryAttempt = view.kind === "moment" && view.attempt !== "first";
    // L2 (§7.5) — every moment rep (first attempts included) carries the
    // event context; retry attempts additionally carry the retry-
    // evaluation context.
    const momentModeContext: ScoreRepModeContext = {
      sessionType: "focus",
      repIndex: 0,
      totalReps: 1,
      // L4 — the moment's scoring lens rides INSIDE the same eventContext
      // block (only-when-present ⇒ calibration-safe; simulations and
      // hint-less moments send the block unchanged).
      eventContext: {
        ...eventScoringContext(event),
        ...(moment.scoringHint
          ? { momentHint: moment.scoringHint.slice(0, 300) }
          : {}),
      },
      ...(isRetryAttempt && attempts.first && coachFocus && skillDim
        ? {
            focusDimension: skillDim,
            retryContext: {
              attempt: view.attempt === "again" ? ("again" as const) : ("retry" as const),
              firstTranscript: attempts.first.transcript,
              firstComposite: attempts.first.score.composite ?? null,
              coachFocus: {
                dimension: coachFocus.dimension,
                subSkill: coachFocus.subSkill,
                text: coachFocus.text,
              },
            },
          }
        : {}),
    };

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToPlan}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500 hover:text-slate-600 dark:hover:text-ink-300 min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to plan
        </button>

        {view.kind === "moment" && view.stage === "insight" && (
          <MomentInsight
            moment={moment}
            seconds={momentSeconds ?? moment.recommendedSeconds}
            onSecondsChange={(sec) => {
              setMomentSeconds(sec);
              // Write-through so the plan remembers the real-world time.
              void updateCriticalMoment({
                momentId: moment.id,
                recommendedSeconds: sec,
              });
            }}
            onReady={() =>
              setView({ kind: "moment", moment, stage: "rep", attempt: "first" })
            }
          />
        )}

        {view.kind === "moment" && view.stage === "rep" && (
          <RepSurface
            key={`${moment.id}:${view.attempt}`}
            prompt={momentPrompt(event, moment)}
            mode="build_a_rep"
            topic={moment.title}
            sessionId={sessionId}
            // ADR-001 — the visible pressure is the recommended time
            // (count-up band, §7.7-editable via MomentInsight); the hard
            // stop stays a generous ceiling.
            responseWindow={{
              minSec: Math.max(
                15,
                Math.round((momentSeconds ?? moment.recommendedSeconds) * 0.6),
              ),
              maxSec: momentSeconds ?? moment.recommendedSeconds,
            }}
            maxDurationMs={Math.min(
              Math.max(
                (momentSeconds ?? moment.recommendedSeconds) * 1500,
                60_000,
              ),
              600_000,
            )}
            feedbackRepIndex={1}
            feedbackTotalReps={1}
            feedbackModeLabel={view.attempt === "first" ? "BUILD A REP" : "RETRY"}
            hideRunItAgain
            {...(view.attempt !== "first" && retryFocus
              ? { retryFocus }
              : {})}
            {...(view.attempt !== "first" && attempts.first
              ? {
                  previousRepSummary: {
                    composite: attempts.first.score.composite,
                    dimensions: attempts.first.score.dimensions.map((d) => ({
                      dimension: d.dimension,
                      score: d.score,
                    })),
                    topWeakness: deriveTopWeakness(attempts.first.score),
                    transcript: attempts.first.transcript,
                    promptText: momentPrompt(event, moment),
                  },
                  attemptKind: view.attempt,
                  parentRepId: attempts.first.repId,
                }
              : {})}
            scoreModeContext={momentModeContext}
            onComplete={(payload) => {
              void ensureSession();
              onMomentRepComplete(moment, view.attempt, {
                score: payload.score,
                repId: payload.repId,
                transcript: payload.transcript,
              });
            }}
            onNext={() => {
              if (view.attempt === "first") {
                setView({ kind: "moment", moment, stage: "rep", attempt: "retry" });
              } else {
                setView({ kind: "moment-review", moment });
              }
            }}
            nextLabel={
              view.attempt === "first" ? "Start your Retry →" : "Improvement Review →"
            }
          />
        )}

        {/* §7.7 — the first-feedback screen's "Continue to Next Critical
            Moment" branch (retry stays the primary CTA; it's optional
            here, unlike Daily Workout). */}
        {view.kind === "moment" &&
          view.stage === "rep" &&
          view.attempt === "first" &&
          attempts.first != null &&
          (() => {
            const next = nextMomentAfter(moment);
            return next ? (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => startMoment(next)}
                  className="min-h-[44px] text-sm font-semibold text-purple-600 dark:text-brand-lavender hover:underline"
                >
                  Skip the retry — continue to “{next.title}” →
                </button>
              </div>
            ) : null;
          })()}

        {view.kind === "moment-review" &&
          (() => {
            const next = nextMomentAfter(moment);
            return (
              <ImprovementReview
                dimension={(coachFocus?.dimension as MuscleGroupId) ?? null}
                first={attempts.first}
                retry={attempts.retry}
                isLastStation={next == null}
                advanceLabel={
                  next ? `Next moment: ${next.title} →` : "Back to plan →"
                }
                quitLabel="Return to plan"
                onRetryAgain={() =>
                  setView({
                    kind: "moment",
                    moment,
                    stage: "rep",
                    attempt: "again",
                  })
                }
                onAdvance={() => (next ? startMoment(next) : backToPlan())}
                onQuit={backToPlan}
              />
            );
          })()}
      </div>
    );
  }

  if (view.kind === "sim-setup" || view.kind === "sim-rep") {
    return (
      <SimulationView
        event={event}
        view={view}
        sessionId={sessionId}
        onBack={backToPlan}
        onStart={async (durationSec) => {
          await ensureSession();
          setView({ kind: "sim-rep", durationSec });
        }}
        onComplete={onSimulationComplete}
        // Phase 11.E2 (§7.8) — inline framework edits on the sim setup,
        // written through to the plan's moments.
        onMomentTitleChange={(momentId, title) => {
          setEvent((prev) => ({
            ...prev,
            moments: prev.moments.map((m) =>
              m.id === momentId ? { ...m, title } : m,
            ),
          }));
          void updateCriticalMoment({ momentId, title });
        }}
      />
    );
  }

  return (
    <PlanScreen
      event={event}
      busy={busy}
      setBusy={setBusy}
      anyPracticed={anyPracticed}
      canFinishGuided={practicedThisSession}
      onRefresh={refreshEvent}
      onPractice={async (m) => {
        // L6 — AWAIT session creation before entering the moment: a fast
        // user could otherwise finish recording before startPrepSession
        // returned, and the rep would save with sessionId=null (orphaned
        // from the prep session). The Practice button shows a brief
        // pending state meanwhile.
        setBusy("practice");
        try {
          await ensureSession();
        } finally {
          setBusy(null);
        }
        startMoment(m);
      }}
      onSimulate={() => setView({ kind: "sim-setup" })}
      onFinishGuided={finishGuided}
      onArchive={async () => {
        await archivePrepEvent({ eventId: event.id });
        router.push("/build-a-rep");
      }}
    />
  );
}

// ── Finishing wait (staged loading card) ────────────────────────────────

/** The multi-second Readiness Review AI call gets a staged wait instead
 *  of a bare spinner. Steps activate on a 2.5s timer (capped at the last
 *  — the real work finishes when finishPrepSession resolves and swaps
 *  the view). Purely presentational: same state machine, no props. */
const FINISHING_STEPS = [
  "Reading your event context",
  "Identifying the critical moments",
  "Writing your Readiness Review",
] as const;

function FinishingCard() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setActiveStep((s) => Math.min(s + 1, FINISHING_STEPS.length - 1)),
      2500,
    );
    return () => clearInterval(id);
  }, []);
  // Never claims done — the last slice stays open until the view swaps.
  const widthPct = Math.round(
    ((activeStep + 1) / (FINISHING_STEPS.length + 1)) * 100,
  );

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 shadow-sm">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
          Readiness Review
        </div>
        <h2 className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">
          Your coach is writing your Readiness Review…
        </h2>
        <ul className="mt-4 space-y-2.5">
          {FINISHING_STEPS.map((label, i) => {
            const state =
              i < activeStep ? "done" : i === activeStep ? "active" : "pending";
            return (
              <li key={label} className="flex items-center gap-2.5 text-sm">
                {state === "done" ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                ) : state === "active" ? (
                  <Loader2 className="w-5 h-5 shrink-0 animate-spin text-purple-500 motion-reduce:animate-none" />
                ) : (
                  <span className="grid size-5 shrink-0 place-items-center">
                    <span className="size-1.5 rounded-full bg-slate-300 dark:bg-ink-600" />
                  </span>
                )}
                <span
                  className={cn(
                    "transition-colors",
                    state === "pending"
                      ? "text-slate-400 dark:text-ink-500"
                      : "font-semibold text-slate-800 dark:text-ink-100",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800">
          <div
            className="h-full rounded-full brand-gradient transition-[width] duration-[2000ms] ease-out motion-reduce:transition-none"
            style={{ width: `${widthPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Plan screen ─────────────────────────────────────────────────────────

function PlanScreen({
  event,
  busy,
  setBusy,
  anyPracticed,
  canFinishGuided,
  onRefresh,
  onPractice,
  onSimulate,
  onFinishGuided,
  onArchive,
}: {
  event: PrepEventDetail;
  busy: string | null;
  setBusy: (b: string | null) => void;
  anyPracticed: boolean;
  canFinishGuided: boolean;
  onRefresh: () => Promise<void>;
  onPractice: (m: PrepMoment) => void | Promise<void>;
  onSimulate: () => void;
  onFinishGuided: () => void;
  onArchive: () => Promise<void>;
}) {
  const [newMoment, setNewMoment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSeconds, setEditSeconds] = useState(90);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = event.moments.map((m) => m.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void run("reorder", () =>
      reorderCriticalMoments({ eventId: event.id, orderedIds: ids }),
    );
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setUploadNote(null);
    try {
      const form = new FormData();
      form.set("eventId", event.id);
      form.set("file", file);
      const res = await fetch("/api/prep-context", { method: "POST", body: form });
      const data = (await res.json()) as { parseStatus?: string; error?: string };
      if (!res.ok) {
        setUploadNote(
          data.error === "file_too_large"
            ? "That file is too large (4MB max)."
            : "Upload failed — try again.",
        );
      } else if (data.parseStatus !== "parsed") {
        setUploadNote(
          "Uploaded, but we couldn't read text from that file (PDF, DOCX, TXT and MD work best).",
        );
      } else {
        // §7.5 — "As additional context is provided, the preparation
        // experience should become increasingly specific." Regenerate
        // automatically instead of waiting for a manual click; the
        // user's own moments survive (regenerate keeps source=user).
        setUploadNote("Context read — updating your plan with it…");
        await regeneratePreparationPlan({ eventId: event.id });
        setUploadNote(null);
      }
      await onRefresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/build-a-rep"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500 hover:text-slate-600 dark:hover:text-ink-300 min-h-[44px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All events
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {event.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-ink-800 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-brand-lavender">
              {EVENT_TYPE_LABEL[event.eventType] ?? "Event"}
            </span>
            {event.readinessScore != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <Target className="w-3 h-3" /> Readiness{" "}
                {Math.round(event.readinessScore)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onArchive()}
          className="min-h-[44px] text-xs font-semibold text-slate-400 dark:text-ink-500 hover:text-rose-500"
        >
          Archive event
        </button>
      </header>

      {/* Context uploads (PRD §7.4 — always optional) */}
      <section className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Context
            </h2>
            <p className="text-xs text-slate-500 dark:text-ink-400">
              Optional — resume, job description, deck outline, agenda. The more
              you add, the more personal your plan gets.
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy != null}
            onClick={() => fileInput.current?.click()}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-ink-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-ink-300 hover:bg-slate-50 dark:hover:bg-ink-800"
          >
            {busy === "upload" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Add file
          </button>
        </div>
        {uploadNote && (
          <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {uploadNote}
          </p>
        )}
        {event.uploads.length > 0 && (
          <>
            <ul className="mt-3 space-y-1.5">
              {event.uploads.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-ink-300"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{u.fileName}</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      u.parseStatus === "parsed"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {u.parseStatus === "parsed" ? "read" : u.parseStatus}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${u.fileName}`}
                    className="ml-auto p-2.5 text-slate-400 hover:text-rose-500"
                    onClick={() =>
                      void run("delete-upload", async () => {
                        await fetch(`/api/prep-context?id=${u.id}`, {
                          method: "DELETE",
                        });
                      })
                    }
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy != null}
              onClick={() =>
                void run("regen", () =>
                  regeneratePreparationPlan({ eventId: event.id }),
                )
              }
              className="mt-3 min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-semibold text-white"
            >
              {busy === "regen" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Regenerate plan with this context
            </button>
          </>
        )}
      </section>

      {/* Preparation Plan (PRD §7.7) */}
      <section>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Preparation Plan
        </h2>
        <p className="text-xs text-slate-500 dark:text-ink-400 mb-3">
          {/* C11 — define Critical Moments at first use. */}
          Critical Moments are the parts of your event most likely to determine
          how it goes. Practice them in any order — edit the plan freely.
        </p>
        <ul className="space-y-2">
          {event.moments.map((m, i) => (
            <li
              key={m.id}
              className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-3.5 shadow-sm"
            >
              {editingId === m.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={60}
                    className="flex-1 min-w-[180px] min-h-[44px] rounded-lg border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 text-sm text-slate-900 dark:text-white"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-ink-400">
                    <Clock className="w-3.5 h-3.5" />
                    <input
                      type="number"
                      min={15}
                      max={1800}
                      value={editSeconds}
                      onChange={(e) => setEditSeconds(Number(e.target.value))}
                      className="w-20 min-h-[44px] rounded-lg border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-2 text-sm text-slate-900 dark:text-white tabular-nums"
                    />
                    sec
                  </label>
                  <button
                    type="button"
                    aria-label="Save moment"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-emerald-500 text-white"
                    onClick={() =>
                      void run("edit", async () => {
                        await updateCriticalMoment({
                          momentId: m.id,
                          title: editTitle,
                          recommendedSeconds: editSeconds,
                        });
                        setEditingId(null);
                      })
                    }
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel edit"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-ink-700 text-slate-500"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0 || busy != null}
                      onClick={() => move(i, -1)}
                      className="p-1.5 text-slate-300 hover:text-slate-600 dark:text-ink-600 dark:hover:text-ink-300 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === event.moments.length - 1 || busy != null}
                      onClick={() => move(i, 1)}
                      className="p-1.5 text-slate-300 hover:text-slate-600 dark:text-ink-600 dark:hover:text-ink-300 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {m.title}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-ink-500 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {m.recommendedSeconds}s
                      </span>
                    </div>
                    {m.objective && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">
                        {m.objective}
                      </p>
                    )}
                    {m.attempts > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        Best {m.bestComposite != null ? Math.round(m.bestComposite) : "—"}{" "}
                        · {m.attempts} attempt{m.attempts === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${m.title}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-ink-200"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditTitle(m.title);
                        setEditSeconds(m.recommendedSeconds);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${m.title}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-rose-500"
                      onClick={() =>
                        void run("remove", () =>
                          removeCriticalMoment({ momentId: m.id }),
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => void onPractice(m)}
                      className="ml-1 min-h-[44px] rounded-xl bg-pink-500 hover:bg-pink-400 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {/* L6 — pending state while the prep session is created. */}
                      {busy === "practice" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Practice"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Add moment */}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newMoment.trim().length === 0) return;
            void run("add", async () => {
              await addCriticalMoment({ eventId: event.id, title: newMoment });
              setNewMoment("");
            });
          }}
        >
          <input
            value={newMoment}
            onChange={(e) => setNewMoment(e.target.value)}
            maxLength={60}
            placeholder="Add a Critical Moment…"
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={busy != null || newMoment.trim().length === 0}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-ink-700 px-4 text-sm font-semibold text-slate-600 dark:text-ink-300 hover:bg-slate-50 dark:hover:bg-ink-800 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </section>

      {/* Mode CTAs (PRD §7.6 — Cognify recommends, user chooses) */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-2xl border p-4",
            event.recommendedMode === "simulation"
              ? "border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900"
              : "border-purple-200 dark:border-brand-purple/40 bg-purple-50/60 dark:bg-purple-500/10",
          )}
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Guided Practice
            {event.recommendedMode === "guided" && (
              <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-brand-lavender">
                Recommended
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-ink-400">
            One Critical Moment at a time — coaching after every rep, retry
            until it clicks. Hit “Practice” on any moment above.
          </p>
          <button
            type="button"
            disabled={!canFinishGuided}
            onClick={onFinishGuided}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-purple-600 hover:bg-purple-700 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {canFinishGuided
              ? "Finish & get my Readiness Review"
              : anyPracticed
                ? "Practice a moment this session to review readiness"
                : "Practice moments, then get your Readiness Review"}
          </button>
        </div>
        <div
          className={cn(
            "rounded-2xl border p-4",
            event.recommendedMode === "simulation"
              ? "border-purple-200 dark:border-brand-purple/40 bg-purple-50/60 dark:bg-purple-500/10"
              : "border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900",
          )}
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Full Simulation
            {event.recommendedMode === "simulation" && (
              <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-brand-lavender">
                Recommended
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-ink-400">
            The whole event, start to finish, no interruptions. Feedback only at
            the end — that&apos;s the point.
          </p>
          <button
            type="button"
            onClick={onSimulate}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-purple-300 dark:border-brand-purple/50 px-4 text-sm font-semibold text-purple-700 dark:text-brand-lavender hover:bg-purple-50 dark:hover:bg-ink-800"
          >
            Run the Full Simulation
          </button>
        </div>
      </section>

      {/* Latest readiness review recap */}
      {event.latestReview && (
        <section className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-ink-500">
            Last Readiness Review
          </h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-ink-200">
            {event.latestReview.readinessSummary}
          </p>
        </section>
      )}
    </div>
  );
}

// ── Moment insight (Coach's Insight for a Critical Moment) ─────────────

function MomentInsight({
  moment,
  seconds,
  onSecondsChange,
  onReady,
}: {
  moment: PrepMoment;
  seconds: number;
  onSecondsChange: (sec: number) => void;
  onReady: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 shadow-sm text-center">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
        Coach&apos;s Insight
      </div>
      <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
        {moment.title}
      </h2>
      {/* L4 — the generated Coach's Insight leads; the objective becomes
          the supporting line beneath it. */}
      {moment.coachCue && (
        <p className="mt-3 mx-auto max-w-lg rounded-xl border border-purple-200 dark:border-brand-lavender/30 bg-purple-50/60 dark:bg-ink-800 p-3.5 text-base font-semibold leading-snug text-slate-900 dark:text-white">
          {moment.coachCue}
        </p>
      )}
      {moment.objective && (
        <p className="mt-2 text-sm text-slate-600 dark:text-ink-300 max-w-lg mx-auto">
          {moment.objective}
        </p>
      )}
      {/* §7.7 — recommended time on the REP SCREEN, editable before
          beginning; the timer recreates pressure, it doesn't grade. */}
      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-ink-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-ink-300 tabular-nums">
        <Clock className="w-3.5 h-3.5" />
        Target
        <input
          type="number"
          min={15}
          max={1800}
          value={seconds}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 15 && v <= 1800) onSecondsChange(v);
          }}
          aria-label="Recommended speaking time in seconds"
          className="w-16 min-h-[36px] rounded-md border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-1.5 text-center text-xs font-bold text-slate-800 dark:text-white"
        />
        seconds — match your real moment
      </div>
      <div className="mt-5">
        <button
          type="button"
          onClick={onReady}
          className="min-h-[48px] rounded-xl bg-pink-500 hover:bg-pink-400 px-6 py-3 font-semibold text-white"
        >
          I&apos;m ready — start the rep
        </button>
      </div>
    </div>
  );
}

// ── Full Simulation ─────────────────────────────────────────────────────

function SimulationView({
  event,
  view,
  sessionId,
  onBack,
  onStart,
  onComplete,
  onMomentTitleChange,
}: {
  event: PrepEventDetail;
  view: { kind: "sim-setup" } | { kind: "sim-rep"; durationSec: number };
  sessionId: string | null;
  onBack: () => void;
  onStart: (durationSec: number) => Promise<void>;
  onComplete: (payload: {
    score: RepScore;
    repId: string;
    transcript: string;
  }) => void;
  /** Phase 11.E2 (§7.8) — commit an inline section edit (write-through). */
  onMomentTitleChange: (momentId: string, title: string) => void;
}) {
  // L10 — the binding constraint on simulation length is the score
  // route's durationMs ceiling (1_500_000ms = 25 min in /api/score's
  // bodySchema), NOT the plan schema's 30-min
  // recommendedDurationSec cap. Clamp everything to 25 min so a long
  // recommendation can't silently truncate mid-rep or fail scoring.
  const SIM_MAX_SEC = 1500; // 25 min — score-route durationMs ceiling
  const [durationSec, setDurationSec] = useState(
    Math.min(event.recommendedDurationSec ?? 300, SIM_MAX_SEC),
  );
  // Drafts keyed by moment id so typing doesn't write through per
  // keystroke; blur (or Enter) commits via onMomentTitleChange.
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const framework = useMemo(
    () => event.moments.map((m) => m.title),
    [event.moments],
  );

  const commitTitle = (momentId: string, current: string) => {
    const draft = titleDrafts[momentId];
    const next = draft?.trim();
    if (next && next !== current) onMomentTitleChange(momentId, next);
    setTitleDrafts((d) => {
      const rest = { ...d };
      delete rest[momentId];
      return rest;
    });
  };

  if (view.kind === "sim-setup") {
    const minutes = Math.round((durationSec / 60) * 10) / 10;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500 hover:text-slate-600 dark:hover:text-ink-300 min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to plan
        </button>
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Full Simulation — {event.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">
            Start to finish, no interruptions. Your framework stays beside you.
            Feedback comes at the end as your Readiness Review.
          </p>
          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500">
              Recommended time (edit to match the real event)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={25}
                step={0.5}
                value={minutes}
                onChange={(e) =>
                  setDurationSec(
                    Math.round(
                      Math.min(25, Math.max(1, Number(e.target.value))) * 60,
                    ),
                  )
                }
                className="w-24 min-h-[44px] rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 text-sm text-slate-900 dark:text-white tabular-nums"
              />
              <span className="text-sm text-slate-500 dark:text-ink-400">
                minutes
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500">
              Your framework (tap a section to edit)
            </div>
            {/* Phase 11.E2 (§7.8) — sections are editable right here;
                edits write through to the plan's Critical Moments. */}
            <ol className="mt-2 space-y-1.5">
              {event.moments.map((m, i) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 dark:text-ink-500 tabular-nums">
                    {i + 1}.
                  </span>
                  <input
                    type="text"
                    value={titleDrafts[m.id] ?? m.title}
                    aria-label={`Framework section ${i + 1}`}
                    maxLength={120}
                    onChange={(e) =>
                      setTitleDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                    }
                    onBlur={() => commitTitle(m.id, m.title)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-full min-h-[40px] rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-ink-700 focus:border-purple-300 dark:focus:border-brand-lavender/50 bg-transparent px-2 py-1.5 text-sm text-slate-700 dark:text-ink-200 focus:outline-none"
                  />
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-ink-500">
              Edits update your plan too — or ignore the framework entirely
              and deliver it your way.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onStart(durationSec)}
            className="mt-5 min-h-[48px] w-full rounded-xl bg-pink-500 hover:bg-pink-400 px-6 py-3 font-semibold text-white"
          >
            Start the simulation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <RepSurface
          key={`sim:${event.id}`}
          prompt={simulationPrompt(event)}
          mode="build_a_rep"
          topic={event.title}
          sessionId={sessionId}
          responseWindow={{
            minSec: Math.max(30, Math.round(view.durationSec * 0.6)),
            maxSec: view.durationSec,
          }}
          // L10 — hard-stop ceiling aligned to the score routes'
          // durationMs cap (1_500_000ms = 25 min), the binding
          // constraint; was 1_200_000 which silently truncated 21-25min
          // simulations the setup otherwise allowed.
          maxDurationMs={Math.min(view.durationSec * 1300, 1_500_000)}
          feedbackRepIndex={1}
          feedbackTotalReps={1}
          feedbackModeLabel="FULL SIMULATION"
          hideRunItAgain
          // L2 (§7.5) — ground the simulation's coaching in the event.
          scoreModeContext={{
            sessionType: "focus",
            repIndex: 0,
            totalReps: 1,
            eventContext: eventScoringContext(event),
          }}
          onComplete={(payload) =>
            onComplete({
              score: payload.score,
              repId: payload.repId,
              transcript: payload.transcript,
            })
          }
        />
        <aside className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white/70 dark:bg-ink-900/70 p-4 h-fit lg:sticky lg:top-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500 mb-2">
            Framework
          </div>
          <ol className="space-y-1.5">
            {framework.map((t, i) => (
              <li key={i} className="text-[13px] leading-snug text-slate-700 dark:text-ink-200">
                <span className="text-slate-400 dark:text-ink-500 tabular-nums mr-1.5">
                  {i + 1}.
                </span>
                {t}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

// ── Readiness Review (PRD §7.9) ─────────────────────────────────────────

function ReadinessReviewScreen({
  event,
  review,
  weakestMoments,
  onBackToPlan,
  onPracticeMoment,
}: {
  event: PrepEventDetail;
  review: ReadinessReviewContent;
  weakestMoments: PrepWeakMoment[];
  onBackToPlan: () => void;
  onPracticeMoment: (m: PrepMoment) => void | Promise<void>;
}) {
  const dims = SKILL_DIMENSIONS.filter((d) => review.coreSkills[d] != null);
  // L5 — resolve the server's weakest-moment ids against the live plan
  // (a moment deleted mid-session simply drops off the list).
  const sharpenTargets = weakestMoments.flatMap((w) => {
    const moment = event.moments.find((m) => m.id === w.momentId);
    return moment ? [{ ...w, moment }] : [];
  });
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
          Readiness Review — {event.title}
        </div>
        <div className="mt-3 text-6xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
          {review.overallScore != null ? Math.round(review.overallScore) : "—"}
        </div>
        <div className="mt-1 text-xs uppercase tracking-wider text-slate-400 dark:text-ink-500">
          Overall Communication Score
        </div>
      </div>

      <div className="rounded-2xl border border-purple-200 dark:border-brand-purple/40 bg-gradient-to-br from-purple-50/80 to-white dark:from-purple-500/15 dark:to-ink-900 p-4 shadow-sm">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600 dark:text-brand-lavender mb-1">
          Coach feedback — your one focus
        </div>
        <p className="text-sm text-slate-800 dark:text-ink-100 leading-snug">
          {review.coachFeedback}
        </p>
      </div>

      {dims.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500 mb-2">
            Core Skill breakdown
          </div>
          <div className="space-y-1.5">
            {dims.map((dim) => {
              const entry = review.coreSkills[dim]!;
              return (
                <details
                  key={dim}
                  className="group rounded-xl border border-slate-100 dark:border-ink-800 px-3 py-2"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 min-h-[36px]">
                    <span className="text-sm font-semibold text-slate-800 dark:text-ink-100">
                      {DIMENSION_LABELS[dim]}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {entry.score}
                    </span>
                    <ChevronDown className="ml-auto w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-ink-300">
                    <p>
                      <span className="font-bold text-slate-500 dark:text-ink-400">
                        Why:{" "}
                      </span>
                      {entry.why}
                    </p>
                    <p>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Did well:{" "}
                      </span>
                      {entry.well}
                    </p>
                    <p>
                      <span className="font-bold text-purple-600 dark:text-brand-lavender">
                        Before the event:{" "}
                      </span>
                      {entry.improve}
                    </p>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500 mb-1">
          Readiness summary
        </div>
        <p className="text-sm text-slate-700 dark:text-ink-200 leading-relaxed">
          {review.readinessSummary}
        </p>
      </div>

      {/* L5 (§8.3.8) — the review recommends the next concrete action:
          re-practice the weakest practiced moments, weakest first. */}
      {sharpenTargets.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-ink-500 mb-2">
            Sharpen next
          </div>
          <div className="space-y-2">
            {sharpenTargets.map((t) => (
              <button
                key={t.momentId}
                type="button"
                onClick={() => void onPracticeMoment(t.moment)}
                className="min-h-[44px] w-full flex items-center justify-between gap-3 rounded-xl border border-purple-200 dark:border-brand-purple/40 px-4 py-2.5 text-left text-sm font-semibold text-purple-700 dark:text-brand-lavender hover:bg-purple-50 dark:hover:bg-ink-800"
              >
                <span className="min-w-0 truncate">
                  {t.title}
                  {t.bestComposite != null && (
                    <span className="ml-2 font-normal text-slate-400 dark:text-ink-500 tabular-nums">
                      best {Math.round(t.bestComposite)}
                    </span>
                  )}
                </span>
                <span className="shrink-0">Practice again →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRD v3 Phase 6 (§10.8) — rank + streak + achievements strip. */}
      <ProgressionStrip />

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={onBackToPlan}
          className="min-h-[44px] rounded-xl bg-pink-500 hover:bg-pink-400 px-5 py-2.5 font-semibold text-white"
        >
          Keep practicing
        </button>
        <Link
          href="/dashboard"
          className="min-h-[44px] inline-flex items-center rounded-xl border border-slate-200 dark:border-ink-700 px-5 py-2.5 font-semibold text-slate-600 dark:text-ink-300 hover:bg-slate-50 dark:hover:bg-ink-800"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
