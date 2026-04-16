"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { PERSONAS, type PersonaId } from "@/lib/onboarding/constants";
import { setPersonasAction } from "@/server/actions/onboarding";
import { OnboardingProgress } from "@/components/product/OnboardingProgress";
import { useOnboardingDraft } from "@/lib/onboarding/use-draft";

export default function OnboardingPersonasPage() {
  const router = useRouter();
  const [selectedArr, setSelectedArr] = useOnboardingDraft<
    "personas",
    string[] | undefined
  >("personas", []);
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
          Pick everyone you regularly communicate with. This tunes the stakeholders
          that appear in your Build-a-Rep scenarios. Optional — you can skip.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {PERSONAS.map((p) => {
          const active = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
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
              <div className="text-base font-bold text-ink-900">{p.label}</div>
              <div className="mt-1 text-xs text-ink-500">{p.description}</div>
            </button>
          );
        })}
      </div>

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
