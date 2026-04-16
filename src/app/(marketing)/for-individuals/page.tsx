import type { Metadata } from "next";
import { GradientButton } from "@/components/shared/GradientButton";
import { ModesSection } from "@/components/marketing/ModesSection";
import { ProgressChartMock } from "@/components/marketing/ProgressChartMock";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { PillarsSection } from "@/components/marketing/PillarsSection";

export const metadata: Metadata = {
  title: "For individuals",
  description:
    "Train clear thinking into clear speech. Ten minutes a day. Daily reps. Instant feedback. Build confidence through repetition.",
};

export default function ForIndividualsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft" />
        <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-24 text-center md:pt-32">
          <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-900 md:text-[68px]">
            Train clear thinking into{" "}
            <span className="brand-gradient-text">clear speech.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
            Cognify is a communication training gym where you practice real
            conversations out loud. Through short, structured reps and immediate
            feedback, you build the ability to organize thoughts and explain ideas
            clearly under pressure.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GradientButton href="/signup" size="lg">
              Start training free
            </GradientButton>
            <GradientButton href="/how-it-works" variant="outline" size="lg">
              See how the gym works
            </GradientButton>
          </div>
          <p className="mt-5 text-sm text-ink-500">
            Free plan included. No card required. Ten minutes a day.
          </p>
        </div>
      </section>

      <ModesSection />
      <ProgressChartMock />
      <PillarsSection />
      <FinalCTA />
    </>
  );
}
