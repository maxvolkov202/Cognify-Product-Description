"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Mic,
  Check,
  Sparkles,
  Flame,
  ArrowRight,
  Trophy,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/**
 * Hero demo: the Daily Workout loop in four steps. Replaces the prior
 * Mode 3 scenario configurator (V2 Updates Edit #1) so the homepage
 * teaches the daily habit, not the vertical practice tool.
 *
 *   Step 1 · Start    — exercise card with prompt
 *   Step 2 · Speak    — recording timer + waveform
 *   Step 3 · Score    — six skills + one improvement
 *   Step 4 · Complete — session score + streak celebration
 */

type Phase = "start" | "recording" | "feedback" | "complete";

const PHASE_MS: Record<Phase, number> = {
  start: 3200,
  recording: 2400,
  feedback: 4400,
  complete: 3800,
};
const PHASE_ORDER: readonly Phase[] = [
  "start",
  "recording",
  "feedback",
  "complete",
] as const;

const DIMENSIONS = [
  { name: "Structure", value: 78 },
  { name: "Clarity", value: 84 },
  { name: "Conciseness", value: 81 },
  { name: "Thinking", value: 72 },
  { name: "Pacing", value: 68 },
  { name: "Tone", value: 79 },
] as const;

export function PracticeLoopMock() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [recTimer, setRecTimer] = useState(30);
  const [feedbackBeat, setFeedbackBeat] = useState(0);

  const phase = PHASE_ORDER[phaseIdx]!;

  useEffect(() => {
    const ms = PHASE_MS[phase];
    const t = setTimeout(() => {
      setPhaseIdx((i) => (i + 1) % PHASE_ORDER.length);
    }, ms);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording") {
      setRecTimer(30);
      return;
    }
    const steps = 16;
    const stepMs = PHASE_MS.recording / steps;
    let current = 30;
    const t = setInterval(() => {
      current = Math.max(0, current - 2);
      setRecTimer(current);
    }, stepMs);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "feedback") {
      setFeedbackBeat(0);
      return;
    }
    const timers = [
      setTimeout(() => setFeedbackBeat(1), 600),
      setTimeout(() => setFeedbackBeat(2), 1500),
      setTimeout(() => setFeedbackBeat(3), 2400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const mascotState = useMemo(() => {
    switch (phase) {
      case "start":
        return { label: "Ready", color: "bg-brand-blue" };
      case "recording":
        return { label: "Listening", color: "bg-brand-magenta" };
      case "feedback":
        return { label: "Scoring", color: "bg-brand-purple" };
      case "complete":
        return { label: "Done", color: "bg-emerald-500" };
    }
  }, [phase]);

  return (
    <figure
      className="relative w-full max-w-md"
      aria-label="A live Cognify Daily Workout rep in progress"
    >
      <figcaption className="mb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
        {phase === "start" && "Step 1 · Start"}
        {phase === "recording" && "Step 2 · Speak"}
        {phase === "feedback" && "Step 3 · Score"}
        {phase === "complete" && "Step 4 · Complete"}
      </figcaption>
      <p
        className="mb-5 ml-auto max-w-[280px] text-right text-xs leading-relaxed text-ink-500 transition-opacity duration-500"
        aria-live="polite"
      >
        {phase === "start" &&
          "Open the app and your first rep is loaded. No setup, no prep."}
        {phase === "recording" &&
          "Speak your answer. The mic captures, a transcript follows."}
        {phase === "feedback" &&
          "Six core skills scored. One focused improvement for the next rep."}
        {phase === "complete" &&
          "Session score, streak, and tomorrow's focus. Build the habit."}
      </p>

      <div className="surface-card relative min-h-[360px] overflow-hidden p-5">
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-1.5">
          <div className="relative">
            <motion.div
              key={phase}
              className={`size-2 rounded-full ${mascotState.color}`}
              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
              transition={{
                duration: phase === "recording" ? 0.6 : 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <div
              className={`absolute inset-0 size-2 rounded-full ${mascotState.color} opacity-40 blur-md`}
              aria-hidden="true"
            />
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
            {mascotState.label}
          </span>
        </div>

        <div className="absolute right-4 top-4 flex gap-1.5">
          {PHASE_ORDER.map((p, i) => (
            <div
              key={p}
              className={
                i === phaseIdx
                  ? "brand-gradient size-1.5 rounded-full"
                  : i < phaseIdx
                    ? "size-1.5 rounded-full bg-brand-purple/40"
                    : "size-1.5 rounded-full bg-ink-200"
              }
            />
          ))}
        </div>

        {/* Step 1 · Start — exercise card with prompt */}
        <div
          className={`absolute inset-0 p-5 pt-12 transition-opacity duration-500 ${
            phase === "start" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
              Rep 1 of 4
            </p>
            <p className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-bold text-brand-blue">
              Clarify Your Point
            </p>
          </div>
          <h3 className="mt-3 text-lg font-extrabold tracking-tight text-ink-900">
            Walk me through Q3 in 30 seconds.
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            Numbers, momentum, what changed. Speak as if to a board member who
            has only read the headline.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 p-3">
            <div className="brand-gradient grid size-8 place-items-center rounded-lg">
              <Target className="size-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Today&rsquo;s focus
              </p>
              <p className="text-xs font-semibold text-ink-900">
                Lead with the headline. Numbers second.
              </p>
            </div>
          </div>
          <motion.div
            className="mt-5"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={
              phase === "start"
                ? { scale: 1, opacity: 1 }
                : { opacity: 0 }
            }
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <div className="brand-gradient inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold text-white shadow-[0_10px_28px_-8px_rgba(151,136,255,0.7)]">
              <Mic className="size-4" />
              Start rep
              <ArrowRight className="size-3.5" strokeWidth={3} />
            </div>
          </motion.div>
        </div>

        {/* Step 2 · Speak — countdown + waveform */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-4 p-5 transition-opacity duration-500 ${
            phase === "recording"
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <div className="brand-gradient-text text-6xl font-extrabold tracking-tight tabular-nums">
            00:{String(recTimer).padStart(2, "0")}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            recording
          </div>
          <div className="relative">
            <div
              className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-brand-magenta/30"
              aria-hidden="true"
            />
            <div className="brand-gradient grid size-16 place-items-center rounded-full shadow-[0_12px_36px_-8px_rgba(151,136,255,0.7)]">
              <Mic className="size-7 text-white" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-1" aria-hidden="true">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="w-1 animate-pulse rounded-full bg-brand-purple/60"
                style={{
                  height: `${10 + ((i * 7 + (30 - recTimer) * 3) % 22)}px`,
                  animationDelay: `${i * 60}ms`,
                  animationDuration: "450ms",
                }}
              />
            ))}
          </div>
        </div>

        {/* Step 3 · Score — feedback screen with one improvement */}
        <div
          className={`absolute inset-0 p-5 pt-12 transition-opacity duration-500 ${
            phase === "feedback"
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Composite
              </div>
              {phase === "feedback" && (
                <motion.div
                  key="score"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 18,
                    delay: 0.1,
                  }}
                  className="brand-gradient-text mt-0.5 text-4xl font-extrabold tabular-nums"
                >
                  77
                </motion.div>
              )}
            </div>
            <AnimatePresence>
              {feedbackBeat >= 1 && (
                <motion.div
                  key="badge"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                >
                  +6 vs last rep
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {DIMENSIONS.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, y: 4 }}
                animate={
                  phase === "feedback" ? { opacity: 1, y: 0 } : { opacity: 0 }
                }
                transition={{ duration: 0.35, delay: 0.2 + i * 0.07 }}
                className="flex items-center gap-2"
              >
                <span className="w-[78px] text-[10px] text-ink-500">
                  {d.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <motion.div
                    className="brand-gradient h-full rounded-full"
                    initial={{ width: "0%" }}
                    animate={
                      phase === "feedback"
                        ? { width: `${d.value}%` }
                        : { width: "0%" }
                    }
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + i * 0.07,
                      ease: "easeOut",
                    }}
                  />
                </div>
                <span className="w-6 text-right text-[10px] font-bold tabular-nums text-ink-700">
                  {d.value}
                </span>
              </motion.div>
            ))}
          </div>
          <AnimatePresence>
            {feedbackBeat >= 2 && (
              <motion.div
                key="improve"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-3 rounded-lg border-l-2 border-brand-purple/40 bg-brand-purple/5 p-2.5 text-[11px] leading-relaxed text-ink-700"
              >
                <div className="flex items-center gap-1.5 text-brand-purple">
                  <Sparkles className="size-3" strokeWidth={3} />
                  <span className="font-semibold">
                    One thing to improve next rep
                  </span>
                </div>
                <p className="mt-1 italic">
                  Open with the result. Lead Q3 with the number, not the
                  context.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Step 4 · Complete — celebration */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 transition-opacity duration-500 ${
            phase === "complete"
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={
              phase === "complete"
                ? { scale: 1, opacity: 1 }
                : { scale: 0.6, opacity: 0 }
            }
            transition={{ type: "spring", stiffness: 280, damping: 16 }}
            className="brand-gradient grid size-16 place-items-center rounded-2xl shadow-[0_18px_44px_-12px_rgba(151,136,255,0.7)]"
          >
            <Trophy className="size-7 text-white" strokeWidth={2.5} />
          </motion.div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
            Workout complete
          </p>
          <p className="brand-gradient-text text-5xl font-extrabold tabular-nums tracking-tight">
            82
          </p>
          <p className="text-xs text-ink-500">
            Session score across 4 reps
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
              <Flame className="size-3" strokeWidth={2.5} />
              7 day streak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <Check className="size-3" strokeWidth={3} />
              4 of 4 reps
            </span>
          </div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Tomorrow&rsquo;s focus · Pacing
          </p>
        </div>
      </div>
    </figure>
  );
}
