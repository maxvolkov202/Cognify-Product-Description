"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic, Check, Sparkles, Flame } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const scenarioOptions = [
  "Explain a technical decision",
  "Defend your roadmap",
  "Walk me through the tradeoffs",
] as const;
const audienceOptions = ["Executive", "Team", "Client", "Stakeholder"] as const;
const frameworkNodes = ["Context", "Decision", "Impact"] as const;
const timeOptions = ["30s", "60s", "90s"] as const;

type Phase = "setup" | "recording" | "scoring" | "feedback";

// Phase durations in ms. Setup needs room for the 4-step sweep, countdown
// trims tight, feedback extends to accommodate the staggered choreography.
const PHASE_MS: Record<Phase, number> = {
  setup: 4200,
  recording: 1800,
  scoring: 2400,
  feedback: 5200,
};
const PHASE_ORDER: readonly Phase[] = [
  "setup",
  "recording",
  "scoring",
  "feedback",
] as const;

const DIMENSIONS = [
  { name: "Clarity", value: 84 },
  { name: "Structure", value: 78 },
  { name: "Conciseness", value: 81 },
  { name: "Thinking", value: 72 },
  { name: "Delivery", value: 68 },
  { name: "Adaptability", value: 79 },
] as const;

// Sweep targets: which index gets picked in each row of the setup slide.
const SWEEP = {
  scenario: 0,
  audience: 2, // "Client"
  framework: 1, // "Decision"
  time: 1, // "60s"
} as const;

// Timings for the setup sweep (ms into phase).
const SWEEP_AT = {
  scenario: 350,
  audience: 1100,
  framework: 1900,
  time: 2700,
} as const;

