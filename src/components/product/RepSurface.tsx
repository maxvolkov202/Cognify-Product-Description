"use client";

import { useEffect, useState } from "react";
import {
  RotateCcw,
  Loader2,
  Lightbulb,
  Target,
  AlertTriangle,
} from "lucide-react";
import type {
  Framework,
  RepScore,
  ModeId,
  Callout,
  SkillDimension,
} from "@/types/domain";
import { RecordButton } from "./RecordButton";
import { FeedbackPanel, type PreviousRepSummary } from "./FeedbackPanel";
import { FlowFeedbackPanel } from "./FlowFeedbackPanel";
import { RepFrameworkStrip } from "./RepFrameworkStrip";
import type { RepTypeFramework } from "@/lib/ai/rep-types";
import { GradientButton } from "@/components/shared/GradientButton";
import type { RecordingResult } from "@/lib/audio/capture";
import { saveRep, insertPendingRep, getRepResult } from "@/server/actions/reps";
import { meetsSpeakingThreshold } from "@/lib/workout/pause";
import { useRepStatus } from "@/hooks/useRepStatus";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type SpeakingThreshold = {
  minWords?: number;
  minRatio?: number;
};

type Props = {
  prompt: string;
  framework?: Framework;
  mode?: ModeId;
  topic?: string;
  maxDurationMs?: number;
  sessionId?: string | null;
  revealFrameworkAfterMs?: number;
  /** Shown as a focus overlay on idle state — used for retries. */
  retryFocus?: Callout | null;
  /** Shown as a focus overlay on idle state — carried from the previous
   *  rep in the same workout session. Distinct from retryFocus (same-rep). */
  carryoverFocus?: Callout | null;
  /** Previous rep's dimension scores (same workout) — used to render
   *  per-dimension delta pills on the feedback surface when continuity lines
   *  up with the current rep's scores. */
  previousDimensionScores?: Partial<Record<SkillDimension, number>>;
  /** Full summary of the previous rep (composite, dimensions, top weakness,
   *  transcript). When present, the feedback surface triggers a rep-to-rep
   *  progression comparison via /api/progression. */
  previousRepSummary?: PreviousRepSummary | null;
  /** Rep-type-specific framework cheat-sheet. Shown as a compact strip above
   *  the prompt in Daily Workout mode only. No effect if not provided. */
  repTypeFramework?: RepTypeFramework;
  /** Enforces word-count + duration-ratio floor. Triggers a modal gate. */
  speakingThreshold?: SpeakingThreshold;
  /** External retry handler. If provided, RepSurface calls this instead
   *  of resetting its own state. Used by WorkoutSession to force remount
   *  and pop the last score on retry. */
  onRetry?: () => void;
  /** External discard handler for the speaking-threshold gate. */
  onDiscard?: () => void;
  /** Which feedback surface to render in the `done` phase.
   *  - `"full"` (default): standard FeedbackPanel with full dimension
   *    breakdown, callouts, transcript, retry + next buttons.
   *  - `"flow"`: compressed FlowFeedbackPanel used by Flow Session —
   *    single insight + auto-advance. No retry (Flow is momentum-based). */
  feedbackMode?: "full" | "flow";
  /** Rep index + total (1-based) — used by FlowFeedbackPanel's kicker. */
  flowRepIndex?: number;
  flowTotalReps?: number;
  /** Archetype display name — surfaced by FlowFeedbackPanel. */
  flowArchetypeName?: string;
  /** Pressure archetype id for this rep (if it's a pressure rep). Sent
   *  to /api/score so the server applies the archetype's weight profile. */
  pressureArchetypeId?: string | null;
  /** When set, enables the 3-tile Redo/Pause/Submit row on the record
   *  surface (mockup #4). Callback fires after the recording is
   *  cancelled — caller typically navigates to /dashboard so the
   *  between-rep pause state picks up the workout on return. */
  onMidRepPause?: () => void;
  /** Archetype metadata for the post-rep FeedbackPanel "what you trained"
   *  badge. Shown only when the rep was a pressure rep AND feedbackMode
   *  is "full" (Flow uses FlowFeedbackPanel, which has its own chrome). */
  pressureContext?: {
    archetypeName: string;
    archetypeTagline: string;
  } | null;
  onComplete?: (payload: {
    score: RepScore;
    recording: RecordingResult;
    repId: string;
    sessionId: string;
    transcript: string;
    words: { word: string; startMs: number; endMs: number }[];
    gate?: "signup_required";
    guestRepCount?: number;
  }) => void;
  onNext?: () => void;
  nextLabel?: string;
};

