"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { VERTICALS, type VerticalId } from "@/lib/onboarding/constants";
import { setVerticalAction } from "@/server/actions/onboarding";
import { OnboardingProgress } from "@/components/product/OnboardingProgress";
import { useOnboardingDraft } from "@/lib/onboarding/use-draft";

export default function OnboardingVerticalPage() {
  const router = useRouter();
  const [selected, setSelected] = useOnboardingDraft<"vertical", string | undefined>(
    "vertical",
    undefined,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await setVerticalAction(selected);
      if (result.ok) {
        router.push("/onboarding/personas");
      } else if (result.error === "db_error") {
        setError(
          "Couldn't save that just now — check your connection and try again.",
        );
      } else if (result.error === "no_user") {
        setError("Session expired. Reload the page to sign in again.");
      } else {
        setError("Invalid selection. Pick one of the options above.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <OnboardingProgress step={1} total={5} />
      <div className="text-center">
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          What do you do?
        </h1>
        <p className="mt-3 text-base text-ink-600">
          Pick the field closest to your day-to-day work. This shapes the
          prompts and tone across the entire product.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {VERTICALS.map((v) => {
          const active = selected === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v.id as VerticalId)}
              aria-pressed={active}
              className={`text-left rounded-2xl border p-4 transition ${
                active
                  ? "border-ink-900 bg-white shadow-sm ring-2 ring-ink-900/10"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <div className="text-base font-bold text-ink-900">{v.label}</div>
              <div className="mt-1 text-xs text-ink-500">{v.description}</div>
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
          disabled={!selected || isPending}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Continue"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
