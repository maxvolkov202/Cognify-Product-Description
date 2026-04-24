"use client";

import { useEffect, useState } from "react";
import { Mic, Check, Sparkles } from "lucide-react";

const audienceOptions = ["Executive", "Team", "Client", "Stakeholder"] as const;
const frameworkNodes = ["Context", "Decision", "Impact"] as const;
const timeOptions = ["30s", "60s", "90s"] as const;

type Phase = "setup" | "recording" | "scoring" | "feedback";

// Phase durations in ms. Tweak for pacing.
const PHASE_MS: Record<Phase, number> = {
  setup: 3500,
  recording: 4500,
  scoring: 2000,
  feedback: 4500,
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

/**
 * Animated hero mock. Self-contained cycle through four phases that
 * mirror the real rep flow:
 *   setup → recording → scoring → feedback → (loop)
 *
 * No external assets — everything is Tailwind + React state so it
 * stays consistent with the rest of the site's visual language.
 */
export function PracticeLoopMock() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [audienceIdx, setAudienceIdx] = useState(1); // "Team" by default
  const [recTimer, setRecTimer] = useState(60);

  const phase = PHASE_ORDER[phaseIdx]!;

  // Phase rotation
  useEffect(() => {
    const ms = PHASE_MS[phase];
    const t = setTimeout(() => {
      setPhaseIdx((i) => (i + 1) % PHASE_ORDER.length);
    }, ms);
    return () => clearTimeout(t);
  }, [phase]);

  // Audience pill rotation during setup
  useEffect(() => {
    if (phase !== "setup") return;
    const t = setInterval(() => {
      setAudienceIdx((i) => (i + 1) % audienceOptions.length);
    }, 900);
    return () => clearInterval(t);
  }, [phase]);

  // Recording timer — compresses 60→0 into the recording phase duration
  useEffect(() => {
    if (phase !== "recording") {
      setRecTimer(60);
      return;
    }
    const steps = 30;
    const stepMs = PHASE_MS.recording / steps;
    let current = 60;
    const t = setInterval(() => {
      current = Math.max(0, current - 2);
      setRecTimer(current);
    }, stepMs);
    return () => clearInterval(t);
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

        {/* Setup */}
        <div
          className={`absolute inset-0 p-5 transition-opacity duration-500 ${
            phase === "setup" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="space-y-3.5">
            <div>
              <Label>Scenario</Label>
              <div className="mt-1.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm font-semibold text-ink-900">
                Explain a technical decision
              </div>
            </div>
            <div>
              <Label>Audience</Label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {audienceOptions.map((option, i) => (
                  <Pill key={option} active={i === audienceIdx}>
                    {option}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <Label>Framework</Label>
              <div className="mt-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-800">
                Context → Decision → Impact
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {frameworkNodes.map((node) => (
                  <div
                    key={node}
                    className="rounded-md border border-ink-200 bg-white px-2 py-1 text-center text-[11px] font-medium text-ink-600"
                  >
                    {node}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Time</Label>
              <div className="mt-1.5 flex gap-1.5">
                {timeOptions.map((t, i) => (
                  <Pill key={t} active={i === 1}>
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
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
                  animationDuration: "650ms",
                }}
              />
            ))}
          </div>
        </div>

        {/* Scoring */}
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
            {DIMENSIONS.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-20 text-[10px] uppercase tracking-wider text-ink-400">
                  {d.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full animate-pulse rounded-full bg-brand-purple/40"
                    style={{
                      width: "60%",
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div
          className={`absolute inset-0 p-5 transition-opacity duration-500 ${
            phase === "feedback" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Composite
              </div>
              <div className="brand-gradient-text mt-0.5 text-4xl font-extrabold tabular-nums">
                77
              </div>
            </div>
            <div className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              +6 vs last rep
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {DIMENSIONS.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center gap-2"
                style={{
                  opacity: 0,
                  animation: `cognify-fadein 400ms ease-out ${i * 80}ms forwards`,
                }}
              >
                <span className="w-[70px] text-[10px] text-ink-500">
                  {d.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="brand-gradient h-full rounded-full"
                    style={{
                      width: `${d.value}%`,
                      animation: `cognify-grow 600ms ease-out ${i * 80}ms both`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-[10px] font-bold tabular-nums text-ink-700">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-3 rounded-lg border-l-2 border-emerald-300 bg-emerald-50/60 p-2.5 text-[11px] leading-relaxed text-ink-700"
            style={{
              opacity: 0,
              animation: "cognify-fadein 400ms ease-out 700ms forwards",
            }}
          >
            <div className="flex items-center gap-1.5 text-emerald-800">
              <Check className="size-3" strokeWidth={3} />
              <span className="font-semibold">What you nailed</span>
            </div>
            <p className="mt-1 italic">
              &ldquo;The tradeoff is real: latency for cost.&rdquo;
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes cognify-fadein {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes cognify-grow {
          from {
            width: 0%;
          }
        }
      `}</style>
    </figure>
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
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={
        active
          ? "brand-gradient rounded-md px-2 py-1.5 text-center text-[11px] font-semibold text-white transition-all"
          : "rounded-md border border-ink-200 bg-white px-2 py-1.5 text-center text-[11px] font-medium text-ink-600 transition-all"
      }
    >
      {children}
    </div>
  );
}
