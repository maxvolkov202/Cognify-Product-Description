"use client";

// PRD v3 Phase 10 (§8.2) — Communication Stage capture during ONBOARDING.
//
// Previously only editable in Settings, which starved the personalization
// inputs (prompt generation, stage benchmarks) for anyone who never
// opened Settings. One tap, skippable — stage is context, never scoring.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  COMMUNICATION_STAGES,
  type CommunicationStageId,
} from "@/lib/onboarding/constants";
import { setCommunicationStageAction } from "@/server/actions/onboarding";
import { OnboardingProgress } from "@/components/product/OnboardingProgress";

const STAGE_HINTS: Record<CommunicationStageId, string> = {
  student: "Classes, interviews, first presentations.",
  early_career: "Standing out in meetings, finding your voice.",
  individual_contributor: "Updates, demos, cross-team persuasion.",
  manager: "1:1s, feedback, running the room.",
  senior_leader: "Exec briefings, org-wide narratives.",
  executive: "Boards, all-hands, the company's voice.",
};

export default function OnboardingStagePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<CommunicationStageId | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    startTransition(async () => {
      if (selected) {
        const result = await setCommunicationStageAction(selected);
        if (!result.ok) {
          setError("Couldn't save that just now — try again in a second.");
          return;
        }
      }
      router.push("/onboarding/days");
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <Link
        href="/onboarding/goals"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
      <OnboardingProgress step={4} total={5} />
      <div className="text-center">
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Where are you in your journey?
        </h1>
        <p className="mt-3 text-base text-ink-600">
          Your stage shapes the scenarios and coaching you get. It never
          affects scoring — a manager and a student earn the same 80.
        </p>
      </div>

      <div className="mt-10 grid gap-2.5 sm:grid-cols-2">
        {COMMUNICATION_STAGES.map((stage) => {
          const active = selected === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setSelected(stage.id)}
              aria-pressed={active}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "brand-gradient border-transparent text-white shadow-[0_8px_24px_-10px_rgba(151,136,255,0.55)]"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <div
                className={`text-base font-bold leading-tight ${
                  active ? "text-white" : "text-ink-900"
                }`}
              >
                {stage.label}
              </div>
              <div
                className={`mt-0.5 text-xs leading-snug ${
                  active ? "text-white/80" : "text-ink-500"
                }`}
              >
                {STAGE_HINTS[stage.id]}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleContinue}
          disabled={isPending || !selected}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Continue"}
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding/days")}
          className="min-h-[44px] text-xs font-semibold text-ink-500 hover:text-ink-900"
        >
          Skip for now — you can set this in Settings
        </button>
      </div>
    </div>
  );
}
