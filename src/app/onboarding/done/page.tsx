import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "You're ready",
};

export default function OnboardingDonePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="brand-gradient grid size-16 place-items-center rounded-2xl shadow-sm">
        <CheckCircle2 className="size-8 text-white" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
        One rep away.
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-600">
        Your next rep is your <strong className="text-ink-900">baseline</strong>
        &nbsp;— the anchor every future rep gets measured against. Do it
        honestly. Even a middling baseline makes your progress legible later.
      </p>
      <p className="mt-3 max-w-md text-sm text-ink-500">
        60 seconds, one prompt. You can redo it from Settings if you need to.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <GradientButton href="/onboarding/baseline" size="lg">
          Record my baseline →
        </GradientButton>
        <Link
          href="/tutorial"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
        >
          Skip to tutorial
        </Link>
      </div>
      <p className="mt-10 text-[11px] text-ink-400">
        You can change your selections later under Settings.
      </p>
    </div>
  );
}
