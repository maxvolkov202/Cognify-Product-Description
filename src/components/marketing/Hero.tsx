import { GradientButton } from "@/components/shared/GradientButton";
import { PracticeLoopMock } from "./PracticeLoopMock";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="brand-gradient-soft absolute inset-0 opacity-70" />
        <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-brand-blue/25 blur-3xl" />
        <div className="absolute -right-32 top-16 size-[520px] rounded-full bg-brand-magenta/20 blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 pb-24 pt-20 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pt-28 lg:pt-32">
        <div className="flex flex-col justify-center">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-600 backdrop-blur">
            <span className="brand-gradient size-1.5 rounded-full" />
            The Duolingo for communication
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] text-ink-900 md:text-[64px]">
            Train clear thinking <br className="hidden sm:block" />
            into <span className="brand-gradient-text">clear speech.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
            Cognify is a communication training gym. Short, structured reps and instant feedback build the ability to organize thoughts and explain ideas clearly under pressure, for your team and for you.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <GradientButton href="/try" size="lg">
              Try a rep — no signup →
            </GradientButton>
            <GradientButton href="/signin?mode=signup" variant="outline" size="lg">
              Create your account
            </GradientButton>
          </div>

          <p className="mt-5 text-sm text-ink-500">
            Twenty seconds to your first rep. Six minutes a day keeps the
            clarity sharp.
          </p>
        </div>

        <div className="flex items-center justify-center">
          <PracticeLoopMock />
        </div>
      </div>
    </section>
  );
}
