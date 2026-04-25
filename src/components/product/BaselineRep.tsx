"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { markBaselineRepAction } from "@/server/actions/baseline";

const BASELINE_PROMPT =
  "I am a hiring manager for your next role. In 60 seconds, tell me why I should hire you.";

type Phase =
  | { kind: "intro" }
  | { kind: "recording" };

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

  // Recording → feedback. We let RepSurface render its full feedback panel
  // (audio playback, callouts, transcript) and stay there until the user
  // chooses Continue. Previous design swapped to a custom "done" screen ~2s
  // after scoring landed, which tore the feedback panel out from under the
  // user mid-read (Aidan's note).
  return (
    <>
      <RepSurface
        prompt={BASELINE_PROMPT}
        mode="scenario_training"
        topic="Baseline"
        maxDurationMs={60_000}
        onComplete={({ score: _score, repId }) => {
          // Save the baseline silently. The user keeps reading their feedback
          // and chooses when to continue — no screen swap required.
          void _score;
          setError(null);
          startTransition(async () => {
            const result = await markBaselineRepAction(repId);
            if (!result.ok) {
              setError(
                "Couldn't save your baseline. The rep is still yours, you can continue to the tutorial.",
              );
            }
          });
        }}
        onNext={() => router.push("/tutorial")}
        nextLabel="Continue to tutorial"
      />
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          Skip tutorial, go to dashboard
        </button>
      </div>
      {error && (
        <p className="mt-3 text-center text-sm text-danger">{error}</p>
      )}
    </>
  );
}
