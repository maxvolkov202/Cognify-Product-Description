"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { motion } from "motion/react";
import { OnboardingProgress } from "@/components/product/OnboardingProgress";
import { completeOnboardingAction } from "@/server/actions/onboarding";
import {
  DAYS_OF_WEEK,
  DEFAULT_COMMITTED_DAYS,
  MIN_COMMITTED_DAYS,
  committedDayCount,
  isDayCommitted,
  type DayBit,
} from "@/lib/onboarding/committed-days";

export default function OnboardingDaysPage() {
  const router = useRouter();
  // Default to Mon-Fri (5 days). Trainer recommendation framing.
  const [mask, setMask] = useState<number>(DEFAULT_COMMITTED_DAYS);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(bit: DayBit) {
    const next = mask ^ (1 << bit);
    setMask(next);
  }

  function handleContinue() {
    const count = committedDayCount(mask);
    if (count < MIN_COMMITTED_DAYS) {
      setError(
        `Pick at least ${MIN_COMMITTED_DAYS} days — consistency matters more than perfection.`,
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      // Save committed days via the API endpoint.
      try {
        const res = await fetch("/api/me/committed-days", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ committedDays: mask }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(
            body?.message ?? "Couldn't save your schedule — try again in a sec.",
          );
          return;
        }
      } catch {
        setError("Couldn't reach the server — check your connection.");
        return;
      }
      const completion = await completeOnboardingAction();
      if (completion.ok) {
        router.push("/onboarding/done");
      } else {
        setError("Something went wrong finishing setup. Try again.");
      }
    });
  }

  const count = committedDayCount(mask);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <Link
        href="/onboarding/goals"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
      <OnboardingProgress step={4} total={4} />
      <div className="text-center">
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 dark:text-white md:text-5xl">
          When do you want to train?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-ink-600 dark:text-ink-300">
          Most people see real results training <strong>4 or 5 days a week</strong>.
          Pick what fits your life — you can change this anytime.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-7 gap-1.5 sm:gap-3">
        {DAYS_OF_WEEK.map((d) => {
          const active = isDayCommitted(mask, d.bit);
          return (
            <motion.button
              key={d.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              type="button"
              onClick={() => toggle(d.bit)}
              aria-pressed={active}
              className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 font-bold transition-colors ${
                active
                  ? "brand-gradient border-transparent text-white shadow-[0_8px_24px_-10px_rgba(151,136,255,0.55)]"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
              }`}
            >
              <span className="text-sm sm:text-base">{d.label}</span>
              {active && (
                <Check className="size-3.5 text-white" strokeWidth={3} />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 text-center text-sm text-ink-600 dark:text-ink-300">
        <span className="font-extrabold tabular-nums text-ink-900 dark:text-white">
          {count}
        </span>{" "}
        {count === 1 ? "day" : "days"} a week
        {count >= 4 && count <= 5 && (
          <span className="ml-1 text-brand-purple dark:text-brand-lavender">
            — sweet spot for results
          </span>
        )}
        {count >= 6 && (
          <span className="ml-1 text-brand-purple dark:text-brand-lavender">
            — committed
          </span>
        )}
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
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
