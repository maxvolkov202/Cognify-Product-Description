"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  personasForVertical,
  getVertical,
  isVerticalId,
  type PersonaId,
  type VerticalId,
} from "@/lib/onboarding/constants";
import { setPersonasAction } from "@/server/actions/onboarding";
import { OnboardingProgress } from "@/components/product/OnboardingProgress";
import { useOnboardingDraft } from "@/lib/onboarding/use-draft";

export default function OnboardingPersonasPage() {
  const router = useRouter();
  const [selectedArr, setSelectedArr] = useOnboardingDraft<
    "personas",
    string[] | undefined
  >("personas", []);
  const [draftVertical] = useOnboardingDraft<"vertical", string | undefined>(
    "vertical",
    undefined,
  );
  const vertical: VerticalId | null =
    draftVertical && isVerticalId(draftVertical) ? draftVertical : null;
  const contextualPersonas = personasForVertical(vertical);
  const verticalLabel = vertical ? getVertical(vertical).label : null;
  const selected = new Set<PersonaId>((selectedArr ?? []) as PersonaId[]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: PersonaId) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedArr(Array.from(next));
  }

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const result = await setPersonasAction(Array.from(selected));
      if (result.ok) {
        router.push("/onboarding/goals");
      } else if (result.error === "db_error") {
        setError(
          "Couldn't save that just now — check your connection and try again.",
        );
      } else {
        setError("Session expired. Reload to sign in again.");
      }
    });
  }

  function handleSkip() {
    startTransition(async () => {
      await setPersonasAction([]);
      router.push("/onboarding/goals");
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <Link
        href="/onboarding/vertical"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
      <OnboardingProgress step={2} total={4} />
      <div className="text-center">
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Who do you talk to?
        </h1>
        <p className="mt-3 text-base text-ink-600">
          {verticalLabel
            ? `The people you handle most in ${verticalLabel}. Pick anyone that fits — we'll tune your reps around them.`
            : "Pick everyone you regularly communicate with. Tunes the stakeholders in your Build-a-Rep scenarios."}
        </p>
      </div>

      <motion.div
        layout
        transition={{ layout: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } }}
        className="mt-10 flex flex-wrap gap-2.5"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {contextualPersonas.map((p) => {
            const active = selected.has(p.id);
            return (
              <motion.button
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -6 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={active}
                className={`group relative flex min-w-[180px] flex-1 items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-colors sm:flex-none sm:max-w-[300px] ${
                  active
                    ? "brand-gradient border-transparent text-white shadow-[0_8px_24px_-10px_rgba(151,136,255,0.55)]"
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
                  <div
                    className={`text-base font-bold leading-tight ${
                      active ? "text-white" : "text-ink-900"
                    }`}
                  >
                    {p.label}
                  </div>
                  <div
                    className={`mt-0.5 text-xs leading-snug ${
                      active ? "text-white/80" : "text-ink-500"
                    }`}
                  >
                    {p.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {error && (
        <p className="mt-6 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isPending}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Continue"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