type Phase =
  | { kind: "idle" }
  | { kind: "transcribing" }
  | {
      kind: "speaking-gate";
      recording: RecordingResult;
      transcript: string;
      words: { word: string; startMs: number; endMs: number }[];
      wordCount: number;
      minWords: number;
      durationRatio: number;
      canProceed: boolean;
    }
  | { kind: "scoring" }
  | { kind: "saving" }
  | {
      // Async path: Edge Function is processing the rep. Shows progress UI
      // while useRepStatus subscribes via Supabase Realtime. Transitions
      // to 'done' when status='completed', or 'error' on 'failed'.
      kind: "processing-async";
      repId: string;
      recording: RecordingResult;
      transcript: string;
      words: { word: string; startMs: number; endMs: number }[];
    }
  | {
      kind: "done";
      score: RepScore;
      recording: RecordingResult;
      transcript: string;
      words: { word: string; startMs: number; endMs: number }[];
      repId: string | null;
      calloutIds: string[];
      gate: "signup_required" | null;
    }
  | { kind: "error"; message: string; recording?: RecordingResult };

// Feature flag — when set to "true" in .env, authenticated users run scoring
// via the Supabase `process-rep` Edge Function with realtime status updates.
// Guests always use the sync path (no Supabase JWT, no realtime access).
// Sync path remains the default until Phase 4 is deployed + smoke-tested
// on a public URL.
const USE_ASYNC_SCORING =
  process.env.NEXT_PUBLIC_USE_ASYNC_SCORING === "true";

