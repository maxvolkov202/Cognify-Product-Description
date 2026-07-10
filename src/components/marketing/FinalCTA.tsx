import { GradientButton } from "@/components/shared/GradientButton";

export function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-28 text-center">
      <h2 className="text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-6xl">
        Clarity is a skill. <span className="brand-gradient-text">Train it.</span>
      </h2>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <GradientButton href="/try" size="lg">
          Try a rep — no signup →
        </GradientButton>
        <GradientButton href="/for-teams" variant="outline" size="lg">
          Book a pilot for your team
        </GradientButton>
      </div>
      <p className="mt-6 text-sm text-ink-500">One rep closer to clarity.</p>
    </section>
  );
}
