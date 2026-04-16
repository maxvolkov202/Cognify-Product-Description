"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
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
};

export function RecordButton({
  maxDurationMs = 90_000,
  minDurationMs = 3_000,
  countdownSeconds = 3,
  onComplete,
  disabled,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(countdownSeconds);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<RecordingController | null>(null);
  const animationRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setCountdown(countdownSeconds);
  }, [cleanup, countdownSeconds]);

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
        <div className="text-center">
          <div className="brand-gradient-text text-5xl font-extrabold tabular-nums">
            {formatTime(remainingMs)}
          </div>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            {phase === "finalizing" ? "Processing" : "Recording"}
          </p>
        </div>
      )}

      {phase === "idle" && (
        <p className="text-center text-sm text-ink-500">
          Tap the mic to start. You&rsquo;ll get a 3-second countdown, then you&rsquo;re live.
        </p>
      )}

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

      {isRecording && (
        <button
          type="button"
          onClick={stop}
          className="text-xs font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
        >
          Stop &amp; submit
        </button>
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
