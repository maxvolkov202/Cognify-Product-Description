"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Pause as PauseIcon, Play as PlayIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  startRecording,
  prewarmMicrophone,
  type RecordingController,
  type RecordingResult,
} from "@/lib/audio/capture";

type Phase = "idle" | "priming" | "countdown" | "recording" | "finalizing" | "done" | "error";

type Props = {
  maxDurationMs?: number;
  minDurationMs?: number;
  countdownSeconds?: number;
  onComplete: (result: RecordingResult) => void;
  disabled?: boolean;
  /** When provided, enables the 3-tile Redo/Pause/Submit action row
   *  during recording (mockup #4). `onPause` is called after the
   *  recording is cancelled — typically the caller then navigates away
   *  to let the user resume the workout later. Redo + Submit are
   *  handled internally. */
  onPause?: () => void;
};

export function RecordButton({
  maxDurationMs = 90_000,
  minDurationMs = 3_000,
  countdownSeconds = 3,
  onComplete,
  disabled,
  onPause,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(countdownSeconds);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const controllerRef = useRef<RecordingController | null>(null);
  const animationRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the timeout handle for the auto-stop max-duration guard so
  // we can cancel it on pause and restart on resume — the guard must
  // only run against active recording time, not wall-clock.
  const maxStopMsRemainingRef = useRef<number | null>(null);
  const maxStopAnchorRef = useRef<number | null>(null);

  const remainingMs = Math.max(0, maxDurationMs - elapsedMs);

  const cleanup = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    animationRef.current = null;
    countdownTimerRef.current = null;
    maxDurationTimerRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Pre-warm the microphone on mount so the first tap of record starts
  // capturing instantly. If permission isn't granted yet, this surfaces
  // the browser prompt proactively rather than mid-countdown.
  useEffect(() => {
    prewarmMicrophone().catch(() => {});
  }, []);

  const tick = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    setElapsedMs(controller.getElapsedMs());
    setLevel(controller.getLevel());
    animationRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(async () => {
    if (!controllerRef.current) return;
    setPhase("finalizing");
    cleanup();
    try {
      const result = await controllerRef.current.stop();
      controllerRef.current = null;
      if (result.durationMs < minDurationMs) {
        setError("That was too short. Hold the button longer and try again.");
        setPhase("error");
        return;
      }
      setPhase("done");
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed.");
      setPhase("error");
    }
  }, [cleanup, minDurationMs, onComplete]);

  const start = useCallback(async () => {
    setError(null);
    setPhase("priming");
    try {
      const controller = await startRecording();
      controllerRef.current = controller;

      setPhase("countdown");
      setCountdown(countdownSeconds);
      let remaining = countdownSeconds;
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setPhase("recording");
          animationRef.current = requestAnimationFrame(tick);
          maxStopMsRemainingRef.current = maxDurationMs;
          maxStopAnchorRef.current = performance.now();
          maxDurationTimerRef.current = setTimeout(stop, maxDurationMs);
        }
      }, 1000);
    } catch (err) {
      const isPermissionDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      if (isPermissionDenied) {
        setError(
          "Cognify needs mic access. Click the 🔒 icon in your browser's address bar → Microphone → Allow, then reload this page.",
        );
      } else {
        setError(
          err instanceof Error
            ? `${err.message}. Try reloading the page — and make sure no other tab has your mic open.`
            : "Could not access microphone.",
        );
      }
      setPhase("error");
    }
  }, [countdownSeconds, maxDurationMs, stop, tick]);

  const reset = useCallback(() => {
    cleanup();
    if (controllerRef.current) {
      controllerRef.current.cancel();
      controllerRef.current = null;
    }
    setPhase("idle");
    setElapsedMs(0);
    setLevel(0);
    setError(null);
    setIsPaused(false);
    setCountdown(countdownSeconds);
    maxStopMsRemainingRef.current = null;
    maxStopAnchorRef.current = null;
  }, [cleanup, countdownSeconds]);

  const togglePause = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (isPaused) {
      controller.resume();
      setIsPaused(false);
      animationRef.current = requestAnimationFrame(tick);
      // Restart the max-duration guard with the remaining time budget.
      const remaining = maxStopMsRemainingRef.current;
      if (remaining !== null && remaining > 0) {
        maxStopAnchorRef.current = performance.now();
        maxDurationTimerRef.current = setTimeout(stop, remaining);
      }
    } else {
      controller.pause();
      setIsPaused(true);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = null;
        // Consume whatever portion of the budget we've used up so far.
        if (maxStopAnchorRef.current !== null && maxStopMsRemainingRef.current !== null) {
          const used = performance.now() - maxStopAnchorRef.current;
          maxStopMsRemainingRef.current = Math.max(
            0,
            maxStopMsRemainingRef.current - used,
          );
        }
      }
      setLevel(0);
    }
  }, [isPaused, stop, tick]);

  const isRecording = phase === "recording";
  const scale = 1 + Math.min(level * 2, 0.5);

  return (
    <div className="flex flex-col items-center gap-4">
      {phase === "countdown" && (
        <div className="text-center">
          <div className="brand-gradient-text text-6xl font-extrabold tabular-nums">
            {countdown}
          </div>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-500">
            Get ready
          </p>
        </div>
      )}

      {(isRecording || phase === "finalizing") && (
        <div className="w-full max-w-sm text-center">
          {isRecording && (
            <div className="mb-3 flex justify-center">
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white shadow-sm",
                  isPaused ? "bg-ink-500" : "bg-rose-600",
                )}
              >
                <span className="relative grid size-2 place-items-center">
                  <span
                    className={cn(
                      "absolute size-2 rounded-full bg-white",
                      !isPaused &&
                        "motion-safe:animate-ping motion-reduce:animate-none",
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className="size-1.5 rounded-full bg-white"
                    aria-hidden="true"
                  />
                </span>
                {isPaused ? "Paused" : "Recording"}
              </span>
            </div>
          )}
          <div className="brand-gradient-text text-5xl font-extrabold tabular-nums">
            {formatTime(remainingMs)}
          </div>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            {phase === "finalizing"
              ? "Processing"
              : isPaused
                ? "Paused — tap Resume"
                : "Recording"}
          </p>
          {isRecording && (
            <div
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
              role="progressbar"
              aria-valuenow={Math.round((elapsedMs / maxDurationMs) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Rep time elapsed"
            >
              <div
                className={cn(
                  "h-full transition-[width,background-color] duration-100 ease-linear",
                  elapsedMs / maxDurationMs < 0.6
                    ? "bg-emerald-400"
                    : elapsedMs / maxDurationMs < 0.85
                      ? "bg-amber-400"
                      : "bg-rose-500",
                )}
                style={{
                  width: `${Math.min(100, (elapsedMs / maxDurationMs) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {phase === "idle" && (
        <div className="text-center">
          <p className="text-sm text-ink-500">
            Tap the mic to start. You&rsquo;ll get a 3-second countdown, then you&rsquo;re live.
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-ink-400">
            Stand if you can. Use your hands. Treat this rep like the real moment.
          </p>
        </div>
      )}

      {/* Pre-record: the big mic button kicks off the flow. Hidden
          during active recording when the 3-tile action row is shown
          (onPause provided) — the tiles replace both the mic button
          AND the "Stop & submit" link. */}
      {(!isRecording || !onPause) && (
        <button
          type="button"
          onClick={phase === "idle" || phase === "error" ? start : isRecording ? stop : undefined}
          disabled={disabled || phase === "priming" || phase === "finalizing" || phase === "countdown"}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          className={cn(
            "relative grid place-items-center rounded-full text-white transition-all",
            "size-24 md:size-28",
            "brand-gradient shadow-[0_20px_60px_-20px_rgba(151,136,255,0.8)]",
            "hover:shadow-[0_24px_72px_-16px_rgba(151,136,255,0.95)]",
            "disabled:opacity-70 disabled:shadow-none",
            isRecording && "ring-4 ring-brand-magenta/40",
          )}
          style={isRecording ? { transform: `scale(${scale})` } : undefined}
        >
          {isRecording ? <Square className="size-9 fill-white" /> : <Mic className="size-10" />}
          {isRecording && (
            <span
              className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-brand-magenta/40"
              aria-hidden="true"
            />
          )}
        </button>
      )}

      {isRecording && !onPause && (
        <button
          type="button"
          onClick={stop}
          className="text-xs font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
        >
          Stop &amp; submit
        </button>
      )}

      {/* 3-tile action row — mockup #4. Only rendered when onPause is
          provided, which is how callers (Daily Workout RepSurface) opt
          into the mockup-style UX. Build-a-Rep + /try stay on the
          classic single-mic UX until they explicitly opt in.
          Pause tile now halts MediaRecorder in-place (not navigation) —
          tap again to resume. The onPause callback is still fired on the
          first tap so callers can persist intermediate state. */}
      {isRecording && onPause && (
        <div
          className="grid w-full max-w-md grid-cols-3 gap-2"
          role="group"
          aria-label="Recording actions"
        >
          <ActionTile
            icon={<RotateCcw className="size-5" strokeWidth={2.5} />}
            label="Redo"
            subLabel="Start over"
            onClick={() => {
              // Redo: drop audio + reset to idle so the user can tap
              // the record button again for a fresh take.
              reset();
            }}
          />
          <ActionTile
            icon={
              isPaused ? (
                <PlayIcon className="size-5" strokeWidth={2.5} />
              ) : (
                <PauseIcon className="size-5" strokeWidth={2.5} />
              )
            }
            label={isPaused ? "Resume" : "Pause"}
            subLabel={isPaused ? "Pick it back up" : "Hold your place"}
            onClick={togglePause}
          />
          <ActionTile
            icon={<Check className="size-5" strokeWidth={2.5} />}
            label="Submit"
            subLabel="Get feedback"
            primary
            onClick={stop}
          />
        </div>
      )}

      {phase === "error" && (
        <div className="text-center">
          <p className="text-sm font-medium text-danger">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs font-semibold text-brand-purple hover:text-brand-magenta"
          >
            Try again
          </button>
        </div>
      )}

      {phase === "priming" && (
        <p className="text-sm text-ink-500">Requesting microphone…</p>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * One of the three recording action tiles (mockup #4 Redo / Pause /
 * Submit). Primary variant gets the brand gradient; others use a
 * subtle translucent surface so the row reads as a coherent group.
 */
function ActionTile({
  icon,
  label,
  subLabel,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-4 text-center transition",
        primary
          ? "brand-gradient text-white shadow-[0_10px_30px_-10px_rgba(151,136,255,0.8)] hover:shadow-[0_14px_40px_-10px_rgba(151,136,255,0.95)]"
          : "border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50",
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="mt-0.5 text-sm font-extrabold">{label}</span>
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          primary ? "text-white/85" : "text-ink-500",
        )}
      >
        {subLabel}
      </span>
    </button>
  );
}
