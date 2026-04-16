"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import {
  IMPROVEMENT_GOALS,
  type ImprovementGoalId,
} from "@/lib/onboarding/constants";
import {
  setImprovementGoalsAction,
  completeOnboardingAction,
} from "@/server/actions/onboarding";
import { OnboardingProgress } from "@/components/product/OnboardingProgress";
import {
  useOnboardingDraft,
  clearOnboardingDraft,
} from "@/lib/onboarding/use-draft";

export default function OnboardingGoalsPage() {
  const router = useRouter();
  const [selectedArr, setSelectedArr] = useOnboardingDraft<
    "improvementGoals",
    string[] | undefined
  >("improvementGoals", []);
  const selected = new Set<ImprovementGoalId>(
    (selectedArr ?? []) as ImprovementGoalId[],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: ImprovementGoalId) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedArr(Array.from(next));
  }

  function handleContinue() {
    if (selected.size === 0) {
      setError("Pick at least one — we'll prioritize it in your workouts.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setImprovementGoalsAction(Array.from(selected));
      if (!result.ok) {
        setError(
          result.error === "need_at_least_one"
            ? "Pick at least one — we'll prioritize it in your workouts."
            : result.error === "db_error"
              ? "Couldn't save that just now — try again in a second."
              : "Session expired. Reload to sign in again.",
        );
        return;
      }
      const completion = await completeOnboardingAction();
      if (completion.ok) {
        clearOnboardingDraft();
        router.push("/onboarding/done");
      } else {
        setError("Something went wrong finishing setup. Try again.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <Link
        href="/onboarding/personas"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
      <OnboardingProgress step={3} total={4} />
      <div className="text-center">
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          What do you want to get better at?
        </h1>
        <p className="mt-3 text-base text-ink-600">
          Pick everything that matters. Your Daily Workout weights these skills
          so reps target what moves the needle for you.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {IMPROVEMENT_GOALS.map((g) => {
          const active = selected.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              aria-pressed={active}
              className={`relative text-left rounded-2xl border p-4 pr-12 transition ${
                active
                  ? "border-ink-900 bg-white shadow-sm ring-2 ring-ink-900/10"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              {active && (
                <div className="brand-gradient absolute right-3 top-3 grid size-5 place-items-center rounded-full">
                  <Check
                    className="size-3 text-white"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </div>
              )}
              <div className="text-base font-bold text-ink-900">{g.label}</div>
              <div className="mt-1 text-xs text-ink-500">{g.description}</div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="mt-10 flex items-center justify-center">
        <button
          type="button"
          onClick={handleContinue}
          disabled={isPending}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Finish setup"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
