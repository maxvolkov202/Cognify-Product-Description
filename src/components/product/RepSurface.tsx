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
import type { ScoreRepModeContext } from "@/lib/ai/score";
import { RecordButton } from "./RecordButton";
import { FeedbackPanel, type PreviousRepSummary } from "./feedback";
import { FlowFeedbackPanel } from "./FlowFeedbackPanel";
import { OptimisticDimensionPreview } from "./feedback/OptimisticDimensionPreview";
import { computeOptimisticDims } from "@/lib/scoring/deterministic-client";
import type { DimensionScore } from "@/types/domain";
import { RepFrameworkStrip } from "./RepFrameworkStrip";
import type { RepTypeFramework } from "@/lib/ai/rep-types";
import { GradientButton } from "@/components/shared/GradientButton";
import type { RecordingResult } from "@/lib/audio/capture";
import { saveRep, insertPendingRep, getRepResult } from "@/server/actions/reps";
import { meetsSpeakingThreshold } from "@/lib/workout/pause";
import { useRepStatus } from "@/hooks/useRepStatus";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { RepHintsBar } from "./RepHintsBar";

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
  /** PRD v3 §4.5 — feedback layout. "v2" = Score → ONE Coach's Focus →
   *  Core Skill Breakdown (Universal Training Engine); "v1" = legacy. */
  feedbackVariant?: "v1" | "v2";
  /** ADR-001 — target response window. When set, the recorder counts UP
   *  against the band (never hard-stops at it), the infra ceiling is
   *  raised well past the window, and the window max (not the ceiling)
   *  becomes the scoring time budget so overage is a signal, not a gate. */
  responseWindow?: { minSec: number; maxSec: number } | null;
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
  /** 1-based rep index in the session, surfaced by FeedbackPanel's
   *  RepProgressStrip. Optional — when omitted, the strip is hidden. */
  feedbackRepIndex?: number;
  feedbackTotalReps?: number;
  /** Pre-formatted, uppercase mode label for the strip. */
  feedbackModeLabel?: string;
  /** Carry-over context from the previous rep — surfaces "Last rep focus:
   *  {dim} — keep building on it" above the score hero. `customHint` is
   *  the AI-authored tail (Phase 3 nextRepHint) that overrides the static
   *  copy.ts fallback when present. */
  feedbackLastRepFocus?: {
    dimension: SkillDimension;
    customHint?: string;
  } | null;
  /** Wires the "Save and exit" link in RepProgressStrip. WorkoutSession
   *  saves pause state and routes to dashboard; SkillLabSession just
   *  routes back to the lobby. */
  onFeedbackSaveExit?: () => void;
  /** Phase 2: per-mode/per-session signals plumbed into /api/score so the
   *  AI can write mode-aware feedback (focus pivot, pressure framing,
   *  carry-over from previous headline). Omitting falls back to Phase 1
   *  mode-blind scoring. */
  scoreModeContext?: ScoreRepModeContext;
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
  /** Phase 8 — muscle-group context. Threaded into insertPendingRep +
   *  saveRep + /api/score-internal body so the scoring pipeline gets
   *  the exercise XML + rubric hint. NULL/undefined for legacy callers. */
  exerciseId?: string | null;
  muscleGroupDayId?: string | null;
  isGraduationRep?: boolean;
  /** PRD v3 engine — attempt lineage. When this surface records a Retry
   *  (or "again") attempt, saveRep persists the linkage so the coaching
   *  ledger can back-fill the first rep's implemented verdict. Undefined
   *  for legacy callers → 'first'. Sync saveRep path only; the async
   *  (Edge Function) path picks this up with the Phase 5 long-rep work. */
  attemptKind?: "first" | "retry" | "again";
  parentRepId?: string | null;
  /** PRD v3 Phase 4 — Skill Lab application id, folded into the profile's
   *  per-application estimate by saveRep. */
  applicationId?: string | null;
  /** PRD v3 engine — hide the internal "Run it again" reset on the done
   *  screen. The v2 loop's primary CTA is the structured Retry (with
   *  focus carry-over + lineage); an unlinked re-record next to it would
   *  be a footgun. */
  hideRunItAgain?: boolean;
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
  | {
      kind: "scoring";
      /** Phase 2: deterministic dim scores computed client-side from word
       *  timings the moment Deepgram returns. Populates the
       *  OptimisticDimensionPreview with real delivery + thinking_quality
       *  cards while the LLM call is in flight. Absent when word timings
       *  are missing (audio-only paths or transcription failed). */
      optimisticDims?: DimensionScore[];
    }
  | {
      // Phase 5 progressive UI — intermediate state after /api/score/stage1
      // returns. All 6 dim scores + composite + headlineTone in hand; only
      // the copy (headline + callouts + bullets) is still loading via
      // /api/score/stage2. UI shows the dim grid with real scores instead
      // of shimmer placeholders + a "writing your detailed feedback…"
      // header strip.
      kind: "scoring-copy";
      stage1: {
        composite: number;
        dimensions: DimensionScore[];
        primaryFocusDimension:
          | "clarity"
          | "structure"
          | "conciseness"
          | "thinking_quality"
          | "delivery"
          | "tone";
        headlineTone: "blunt" | "directive" | "praise" | "celebratory";
      };
      recording: RecordingResult;
      transcript: string;
      words: { word: string; startMs: number; endMs: number }[];
    }
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
      /** Phase 2: same optimistic dims as the sync scoring phase. */
      optimisticDims?: DimensionScore[];
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

