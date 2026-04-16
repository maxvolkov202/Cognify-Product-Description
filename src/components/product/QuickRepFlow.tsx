"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { RepSurface } from "./RepSurface";
import type { RepScore } from "@/types/domain";

type Phase =
  | { kind: "intro" }
  | { kind: "recording" }
  | { kind: "done"; score: RepScore; repId: string };

export function QuickRepFlow({ prompt }: { prompt: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });

  if (phase.kind === "intro") {
    return (
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-7">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The prompt
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">
            &ldquo;{prompt}&rdquo;
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-700">
            <li>· 20-second rep — every word has to earn its place.</li>
            <li>· Scored live across six dimensions — clarity, structure, relevance, confidence, pacing, tone.</li>
            <li>· No signup. No email. Mic only.</li>
          </ul>
          <button
            type="button"
            onClick={() => setPhase({ kind: "recording" })}
            className="brand-gradient mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
          >
            Start recording
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "recording") {
    return (
      <RepSurface
        prompt={prompt}
        mode="scenario_training"
        topic="Quick Rep"
        maxDurationMs={20_000}
        onComplete={({ score, repId }) => {
          setPhase({ kind: "done", score, repId });
        }}
      />
    );
  }

  // phase === "done"
  return (
    <div className="space-y-6">
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8 text-center">
          <Sparkles
            className="mx-auto size-8 text-brand-purple"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
            That&rsquo;s one rep.
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            Here&rsquo;s your composite score across all six dimensions.
          </p>
          <p className="brand-gradient-text mt-6 text-7xl font-extrabold tabular-nums">
            {phase.score.composite}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Quick Rep composite
          </p>

          <div className="mt-6 grid gap-2 rounded-xl bg-ink-50/60 p-4 text-left text-sm md:grid-cols-3">
            {phase.score.dimensions.slice(0, 3).map((d) => (
              <div key={d.dimension}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {d.dimension}
                </p>
                <p className="mt-0.5 font-bold tabular-nums text-ink-900">
                  {d.score}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-7">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            A workout is four of these
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-ink-900">
            Sign up free to keep training.
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
            <li>· Daily Workout — 4 reps, 10 minutes</li>
            <li>· Your reps saved, compared, trended over time</li>
            <li>· Head-to-head challenges with friends</li>
            <li>· A baseline and monthly report card</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/signin"
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
            >
              Sign up free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