export function PracticeLoopMock() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [recTimer, setRecTimer] = useState(60);
  const [picked, setPicked] = useState<{
    scenario: boolean;
    audience: boolean;
    framework: boolean;
    time: boolean;
  }>({ scenario: false, audience: false, framework: false, time: false });
  const [feedbackBeat, setFeedbackBeat] = useState(0);
  const [tickedDim, setTickedDim] = useState(false);

  const phase = PHASE_ORDER[phaseIdx]!;

  // Phase rotation
  useEffect(() => {
    const ms = PHASE_MS[phase];
    const t = setTimeout(() => {
      setPhaseIdx((i) => (i + 1) % PHASE_ORDER.length);
    }, ms);
    return () => clearTimeout(t);
  }, [phase]);

  // Setup sweep: reveal picks one row at a time.
  useEffect(() => {
    if (phase !== "setup") {
      setPicked({ scenario: false, audience: false, framework: false, time: false });
      return;
    }
    const timers = [
      setTimeout(() => setPicked((p) => ({ ...p, scenario: true })), SWEEP_AT.scenario),
      setTimeout(() => setPicked((p) => ({ ...p, audience: true })), SWEEP_AT.audience),
      setTimeout(() => setPicked((p) => ({ ...p, framework: true })), SWEEP_AT.framework),
      setTimeout(() => setPicked((p) => ({ ...p, time: true })), SWEEP_AT.time),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Recording countdown tuned to the shorter phase duration.
  useEffect(() => {
    if (phase !== "recording") {
      setRecTimer(60);
      return;
    }
    const steps = 20;
    const stepMs = PHASE_MS.recording / steps;
    let current = 60;
    const t = setInterval(() => {
      current = Math.max(0, current - 3);
      setRecTimer(current);
    }, stepMs);
    return () => clearInterval(t);
  }, [phase]);

  // Feedback choreography: score lands → badge → callout bullets → dim tick.
  useEffect(() => {
    if (phase !== "feedback") {
      setFeedbackBeat(0);
      setTickedDim(false);
      return;
    }
    const timers = [
      setTimeout(() => setFeedbackBeat(1), 600), // badge in
      setTimeout(() => setFeedbackBeat(2), 1400), // callout line 1
      setTimeout(() => setFeedbackBeat(3), 2000), // callout line 2
      setTimeout(() => setFeedbackBeat(4), 2600), // callout line 3
      setTimeout(() => setTickedDim(true), 3800), // dim ticks +1
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const mascotState = useMemo(() => {
    switch (phase) {
      case "setup":
        return { label: "Thinking", color: "bg-brand-blue" };
      case "recording":
        return { label: "Listening", color: "bg-brand-magenta" };
      case "scoring":
        return { label: "Analyzing", color: "bg-brand-purple" };
      case "feedback":
        return { label: "Done", color: "bg-emerald-500" };
    }
  }, [phase]);

  return (
    <figure className="relative w-full max-w-md" aria-label="A live Cognify rep in progress">
      <figcaption className="mb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
        {phase === "setup" && "Step 1 · Configure"}
        {phase === "recording" && "Step 2 · Speak"}
        {phase === "scoring" && "Step 3 · Score"}
        {phase === "feedback" && "Step 4 · Review"}
      </figcaption>
      <p
        className="mb-5 ml-auto max-w-[280px] text-right text-xs leading-relaxed text-ink-500 transition-opacity duration-500"
        aria-live="polite"
      >
        {phase === "setup" &&
          "Pick your audience, framework, and time. Every rep is intentional."}
        {phase === "recording" &&
          "Speak your answer. The mic captures, a transcript follows."}
        {phase === "scoring" &&
          "Six dimensions scored against a proprietary, research-grounded rubric."}
        {phase === "feedback" &&
          "Transcript-anchored callouts show exactly what to tighten next rep."}
      </p>

      <div className="surface-card relative min-h-[340px] overflow-hidden p-5">
        {/* Mascot — reads "the app is paying attention" without stealing focus */}
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

        {/* Phase progress dots */}
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

        {/* Setup — compact form that fills out one field at a time */}
        <div
          className={`absolute inset-0 p-5 pt-10 transition-opacity duration-500 ${
            phase === "setup" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="space-y-3.5">
            <SweepRow label="Scenario">
              <div
                className={`mt-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-all ${
                  picked.scenario
                    ? "border-brand-purple/40 bg-brand-purple/5 text-ink-900"
                    : "border-ink-200 bg-ink-50 text-ink-400"
                }`}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={picked.scenario ? "picked" : "placeholder"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="block"
                  >
                    {picked.scenario
                      ? scenarioOptions[SWEEP.scenario]
                      : "Pick a scenario…"}
                  </motion.span>
                </AnimatePresence>
              </div>
            </SweepRow>
            <SweepRow label="Audience">
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {audienceOptions.map((option, i) => (
                  <Pill
                    key={option}
                    active={picked.audience && i === SWEEP.audience}
                    dimmed={picked.audience && i !== SWEEP.audience}
                  >
                    {option}
                  </Pill>
                ))}
              </div>
            </SweepRow>
            <SweepRow label="Framework">
              <div
                className={`mt-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all ${
                  picked.framework
                    ? "border-brand-purple/40 bg-brand-purple/5 text-ink-900"
                    : "border-ink-200 bg-ink-50 text-ink-400"
                }`}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={picked.framework ? "picked" : "placeholder"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    {picked.framework ? (
                      <>
                        {frameworkNodes.map((n, i) => (
                          <span key={n} className="flex items-center gap-2">
                            <span
                              className={
                                i === SWEEP.framework
                                  ? "text-ink-900"
                                  : "text-ink-500"
                              }
                            >
                              {n}
                            </span>
                            {i < frameworkNodes.length - 1 && (
                              <span className="text-ink-300">→</span>
                            )}
                          </span>
                        ))}
                      </>
                    ) : (
                      "Pick a framework…"
                    )}
                  </motion.span>
                </AnimatePresence>
              </div>
            </SweepRow>
            <SweepRow label="Time">
              <div className="mt-1.5 flex gap-1.5">
                {timeOptions.map((t, i) => (
                  <Pill
                    key={t}
                    active={picked.time && i === SWEEP.time}
                    dimmed={picked.time && i !== SWEEP.time}
                  >
                    {t}
                  </Pill>
                ))}
              </div>
            </SweepRow>
          </div>
        </div>

        {/* Recording */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-4 p-5 transition-opacity duration-500 ${
            phase === "recording" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="brand-gradient-text text-6xl font-extrabold tracking-tight tabular-nums">
            {String(Math.floor(recTimer / 60)).padStart(2, "0")}:
            {String(recTimer % 60).padStart(2, "0")}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            {recTimer}s · recording
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
                  height: `${10 + ((i * 7 + (60 - recTimer) * 3) % 22)}px`,
                  animationDelay: `${i * 60}ms`,
                  animationDuration: "450ms",
                }}
              />
            ))}
          </div>
        </div>

        {/* Scoring — bars slide up from 0 to varied heights with overshoot */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-5 p-5 transition-opacity duration-500 ${
            phase === "scoring" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
            <Sparkles className="size-4 animate-pulse text-brand-purple" />
            Scoring based on proprietary rubric…
          </div>
          <div className="w-full max-w-[260px] space-y-2">
            {DIMENSIONS.map((d, i) => {
              const target = d.value;
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-20 text-[10px] uppercase tracking-wider text-ink-400">
                    {d.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <motion.div
                      key={`${phase}-${i}`}
                      className="brand-gradient h-full rounded-full"
                      initial={{ width: "0%" }}
                      animate={
                        phase === "scoring"
                          ? { width: [`0%`, `${Math.min(target + 6, 100)}%`, `${target}%`] }
                          : { width: "0%" }
                      }
                      transition={{
                        duration: 1.1,
                        times: [0, 0.7, 1],
                        delay: i * 0.08,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[10px] font-bold tabular-nums text-ink-500">
                    {target}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback */}
        <div
          className={`absolute inset-0 p-5 transition-opacity duration-500 ${
            phase === "feedback" ? "opacity-100" : "pointer-events-none opacity-0"
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
                  transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
                  className="brand-gradient-text mt-0.5 text-4xl font-extrabold tabular-nums"
                >
                  77
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <AnimatePresence>
                {feedbackBeat >= 1 && (
                  <motion.div
                    key="streak"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 16 }}
                    className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700"
                  >
                    <Flame className="size-3" strokeWidth={2.5} />
                    Day 7
                  </motion.div>
                )}
              </AnimatePresence>
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
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {DIMENSIONS.map((d, i) => {
              const ticked = tickedDim && i === 4; // bump Delivery (the weakest)
              const displayed = ticked ? d.value + 1 : d.value;
              const width = ticked ? Math.min(d.value + 1, 100) : d.value;
              return (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={phase === "feedback" ? { opacity: 1, y: 0 } : { opacity: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-2"
                >
                  <span className="w-[70px] text-[10px] text-ink-500">{d.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <motion.div
                      className="brand-gradient h-full rounded-full"
                      initial={{ width: "0%" }}
                      animate={
                        phase === "feedback"
                          ? { width: `${width}%` }
                          : { width: "0%" }
                      }
                      transition={{ duration: 0.5, delay: 0.3 + i * 0.07, ease: "easeOut" }}
                    />
                  </div>
                  <motion.span
                    animate={ticked ? { scale: [1, 1.3, 1], color: ["#4B5563", "#059669", "#374151"] } : {}}
                    transition={{ duration: 0.5 }}
                    className="w-6 text-right text-[10px] font-bold tabular-nums text-ink-700"
                  >
                    {displayed}
                  </motion.span>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg border-l-2 border-emerald-300 bg-emerald-50/60 p-2.5 text-[11px] leading-relaxed text-ink-700">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <Check className="size-3" strokeWidth={3} />
              <span className="font-semibold">What you nailed</span>
            </div>
            <div className="mt-1 space-y-0.5 italic">
              <AnimatePresence>
                {feedbackBeat >= 2 && (
                  <motion.p
                    key="l1"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    &ldquo;The tradeoff is real: latency for cost.&rdquo;
                  </motion.p>
                )}
                {feedbackBeat >= 3 && (
                  <motion.p
                    key="l2"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-ink-500 not-italic"
                  >
                    Clear decision frame. Concrete number.
                  </motion.p>
                )}
                {feedbackBeat >= 4 && (
                  <motion.p
                    key="l3"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-ink-500 not-italic"
                  >
                    Try next: tighten the opener by one beat.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function SweepRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
      {children}
    </div>
  );
}

function Pill({
  children,
  active,
  dimmed,
}: {
  children: React.ReactNode;
  active?: boolean;
  dimmed?: boolean;
}) {
  return (
    <motion.div
      animate={{ opacity: dimmed ? 0.35 : 1 }}
      transition={{ duration: 0.25 }}
      className={
        active
          ? "brand-gradient rounded-md px-2 py-1.5 text-center text-[11px] font-semibold text-white transition-all"
          : "rounded-md border border-ink-200 bg-white px-2 py-1.5 text-center text-[11px] font-medium text-ink-600 transition-all"
      }
    >
      {children}
    </motion.div>
  );
}
