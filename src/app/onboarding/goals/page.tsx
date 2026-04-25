"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { motion } from "motion/react";
import {
  goalsForVertical,
  getVertical,
  isVerticalId,
  type ImprovementGoalId,
  type VerticalId,
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
  const [draftVertical] = useOnboardingDraft<"vertical", string | undefined>(
    "vertical",
    undefined,
  );
  const vertical: VerticalId | null =
    draftVertical && isVerticalId(draftVertical) ? draftVertical : null;
  const selected = new Set<ImprovementGoalId>(
    (selectedArr ?? []) as ImprovementGoalId[],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const contextualGoals = goalsForVertical(vertical);
  const verticalLabel = vertical ? getVertical(vertical).label : null;

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

      <motion.div
        layout
        transition={{ layout: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } }}
        className="mt-10 flex flex-wrap gap-2.5"
      >
        {contextualGoals.map(({ goal: g, featured }) => {
          const active = selected.has(g.id);
          return (
            <motion.button
              key={g.id}
              layout
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              type="button"
              onClick={() => toggle(g.id)}
              aria-pressed={active}
              className={`group relative flex min-w-[200px] flex-1 items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-colors sm:flex-none sm:max-w-[320px] ${
                active
                  ? "brand-gradient border-transparent text-white shadow-[0_8px_24px_-10px_rgba(151,136,255,0.55)]"
                  : featured
                    ? "border-brand-purple/40 bg-gradient-to-br from-brand-blue/5 to-brand-magenta/5 hover:border-brand-purple/60"
                    : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <div
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition ${
                  active
                    ? "bg-white/25"
                    : "border border-ink-200 bg-white group-hover:border-ink-400"
                }`}
              >
                {active && (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  >
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`text-base font-bold leading-tight ${
                      active ? "text-white" : "text-ink-900"
                    }`}
                  >
                    {g.label}
                  </div>
                  {featured && verticalLabel && !active && (
                    <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-purple">
                      ★ Common
                    </span>
                  )}
                </div>
                <div
                  className={`mt-0.5 text-xs leading-snug ${
                    active ? "text-white/80" : "text-ink-500"
                  }`}
                >
                  {g.description}
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

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
