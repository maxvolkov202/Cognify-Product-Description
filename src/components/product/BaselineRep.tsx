"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { markBaselineRepAction } from "@/server/actions/baseline";
import type { RepScore } from "@/types/domain";

const BASELINE_PROMPT =
  "Tell us about yourself in 60 seconds — who you are, what you do, and one thing you want to get better at saying.";

type Phase =
  | { kind: "intro" }
  | { kind: "recording" }
  | { kind: "saving-baseline" }
  | { kind: "done"; score: RepScore };

export function BaselineRep() {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (phase.kind === "intro") {
    return (
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8">
          <div className="flex items-start gap-3">
            <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
              <Sparkles
                className="size-5 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                The prompt
              </p>
              <p className="mt-1 text-lg font-bold text-ink-900">
                &ldquo;{BASELINE_PROMPT}&rdquo;
              </p>
              <p className="mt-2 text-sm text-ink-600">
                No retries, no pressure. This rep is just a baseline — it tells
                us and you where you&rsquo;re starting.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-2 rounded-xl bg-ink-50/60 p-4 text-sm text-ink-700 md:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Duration
              </p>
              <p className="mt-0.5 font-bold">60 seconds</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Scored across
              </p>
              <p className="mt-0.5 font-bold">All 6 dimensions</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Becomes your
              </p>
              <p className="mt-0.5 font-bold">Baseline</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase({ kind: "recording" })}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
            >
              Record my baseline
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/tutorial")}
              className="text-sm font-semibold text-ink-500 hover:text-ink-900"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "recording" || phase.kind === "saving-baseline") {
    return (
      <>
        <RepSurface
          prompt={BASELINE_PROMPT}
          mode="scenario_training"
          topic="Baseline"
          maxDurationMs={60_000}
          onComplete={({ score, repId }) => {
            setPhase({ kind: "saving-baseline" });
            setError(null);
            startTransition(async () => {
              const result = await markBaselineRepAction(repId);
              if (!result.ok) {
                setError(
                  "Couldn't save your baseline. You can continue to the tutorial — the rep is still yours.",
                );
              }
              setPhase({ kind: "done", score });
            });
          }}
        />
        {phase.kind === "saving-baseline" && (
          <p className="mt-3 text-center text-sm text-ink-500">
            Locking in your baseline…
          </p>
        )}
        {error && (
          <p className="mt-3 text-center text-sm text-danger">{error}</p>
        )}
      </>
    );
  }

  // phase === "done"
  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-8 text-center">
        <Sparkles
          className="mx-auto size-8 text-brand-purple"
          aria-hidden="true"
        />
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
          Here&rsquo;s where you&rsquo;re starting.
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          Your baseline composite score — the number to beat.
        </p>
        <p className="brand-gradient-text mt-6 text-7xl font-extrabold tabular-nums">
          {phase.score.composite}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Baseline composite
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => router.push("/tutorial")}
            className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
          >
            Continue to tutorial
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-semibold text-ink-500 hover:text-ink-900"
          >
            Skip tutorial, go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