export function RepSurface({
  prompt,
  framework,
  mode = "scenario_training",
  topic,
  maxDurationMs = 90_000,
  sessionId,
  revealFrameworkAfterMs = 0,
  retryFocus,
  carryoverFocus,
  previousDimensionScores,
  previousRepSummary,
  repTypeFramework,
  speakingThreshold,
  onRetry,
  onDiscard,
  feedbackMode = "full",
  flowRepIndex,
  flowTotalReps,
  flowArchetypeName,
  pressureArchetypeId,
  pressureContext,
  onMidRepPause,
  onComplete,
  onNext,
  nextLabel = "Next rep",
}: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [frameworkVisible, setFrameworkVisible] = useState(
    revealFrameworkAfterMs === 0,
  );
  const [readingProgress, setReadingProgress] = useState(0);

  // Realtime subscription for the async scoring path. Always called (React
  // hook rules) but only subscribes when phase is processing-async. Returns
  // { status: null } otherwise.
  const asyncRepId =
    phase.kind === "processing-async" ? phase.repId : null;
  const repStatus = useRepStatus(asyncRepId);

  // Drive the async→done / async→error transitions when realtime fires.
  useEffect(() => {
    if (phase.kind !== "processing-async") return;
    if (repStatus.status === "completed") {
      (async () => {
        const fetched = await getRepResult(phase.repId);
        if (!fetched || !fetched.score) {
          setPhase({
            kind: "error",
            message: "Scoring completed but results couldn't be loaded.",
            recording: phase.recording,
          });
          return;
        }
        setPhase({
          kind: "done",
          score: fetched.score,
          recording: phase.recording,
          transcript: phase.transcript,
          words: phase.words,
          repId: phase.repId,
          calloutIds: fetched.calloutIds,
          gate: null,
        });
        onComplete?.({
          score: fetched.score,
          recording: phase.recording,
          repId: phase.repId,
          sessionId: sessionId ?? phase.repId,
          transcript: phase.transcript,
          words: phase.words,
        });
      })();
    } else if (repStatus.status === "failed") {
      setPhase({
        kind: "error",
        message: "Scoring failed in the background — tap retry.",
        recording: phase.recording,
      });
    }
  }, [phase, repStatus.status, onComplete, sessionId]);

  useEffect(() => {
    if (!framework || revealFrameworkAfterMs <= 0) {
      setFrameworkVisible(true);
      return;
    }
    setFrameworkVisible(false);
    setReadingProgress(0);

    const start = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / revealFrameworkAfterMs) * 100);
      setReadingProgress(pct);
      if (pct >= 100) window.clearInterval(interval);
    }, 80);

    const reveal = window.setTimeout(() => {
      setFrameworkVisible(true);
    }, revealFrameworkAfterMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(reveal);
    };
  }, [framework, revealFrameworkAfterMs, prompt]);

  const handleRecordingComplete = async (result: RecordingResult) => {
    let transcript = `[No transcript — Phase B placeholder]`;
    let words: { word: string; startMs: number; endMs: number }[] = [];

    setPhase({ kind: "transcribing" });
    try {
      const fd = new FormData();
      fd.append(
        "audio",
        new File([result.blob], "rep.webm", { type: result.mimeType }),
      );
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (res.ok) {
        const data = (await res.json()) as {
          transcript: string;
          words: { word: string; startMs: number; endMs: number }[];
        };
        transcript = data.transcript || transcript;
        words = data.words ?? [];
      }
    } catch {
      // fall through
    }

    // ——— Speaking threshold gate ——————————————————————
    // Softer floor (60% of time budget + minWords). Failing surfaces a
    // heads-up modal with Retry / Proceed anyway / Discard. Proceed is
    // disabled only when word count is below the 10-word hard floor
    // (canProceed from meetsSpeakingThreshold) — nothing to score below
    // that.
    if (speakingThreshold) {
      const gateCheck = meetsSpeakingThreshold({
        transcript,
        wordCount: words.length > 0 ? words.length : undefined,
        durationMs: result.durationMs,
        timeBudgetMs: maxDurationMs,
      });
      if (!gateCheck.passed) {
        setPhase({
          kind: "speaking-gate",
          recording: result,
          transcript,
          words,
          wordCount: gateCheck.wordCount,
          minWords: gateCheck.minWords,
          durationRatio: gateCheck.durationRatio,
          canProceed: gateCheck.canProceed,
        });
        return;
      }
    }

    await runScoringPath(result, transcript, words);
  };

  // Extracted from handleRecordingComplete so the "Proceed anyway" button
  // on the speaking-gate modal can reuse the exact same scoring flow.
  const runScoringPath = async (
    result: RecordingResult,
    transcript: string,
    words: { word: string; startMs: number; endMs: number }[],
  ) => {
    // ——— Async fork (authenticated users only) ————————————————
    // When the NEXT_PUBLIC_USE_ASYNC_SCORING flag is on AND the user has a
    // Supabase session, skip the blocking /api/score call and instead:
    //   1. Upload audio + insertPendingRep (status='pending')
    //   2. Invoke the `process-rep` Edge Function (fire-and-forget)
    //   3. Subscribe to reps.status via useRepStatus (a separate useEffect
    //      drives the transition to 'done' when status='completed')
    // Guests fall through to the sync path — they don't have a Supabase JWT,
    // so the Edge Function's verify_jwt gate would reject them and realtime
    // RLS would hide the row.
    if (USE_ASYNC_SCORING) {
      let audioUrl: string | null = null;
      try {
        const fd = new FormData();
        fd.append(
          "audio",
          new File([result.blob], "rep.webm", { type: result.mimeType }),
        );
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (uploadRes.ok) {
          const up = (await uploadRes.json()) as { path: string | null };
          audioUrl = up.path;
        }
      } catch {
        audioUrl = null;
      }

      const pending = await insertPendingRep({
        mode,
        promptText: prompt,
        durationMs: result.durationMs,
        transcript,
        audioPath: audioUrl,
        framework: framework ?? null,
        topic: topic ?? null,
        sessionId: sessionId ?? null,
        timeBudgetMs: maxDurationMs,
        words,
      });

      if (pending) {
        // Fire-and-forget Edge Function invocation. The realtime
        // subscription (useRepStatus) drives the phase transition.
        const supabase = createSupabaseBrowserClient();
        void supabase.functions
          .invoke("process-rep", { body: { repId: pending.repId } })
          .catch((err) => {
            console.error("[process-rep invoke] failed:", err);
          });

        setPhase({
          kind: "processing-async",
          repId: pending.repId,
          recording: result,
          transcript,
          words,
        });
        return;
      }
      // insertPendingRep returned null (guest or DB down) — fall through
      // to the sync path below.
    }

    let score: RepScore;
    setPhase({ kind: "scoring" });
    // Client-side timeout so Claude hangs don't trap the user. Bumped from
    // 20s → 45s because the server route has maxDuration=30 AND Claude
    // calls against the full knowledge base + rubric can run 15-25s on
    // cold starts / slow networks (observed on mobile). 45s lets the
    // server finish + adds network buffer; server-side timeout is still
    // the true ceiling.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          transcript:
            transcript ||
            `Rep recorded for ${Math.round(result.durationMs / 1000)}s on: ${prompt}`,
          promptText: prompt,
          durationMs: result.durationMs,
          ...(words.length > 0 ? { words } : {}),
          ...(framework
            ? {
                frameworkId: framework.id,
                frameworkNodes: framework.nodes.map((n) => ({
                  label: n.label,
                  description: n.description,
                })),
              }
            : {}),
          ...(pressureArchetypeId
            ? { pressureArchetypeId }
            : {}),
        }),
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Scoring failed.");
      }
      score = (await res.json()) as RepScore;
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout =
        err instanceof DOMException && err.name === "AbortError";
      const message = isTimeout
        ? "Scoring took longer than 45 seconds — your audio is saved below. Tap Retry to score again. Slow networks (mobile/hotspot) sometimes need a second try."
        : err instanceof Error
          ? `${err.message}. Your recording was captured and is playable below — tap Retry to score again.`
          : "Scoring failed. Your recording is saved — tap Retry.";
      setPhase({ kind: "error", message, recording: result });
      return;
    }

    // Persist the Supabase Storage path (not the signed URL) so we can
    // regenerate short-lived signed URLs on demand. Same-session playback
    // uses the local Blob URL from RecordingResult.url, so no signed URL
    // needed here.
    let audioUrl: string | null = null;
    try {
      const fd = new FormData();
      fd.append(
        "audio",
        new File([result.blob], "rep.webm", { type: result.mimeType }),
      );
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (uploadRes.ok) {
        const up = (await uploadRes.json()) as { path: string | null };
        audioUrl = up.path;
      }
    } catch {
      audioUrl = null;
    }

    setPhase({ kind: "saving" });
    let savedRepId: string | null = null;
    let savedCalloutIds: string[] = [];
    let savedGate: "signup_required" | null = null;
    try {
      const saved = await saveRep({
        mode,
        promptText: prompt,
        durationMs: result.durationMs,
        transcript,
        audioUrl,
        score,
        framework: framework ?? null,
        topic: topic ?? null,
        sessionId: sessionId ?? null,
      });
      savedRepId = saved.repId;
      savedCalloutIds = saved.calloutIds;
      savedGate = saved.gate ?? null;
      onComplete?.({
        score,
        recording: result,
        repId: saved.repId,
        sessionId: saved.sessionId,
        transcript,
        words,
        gate: saved.gate,
        guestRepCount: saved.guestRepCount,
      });
    } catch {
      // Persistence failed, score still shown.
    }

    setPhase({
      kind: "done",
      score,
      recording: result,
      transcript,
      words,
      repId: savedRepId,
      calloutIds: savedCalloutIds,
      gate: savedGate,
    });
  };

  const handleRetry = () => {
    // Revoke any outstanding blob URLs before the old phase state is
    // discarded — prevents leaks on repeated retries within one session.
    if (phase.kind === "done") URL.revokeObjectURL(phase.recording.url);
    if (phase.kind === "error" && phase.recording)
      URL.revokeObjectURL(phase.recording.url);
    if (phase.kind === "speaking-gate")
      URL.revokeObjectURL(phase.recording.url);

    // External retry handler takes precedence. If provided, the parent
    // (WorkoutSession) will force-remount this component with a new key.
    if (onRetry) {
      onRetry();
      return;
    }
    setPhase({ kind: "idle" });
  };

  const handleDiscard = () => {
    if (phase.kind === "speaking-gate")
      URL.revokeObjectURL(phase.recording.url);
    if (onDiscard) {
      onDiscard();
      return;
    }
    setPhase({ kind: "idle" });
  };

  // ——— Speaking threshold gate ——————————————————————————
  if (phase.kind === "speaking-gate") {
    const handleProceed = () => {
      void runScoringPath(phase.recording, phase.transcript, phase.words);
    };
    return (
      <div className="mx-auto max-w-2xl">
        <div className="surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-8 md:p-10">
            <div className="brand-gradient inline-grid size-11 place-items-center rounded-xl shadow-sm">
              <AlertTriangle
                className="size-5 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
              Your rep was shorter than the prompt suggested.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              You used about {Math.round(phase.durationRatio * 100)}% of the
              time budget ({phase.wordCount} words). Retry for a fuller take,
              or proceed and score what you have.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                <RotateCcw className="size-4" />
                Retry
              </button>
              {phase.canProceed ? (
                <button
                  type="button"
                  onClick={handleProceed}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-brand-purple bg-white px-5 py-2.5 text-sm font-semibold text-brand-purple hover:bg-brand-purple/5"
                >
                  Proceed anyway
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Too few words captured to score — try again."
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-ink-200 bg-ink-100 px-5 py-2.5 text-sm font-semibold text-ink-400"
                >
                  Proceed anyway
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
              >
                Discard
              </button>
            </div>
            <p className="mt-4 text-[11px] text-ink-400">
              {phase.canProceed
                ? "Nothing has been saved yet. Proceeding scores your rep now."
                : "Too few words captured to score — please retry."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ——— Feedback / done state ——————————————————————————
  if (phase.kind === "done") {
    if (
      feedbackMode === "flow" &&
      onNext &&
      flowRepIndex !== undefined &&
      flowTotalReps !== undefined
    ) {
      return (
        <FlowFeedbackPanel
          score={phase.score}
          repIndexOneBased={flowRepIndex}
          totalReps={flowTotalReps}
          archetypeName={flowArchetypeName ?? "Pressure"}
          onAdvance={onNext}
        />
      );
    }
    const navButtons = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onNext && (
          <GradientButton onClick={onNext} size="lg">
            {nextLabel}
          </GradientButton>
        )}
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          <RotateCcw className="size-4" /> Run it again
        </button>
      </div>
    );
    return (
      <div className="space-y-6">
        {/* Owen's note: navigation belongs at the top so users can advance
         *  the moment they've read enough, instead of scrolling. We keep
         *  a copy at the bottom for users who scrolled to the end. */}
        {navButtons}
        <FeedbackPanel
          score={phase.score}
          audioUrl={phase.recording.url}
          durationMs={phase.recording.durationMs}
          transcript={phase.transcript}
          words={phase.words}
          previousDimensionScores={previousDimensionScores}
          previousRepSummary={previousRepSummary ?? null}
          repId={phase.repId}
          calloutIds={phase.calloutIds}
          pressureContext={pressureContext ?? null}
        />
        {navButtons}
      </div>
    );
  }

  const isWorking =
    phase.kind === "transcribing" ||
    phase.kind === "scoring" ||
    phase.kind === "saving" ||
    phase.kind === "processing-async";

  // Mockup #3 two-column layout: used for Daily Workout idle/ready
  // state so the framework-with-notes sits beside the gradient record
  // card. Other modes (Build-a-Rep, /try) and other phases continue to
  // render the classic single-column stack.
  const twoColumnLayout =
    mode === "daily_workout" && phase.kind === "idle" && repTypeFramework;

  return (
    <div
      className={cn(
        "mx-auto flex flex-col gap-6",
        twoColumnLayout ? "max-w-5xl" : "max-w-2xl",
      )}
    >
      {/* ——— Focus overlay (retry takes precedence over carryover) ——— */}
      {(retryFocus || carryoverFocus) && phase.kind === "idle" && (
        <FocusOverlay
          callout={(retryFocus ?? carryoverFocus) as Callout}
          label={retryFocus ? "Focus for this retry" : "From your last rep"}
        />
      )}

      {/* ——— Daily Workout framework strip (legacy cheat sheet) ———
          Only shown in non-idle Daily Workout phases (error). The idle
          state gets the fuller two-column layout below, which embeds
          the same framework component on the left side. */}
      {mode === "daily_workout" &&
        repTypeFramework &&
        phase.kind === "error" && (
          <RepFrameworkStrip framework={repTypeFramework} allowNotes />
        )}

      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8 md:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The prompt
          </p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink-900 md:text-4xl">
            {prompt}
          </h2>

          {framework && !frameworkVisible && revealFrameworkAfterMs > 0 && (
            <div className="mt-6 border-t border-ink-200 pt-5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <span>Take a moment to read</span>
                <span>
                  Framework in{" "}
                  {Math.ceil(
                    (100 - readingProgress) * (revealFrameworkAfterMs / 100_000),
                  )}
                  s
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="brand-gradient h-full rounded-full transition-[width] duration-100"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
            </div>
          )}

          {framework && frameworkVisible && (
            <div className="mt-6 border-t border-ink-200 pt-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                <Lightbulb className="size-3.5" />
                Hold this structure · {framework.name}
              </div>
              <ol className="mt-4 space-y-2.5">
                {framework.nodes.map((node, i) => (
                  <li
                    key={node.id}
                    className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3"
                  >
                    <div className="brand-gradient grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink-900">
                        {node.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-600">
                        {node.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {twoColumnLayout ? (
        <div className="grid gap-5 md:grid-cols-[1fr_1fr] md:items-stretch">
          <div className="md:min-h-full">
            <RepFrameworkStrip framework={repTypeFramework!} allowNotes />
          </div>
          <div className="brand-gradient relative flex min-h-[360px] flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl p-8 text-center text-white shadow-[var(--shadow-glow)]">
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-8 size-56 rounded-full bg-brand-magenta/30 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <p className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
                Speak clearly.
                <br />
                Speak confidently.
              </p>
            </div>
            <div className="relative">
              <RecordButton
                maxDurationMs={maxDurationMs}
                onComplete={handleRecordingComplete}
                disabled={isWorking || !frameworkVisible}
                {...(onMidRepPause ? { onPause: onMidRepPause } : {})}
              />
            </div>
            <p className="relative text-xs font-medium text-white/85">
              3 second countdown then you are live
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-ink-200 p-10">
          <RecordButton
            maxDurationMs={maxDurationMs}
            onComplete={handleRecordingComplete}
            disabled={isWorking || !frameworkVisible}
            {...(onMidRepPause ? { onPause: onMidRepPause } : {})}
          />
          {!frameworkVisible && framework && revealFrameworkAfterMs > 0 && (
            <p className="text-xs text-ink-400">
              Wait for the framework to appear before recording.
            </p>
          )}
        </div>
      )}

      {isWorking && (
        <>
          <div className="surface-card flex items-center justify-center gap-3 p-6 text-sm text-ink-600">
            <Loader2 className="size-4 animate-spin text-brand-purple" />
            {phase.kind === "transcribing" && "Transcribing your rep…"}
            {phase.kind === "scoring" && "Scoring based on proprietary rubric…"}
            {phase.kind === "saving" && "Saving your progress…"}
            {phase.kind === "processing-async" && "Scoring in the background — realtime updates incoming…"}
          </div>
          {(phase.kind === "scoring" ||
            phase.kind === "saving" ||
            phase.kind === "processing-async") && <FeedbackSkeleton />}
        </>
      )}

      {phase.kind === "error" && (
        <div className="surface-card p-6">
          <p className="text-sm font-semibold text-ink-900">
            Recording captured
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            {phase.message}
          </p>
          {phase.recording && (
            <audio
              src={phase.recording.url}
              controls
              className="mt-4 w-full"
              preload="metadata"
            />
          )}
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300"
          >
            <RotateCcw className="size-3.5" />
            Record again
          </button>
        </div>
      )}
    </div>
  );
}

function FocusOverlay({
  callout,
  label,
}: {
  callout: Callout;
  label: string;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="flex items-start gap-3 p-5">
        <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-lg shadow-sm">
          <Target
            className="size-4 text-white"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {label}
          </p>
          <p className="mt-0.5 text-sm font-bold text-ink-900">
            {callout.title}
          </p>
          {callout.suggestedRewrite && (
            <p className="mt-1 text-xs italic leading-relaxed text-ink-700">
              &ldquo;{callout.suggestedRewrite}&rdquo;
            </p>
          )}
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            {callout.body}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-render the feedback panel's shape while Claude scores. Gives the user
 * something to watch instead of a spinner, so the transition to real
 * feedback feels quick even when scoring takes 3–5 seconds.
 */
function FeedbackSkeleton() {
  return (
    <div className="surface-card overflow-hidden animate-pulse">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6">
        <div className="h-3 w-24 rounded bg-ink-100" />
        <div className="mt-2 h-7 w-40 rounded bg-ink-100" />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col}>
              <div className="h-2 w-16 rounded bg-ink-100" />
              <div className="mt-3 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between">
                      <div className="h-2 w-16 rounded bg-ink-100" />
                      <div className="h-2 w-8 rounded bg-ink-100" />
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-20 w-full rounded-2xl bg-ink-100" />
          <div className="h-20 w-full rounded-2xl bg-ink-100" />
        </div>
      </div>
    </div>
  );
}