// Phase 5 progressive UI flag — when set to "true", the sync scoring
// path calls /api/score/stage1 first (renders dim grid immediately),
// then /api/score/stage2 (fills in headline + callouts + bullets).
// Default OFF for safety; set in .env.local for dev testing.
const USE_TWO_STAGE_SCORING =
  process.env.NEXT_PUBLIC_USE_TWO_STAGE_SCORING === "true";

export function RepSurface({
  prompt,
  framework,
  mode = "scenario_training",
  topic,
  maxDurationMs = 90_000,
  responseWindow = null,
  feedbackVariant = "v1",
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
  feedbackRepIndex,
  feedbackTotalReps,
  feedbackModeLabel,
  feedbackLastRepFocus,
  onFeedbackSaveExit,
  scoreModeContext,
  onMidRepPause,
  onComplete,
  onNext,
  nextLabel = "Next rep",
  exerciseId,
  muscleGroupDayId,
  isGraduationRep,
  attemptKind,
  parentRepId,
  applicationId,
  hideRunItAgain = false,
}: Props) {
  // ADR-001: with a window, the hard stop is only an infra ceiling —
  // at least 2× the window and never under 3 minutes.
  const effectiveMaxDurationMs = responseWindow
    ? Math.max(maxDurationMs, responseWindow.maxSec * 2000, 180_000)
    : maxDurationMs;
  const scoringTimeBudgetMs = responseWindow
    ? responseWindow.maxSec * 1000
    : maxDurationMs;

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Phase 15 P-1 — persistence failures must be VISIBLE. saveRep's
  // graceful fallback used to be indistinguishable from success (F-4:
  // the whole flagship loop "worked" with zero rows landing).
  const [persistFailed, setPersistFailed] = useState(false);
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
        timeBudgetMs: scoringTimeBudgetMs,
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
    // Phase 2 — compute deterministic dim scores client-side from word
    // timings the moment we have them. delivery + thinking_quality
    // render immediately while the LLM call is in flight; the other
    // four dims shimmer. When the server response arrives, all six
    // dims get replaced with the canonical values (which will MATCH
    // the optimistic ones since both compute from the same pure
    // functions — server is still source of truth).
    const optimisticDims =
      computeOptimisticDims({
        words,
        transcript,
        durationMs: result.durationMs,
        timeBudgetMs: scoringTimeBudgetMs,
      }) ?? undefined;
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
        timeBudgetMs: scoringTimeBudgetMs,
        words,
        // Phase 8 — muscle-group threading.
        ...(exerciseId ? { exerciseId } : {}),
        ...(muscleGroupDayId ? { muscleGroupDayId } : {}),
        ...(isGraduationRep ? { isGraduationRep: true } : {}),
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
          ...(optimisticDims ? { optimisticDims } : {}),
        });
        return;
      }
      // insertPendingRep returned null (guest or DB down) — fall through
      // to the sync path below.
    }

    let score: RepScore;
    setPhase({
      kind: "scoring",
      ...(optimisticDims ? { optimisticDims } : {}),
    });

    // Body the scoring endpoints all consume — same shape across legacy,
    // stage1, stage2. Built once and reused.
    const scoreBody = {
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
      ...(pressureArchetypeId ? { pressureArchetypeId } : {}),
      ...(scoreModeContext ? { modeContext: scoreModeContext } : {}),
      // Phase 8 — muscle-group context for exercise-aware scoring.
      // Sent in the request body so the scoring pipeline sees it
      // BEFORE the rep row's tagWorkoutRep finishes (those race).
      ...(exerciseId ? { exerciseId } : {}),
      ...(muscleGroupDayId ? { muscleGroupDayId } : {}),
      ...(isGraduationRep ? { isGraduationRep: true } : {}),
    };

    // Client-side timeout so Claude hangs don't trap the user. Bumped from
    // 20s → 45s because the server route has maxDuration=30 AND Claude
    // calls against the full knowledge base + rubric can run 15-25s on
    // cold starts / slow networks (observed on mobile). 45s lets the
    // server finish + adds network buffer; server-side timeout is still
    // the true ceiling.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    if (USE_TWO_STAGE_SCORING) {
      // Phase 5 progressive UI path. Stage 1 returns scores quickly,
      // we render the dim grid with real numbers + a "writing your
      // feedback…" header, then stage 2 fills in the copy.
      try {
        const s1Res = await fetch("/api/score/stage1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(scoreBody),
        });
        if (!s1Res.ok) {
          const body = await s1Res.json().catch(() => ({}));
          throw new Error(body.message ?? "Stage 1 scoring failed.");
        }
        const { stage1 } = (await s1Res.json()) as {
          stage1: {
            composite: number;
            dimensions: DimensionScore[];
            primaryFocusDimension:
              | "clarity"
              | "structure"
              | "conciseness"
              | "thinking_quality"
              | "delivery"
              | "tone";
            headlineTone: "blunt" | "directive" | "praise" | "celebratory";
          };
        };

        // Render the intermediate "scoring-copy" state — user sees real
        // dim scores immediately while stage 2 generates the copy.
        setPhase({
          kind: "scoring-copy",
          stage1,
          recording: result,
          transcript,
          words,
        });

        const s2Res = await fetch("/api/score/stage2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ ...scoreBody, stage1 }),
        });
        clearTimeout(timeoutId);
        if (!s2Res.ok) {
          // Stage 2 specifically failed — we still have real scores
          // from stage 1. Fall back to error state with a partial
          // notice rather than full mock. Future polish: render a
          // "scores only" version of FeedbackPanel.
          const body = await s2Res.json().catch(() => ({}));
          throw new Error(
            body.message ?? "Detailed feedback generation failed.",
          );
        }
        const { score: assembledScore } = (await s2Res.json()) as {
          score: RepScore;
        };
        score = assembledScore;
      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout =
          err instanceof DOMException && err.name === "AbortError";
        const message = isTimeout
          ? "Scoring took longer than 45 seconds — your audio is saved below. Tap Retry to score again."
          : err instanceof Error
            ? `${err.message}. Your recording was captured and is playable below — tap Retry to score again.`
            : "Scoring failed. Your recording is saved — tap Retry.";
        setPhase({ kind: "error", message, recording: result });
        return;
      }
    } else {
      // Legacy single-call path. Keeps working unchanged.
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(scoreBody),
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
        // Phase 8 — muscle-group threading.
        ...(exerciseId ? { exerciseId } : {}),
        ...(muscleGroupDayId ? { muscleGroupDayId } : {}),
        ...(isGraduationRep ? { isGraduationRep: true } : {}),
        // Pressure archetype → server-side isPressureRep detection
        // (explore_pressure achievement). Same id already sent to
        // /api/score in scoreBody for weight-profile scoring.
        ...(pressureArchetypeId ? { pressureArchetypeId } : {}),
        // PRD v3 engine — attempt lineage.
        ...(attemptKind && attemptKind !== "first"
          ? { attemptKind, parentRepId: parentRepId ?? null }
          : {}),
        // PRD v3 Phase 4 — Skill Lab application fold.
        ...(applicationId ? { applicationId } : {}),
      });
      savedRepId = saved.repId;
      savedCalloutIds = saved.calloutIds;
      savedGate = saved.gate ?? null;
      if (!saved.persisted) setPersistFailed(true);
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
      setPersistFailed(true);
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
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white md:text-3xl">
              Your rep was shorter than the prompt suggested.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
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
                  className="inline-flex items-center gap-2 rounded-full border-2 border-brand-purple bg-white dark:bg-ink-900 px-5 py-2.5 text-sm font-semibold text-brand-purple dark:text-brand-lavender hover:bg-brand-purple/5"
                >
                  Proceed anyway
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Too few words captured to score — try again."
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-ink-100 dark:bg-ink-800 px-5 py-2.5 text-sm font-semibold text-ink-400 dark:text-ink-500"
                >
                  Proceed anyway
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-5 py-2.5 text-sm font-semibold text-ink-700 dark:text-ink-200 hover:border-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                Discard
              </button>
            </div>
            <p className="mt-4 text-[11px] text-ink-400 dark:text-ink-500">
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
        {!hideRunItAgain && (
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-5 py-3 text-sm font-semibold text-ink-700 dark:text-ink-200 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <RotateCcw className="size-4" /> Run it again
          </button>
        )}
      </div>
    );
    return (
      <div className="space-y-6">
        {/* Owen's note: navigation belongs at the top so users can advance
         *  the moment they've read enough, instead of scrolling. We keep
         *  a copy at the bottom for users who scrolled to the end. */}
        {navButtons}
        <FeedbackPanel
          engineV2={feedbackVariant === "v2"}
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
          repIndex={feedbackRepIndex}
          totalReps={feedbackTotalReps}
          modeLabel={feedbackModeLabel}
          lastRepFocus={feedbackLastRepFocus ?? null}
          onSaveExit={onFeedbackSaveExit}
          modeSignals={
            scoreModeContext
              ? {
                  sessionType: scoreModeContext.sessionType,
                  ...(scoreModeContext.focusDimension
                    ? { focusDimension: scoreModeContext.focusDimension }
                    : {}),
                  ...(scoreModeContext.pressureArchetypeId
                    ? {
                        pressureArchetypeId:
                          scoreModeContext.pressureArchetypeId,
                      }
                    : {}),
                }
              : undefined
          }
        />
        {navButtons}
      </div>
    );
  }

  const isWorking =
    phase.kind === "transcribing" ||
    phase.kind === "scoring" ||
    phase.kind === "scoring-copy" ||
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
        twoColumnLayout ? "max-w-3xl" : "max-w-2xl",
      )}
    >
      {/* Phase 15 P-1 — loud persistence failure. The score below is
          real (it was computed), but nothing about this rep landed in
          the database: no progress, no streak, no XP. */}
      {persistFailed && (
        <div
          role="alert"
          data-testid="rep-persist-failed"
          className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <span className="font-bold">This rep didn&apos;t save.</span> Your
          score is shown, but it won&apos;t count toward progress, streaks,
          or XP. Check your connection — the next rep will try again.
        </div>
      )}

      {/* ——— Focus overlay (retry takes precedence over carryover) ——— */}
      {(retryFocus || carryoverFocus) && phase.kind === "idle" && (
        <FocusOverlay
          callout={(retryFocus ?? carryoverFocus) as Callout}
          label={retryFocus ? "Focus for this retry" : "From your last rep"}
        />
      )}

      {/* ——— W5 (§4.6): "Users should always know what they are trying to
          improve." The full FocusOverlay only renders in idle, so once the
          retry attempt is in flight (transcribing/scoring/scoring-copy/
          saving/processing-async — the isWorking phases) the focus text
          used to vanish. Pin a compact one-line reminder chip above the
          prompt/record area for those phases. Not rendered in idle (the
          overlay covers it) or done. Note: during RecordButton's own
          countdown/recording the phase is still "idle", so the full
          overlay stays visible there. */}
      {retryFocus && isWorking && (
        <div
          data-testid="retry-focus-chip"
          className="flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/5 dark:bg-brand-purple/15 px-3.5 py-2"
        >
          <Target
            className="size-3.5 shrink-0 text-brand-purple dark:text-brand-lavender"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <p className="line-clamp-1 min-w-0 text-xs font-semibold text-brand-purple dark:text-brand-lavender">
            Focus:{" "}
            {retryFocus.body.length > 90
              ? `${retryFocus.body.slice(0, 90).trimEnd()}…`
              : retryFocus.body}
          </p>
        </div>
      )}

      {/* ——— Ch.6a delivery hints — only when focus mode supplies a
          dimension. Mixed/pressure modes hide the strip; they get richer
          framing via the rep type framework already. ——— */}
      {phase.kind === "idle" && scoreModeContext?.focusDimension && (
        <RepHintsBar
          dimension={scoreModeContext.focusDimension}
          seed={sessionId ?? prompt}
        />
      )}

      {/* ——— Daily Workout framework strip (legacy cheat sheet) ———
          Only shown in non-idle Daily Workout phases (error). The idle
          state gets the fuller two-column layout below, which embeds
          the same framework component on the left side. */}
      {mode === "daily_workout" &&
        repTypeFramework &&
        phase.kind === "error" && (
          <RepFrameworkStrip
            framework={repTypeFramework}
            allowNotes
            notesKey={
              muscleGroupDayId && exerciseId
                ? `${muscleGroupDayId}:${exerciseId}`
                : undefined
            }
          />
        )}

      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8 md:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The prompt
          </p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink-900 dark:text-white md:text-4xl">
            {prompt}
          </h2>

          {framework && !frameworkVisible && revealFrameworkAfterMs > 0 && (
            <div className="mt-6 border-t border-ink-200 dark:border-ink-700 pt-5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                <span>Take a moment to read</span>
                <span>
                  Framework in{" "}
                  {Math.ceil(
                    (100 - readingProgress) * (revealFrameworkAfterMs / 100_000),
                  )}
                  s
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div
                  className="brand-gradient h-full rounded-full transition-[width] duration-100"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
            </div>
          )}

          {framework && frameworkVisible && (
            <div className="mt-6 border-t border-ink-200 dark:border-ink-700 pt-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
                <Lightbulb className="size-3.5" />
                Hold this structure · {framework.name}
              </div>
              <ol className="mt-4 space-y-2.5">
                {framework.nodes.map((node, i) => (
                  <li
                    key={node.id}
                    className="flex items-start gap-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50/60 dark:bg-ink-800/60 p-3"
                  >
                    <div className="brand-gradient grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink-900 dark:text-white">
                        {node.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
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
        // Vertical stack — was a 2-col grid that produced unbalanced
        // heights (framework strip ~150px vs gradient card 360px, large
        // empty space on the left). Stack keeps the brand CTA moment
        // ("Speak clearly. Speak confidently.") AND the framework strip
        // in symmetric full-width slots, mobile-clean by default.
        <div className="flex flex-col gap-5">
          <RepFrameworkStrip
            framework={repTypeFramework!}
            allowNotes
            notesKey={
              muscleGroupDayId && exerciseId
                ? `${muscleGroupDayId}:${exerciseId}`
                : undefined
            }
          />
          <div className="brand-gradient relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl px-6 py-8 text-center text-white shadow-[var(--shadow-glow)] sm:px-10">
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-8 size-56 rounded-full bg-brand-magenta/30 blur-3xl"
              aria-hidden="true"
            />
            <p className="relative text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
              Speak clearly. Speak confidently.
            </p>
            <div className="relative">
              <RecordButton
                maxDurationMs={effectiveMaxDurationMs}
                responseWindow={responseWindow}
                onComplete={handleRecordingComplete}
                disabled={isWorking || !frameworkVisible}
                {...(onMidRepPause ? { onPause: onMidRepPause } : {})}
              />
            </div>
            <p className="relative text-xs font-medium text-white/85 drop-shadow-sm">
              3 second countdown then you&rsquo;re live
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 p-10">
          <RecordButton
            maxDurationMs={effectiveMaxDurationMs}
                responseWindow={responseWindow}
            onComplete={handleRecordingComplete}
            disabled={isWorking || !frameworkVisible}
            {...(onMidRepPause ? { onPause: onMidRepPause } : {})}
          />
          {!frameworkVisible && framework && revealFrameworkAfterMs > 0 && (
            <p className="text-xs text-ink-400 dark:text-ink-500">
              Wait for the framework to appear before recording.
            </p>
          )}
        </div>
      )}

      {isWorking && (
        <>
          <div className="surface-card flex items-center justify-center gap-3 p-6 text-sm text-ink-600 dark:text-ink-300">
            <Loader2 className="size-4 animate-spin text-brand-purple" />
            {phase.kind === "transcribing" && "Transcribing your rep…"}
            {phase.kind === "scoring" && "Scoring based on proprietary rubric…"}
            {phase.kind === "scoring-copy" &&
              "Scores in. Writing your detailed feedback…"}
            {phase.kind === "saving" && "Saving your progress…"}
            {phase.kind === "processing-async" &&
              "Scoring in the background. Realtime updates incoming…"}
          </div>
          <LoadingEvidence />
          {(() => {
            // Phase 5 progressive UI — when stage 1 has returned, all 6
            // dim scores are real. Render OptimisticDimensionPreview
            // with stage1Header (composite + tone band) above the grid.
            if (phase.kind === "scoring-copy") {
              return (
                <OptimisticDimensionPreview
                  optimisticDims={phase.stage1.dimensions}
                  stage1Header={{
                    composite: phase.stage1.composite,
                    headlineTone: phase.stage1.headlineTone,
                  }}
                />
              );
            }
            // Phase 2 — when the scoring / async-processing phase carries
            // optimistic deterministic dims, render the partial dimension
            // grid (2 real cards + 4 shimmer) instead of a generic
            // skeleton. The user sees real scores ~immediately on every
            // rep with word timings (the common case) instead of waiting
            // ~5s for the full LLM response.
            const optimisticDims =
              (phase.kind === "scoring" && phase.optimisticDims) ||
              (phase.kind === "processing-async" && phase.optimisticDims) ||
              null;
            if (optimisticDims) {
              return (
                <OptimisticDimensionPreview optimisticDims={optimisticDims} />
              );
            }
            // No word timings (transcription failed / audio-only path):
            // fall back to the generic skeleton.
            if (
              phase.kind === "scoring" ||
              phase.kind === "saving" ||
              phase.kind === "processing-async"
            ) {
              return <FeedbackSkeleton />;
            }
            return null;
          })()}
        </>
      )}

      {phase.kind === "error" && (
        <div className="surface-card p-6">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Recording captured
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
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
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-2 text-xs font-semibold text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600"
          >
            <RotateCcw className="size-3.5" />
            Record again
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Loading-screen evidence card. Owen's note: pure spinners feel dead; while
 * we wait on the model, surface a research-backed insight that primes the
 * user to think about communication. Cycles every ~4s so a slow scoring
 * pass still feels alive without becoming distracting.
 */
const EVIDENCE_TIPS = [
  {
    title: "Working memory is finite.",
    body: "Most people can hold ~4 chunks at once. Strong communicators chunk before they speak.",
  },
  {
    title: "The first 10 seconds set the frame.",
    body: "Audiences calibrate everything that follows to your opening beat.",
  },
  {
    title: "Conciseness is courage.",
    body: "Short sentences signal confidence. Long sentences signal uncertainty.",
  },
  {
    title: "Pauses are punctuation.",
    body: "A purposeful one-second pause raises perceived authority more than any word choice.",
  },
  {
    title: "Land the close with conviction.",
    body: "Statements ending with downward pitch read as authoritative; rising pitch reads as a question — even when you meant a fact.",
  },
] as const;

function LoadingEvidence() {
  const [idx, setIdx] = useState(() =>
    Math.floor(Math.random() * EVIDENCE_TIPS.length),
  );
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % EVIDENCE_TIPS.length),
      4000,
    );
    return () => clearInterval(t);
  }, []);
  const tip = EVIDENCE_TIPS[idx]!;
  return (
    <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-gradient-to-br from-white via-brand-lavender/5 to-brand-magenta/5 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-purple dark:text-brand-lavender">
        While we score
      </p>
      <p className="mt-1.5 text-sm font-semibold text-ink-900 dark:text-white">{tip.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">{tip.body}</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            {label}
          </p>
          <p className="mt-0.5 text-sm font-bold text-ink-900 dark:text-white">
            {callout.title}
          </p>
          {/* PRD §4.6 retry structure: "What change could create the
              biggest improvement?" framing + a Stronger Version line. */}
          <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
            {callout.body}
          </p>
          {callout.suggestedRewrite && (
            <div className="mt-2 rounded-lg bg-ink-50 dark:bg-ink-800 px-3 py-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
                Stronger version
              </p>
              <p className="mt-0.5 text-xs italic leading-relaxed text-ink-700 dark:text-ink-200">
                &ldquo;{callout.suggestedRewrite}&rdquo;
              </p>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-ink-500 dark:text-ink-400">
            What one change creates the biggest improvement? Make THAT the
            rep.
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
        <div className="h-3 w-24 rounded bg-ink-100 dark:bg-ink-800" />
        <div className="mt-2 h-7 w-40 rounded bg-ink-100 dark:bg-ink-800" />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col}>
              <div className="h-2 w-16 rounded bg-ink-100 dark:bg-ink-800" />
              <div className="mt-3 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between">
                      <div className="h-2 w-16 rounded bg-ink-100 dark:bg-ink-800" />
                      <div className="h-2 w-8 rounded bg-ink-100 dark:bg-ink-800" />
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100 dark:bg-ink-800" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-20 w-full rounded-2xl bg-ink-100 dark:bg-ink-800" />
          <div className="h-20 w-full rounded-2xl bg-ink-100 dark:bg-ink-800" />
        </div>
      </div>
    </div>
  );
}
