"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { markBaselineRepAction } from "@/server/actions/baseline";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
  type RepScore,
  type SkillDimension,
} from "@/types/domain";

const BASELINE_PROMPT =
  "I am a hiring manager for your next role. In 60 seconds, tell me why I should hire you.";

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
  // Show all six dimension scores + the lead callout so the user can
  // review before the tutorial. Previous flow disposed of the feedback
  // panel too quickly to read.
  const dims: SkillDimension[] = [
    ...SKILL_DIMENSION_GROUPS.content,
    ...SKILL_DIMENSION_GROUPS.delivery,
  ];
  const leadCallout =
    phase.score.callouts.find(
      (c) => c.tone === "warn" || c.tone === "critical",
    ) ?? phase.score.callouts[0] ?? null;
  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-8">
        <div className="text-center">
          <Sparkles
            className="mx-auto size-8 text-brand-purple"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
            Here&rsquo;s where you&rsquo;re starting.
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            Your baseline composite. The number every future rep gets measured against.
          </p>
          <p className="brand-gradient-text mt-6 text-7xl font-extrabold tabular-nums">
            {Math.round(phase.score.composite)}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Baseline composite
          </p>
        </div>

        <div className="mt-8 grid gap-2.5">
          {dims.map((dim) => {
            const entry = phase.score.dimensions.find(
              (d) => d.dimension === dim,
            );
            const score = entry ? Math.round(entry.score) : null;
            const isContent = (
              SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
            ).includes(dim);
            return (
              <div key={dim} className="flex items-center gap-3">
                <span
                  className={
                    isContent
                      ? "size-1.5 shrink-0 rounded-full bg-brand-blue"
                      : "size-1.5 shrink-0 rounded-full bg-brand-magenta"
                  }
                  aria-hidden="true"
                />
                <span className="w-32 text-sm font-semibold text-ink-700">
                  {DIMENSION_LABELS[dim]}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="brand-gradient h-full rounded-full"
                    style={{ width: `${score ?? 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-bold tabular-nums text-ink-700">
                  {score ?? "—"}
                </span>
              </div>
            );
          })}
        </div>

        {leadCallout && (
          <div className="mt-6 rounded-xl border-l-2 border-brand-purple/40 bg-brand-purple/5 p-4">
            <div className="flex items-center gap-1.5 text-brand-purple">
              <Sparkles className="size-3.5" strokeWidth={2.5} />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                What to focus on first
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-ink-900">
              {leadCallout.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {leadCallout.body}
            </p>
          </div>
        )}

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
