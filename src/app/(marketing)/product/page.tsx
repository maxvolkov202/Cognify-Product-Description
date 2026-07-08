import type { Metadata } from "next";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Two modes, one core practice loop. Daily Workout and Build a Rep. Not scripts. Dynamic structures you speak against.",
};

const modes = [
  {
    n: "Mode 01",
    name: "Daily Workout",
    tagline: "Build the habit. Ten minutes, four reps, every day.",
    body: "A pre-built sequence of four to five speaking drills targeting different skills. General prompts, no setup required. Pick one of five prompts per rep, speak for 30 to 60 seconds, get feedback, retry or move on. The gym loop that compounds across days.",
    trains: ["Clarity", "Structure", "Thinking Quality", "Pacing"],
  },
  {
    n: "Mode 02",
    name: "Build a Rep",
    tagline: "Practice for a specific real moment, before it happens.",
    body: "Type a scenario you're about to face. Add context. Cognify generates a thinking structure tailored to your vertical and the specific moment. You speak to the structure, get feedback, edit it, run it again. Not a script. Not a memorized answer. A scaffold you hold in your mind while you speak.",
    trains: ["Tone", "Conciseness", "Structure", "Real-world calibration"],
  },
] as const;

const repTypes = [
  { name: "Simplify", tagline: "Feynman Technique" },
  { name: "Structure", tagline: "Main → 3 Points → Close" },
  { name: "Think Fast", tagline: "No-prep response" },
  { name: "Be Concise", tagline: "Tight time constraint" },
  { name: "Reinforce", tagline: "Teach it step by step" },
  { name: "Persuade", tagline: "The case that moves someone" },
  { name: "Adapt", tagline: "Same idea, two audiences" },
  { name: "Deliver", tagline: "Pause and pace for emphasis" },
  { name: "Handle Pressure", tagline: "Respond to pushback" },
] as const;

const dimensionGroups = [
  {
    name: "Content",
    dims: ["Clarity", "Structure", "Conciseness", "Thinking Quality"],
    blurb: "What you said",
  },
  {
    name: "Delivery",
    dims: ["Pacing", "Tone"],
    blurb: "How you said it",
  },
] as const;

export default function ProductPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft" />
        <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-24 text-center md:pt-32">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The product
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[60px]">
            Two modes. One{" "}
            <span className="brand-gradient-text">core practice loop.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
            Every rep in every mode: Prompt → Think → Speak → Instant feedback
            → Retry → Advance. The loop is the product. The modes are the two
            ways in.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {modes.map((m) => (
            <div key={m.n} className="surface-card flex flex-col p-10">
              <div
                className="brand-gradient h-1 w-12 rounded-full"
                aria-hidden="true"
              />
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {m.n}
              </p>
              <h3 className="mt-2 text-3xl font-extrabold text-ink-900">
                {m.name}
              </h3>
              <p className="mt-3 text-[15px] font-medium leading-snug text-ink-700">
                {m.tagline}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-500">
                {m.body}
              </p>
              <div className="mt-6 border-t border-ink-200 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Trains
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.trains.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Inside Daily Workout
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Nine rep types.{" "}
            <span className="brand-gradient-text">Real drills.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Each workout pulls 4–5 rep types from the pool, weighted by what
            you said you want to improve during onboarding. Every rep shows
            you five prompts to pick from, or refresh for five more.
          </p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repTypes.map((rt) => (
            <div key={rt.name} className="surface-card p-5">
              <p className="text-sm font-bold text-ink-900">{rt.name}</p>
              <p className="mt-1 text-xs text-ink-500">{rt.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The scoring
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Six dimensions.{" "}
            <span className="brand-gradient-text">Content + Delivery.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Every rep is scored across six dimensions grouped into Content
            (what you said) and Delivery (how you said it). Delivery is scored
            deterministically from word-level timestamps so its trend lines
            are model-stable across time.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {dimensionGroups.map((g) => (
            <div key={g.name} className="surface-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {g.name} · <span className="italic text-ink-500">{g.blurb}</span>
              </p>
              <ul className="mt-3 space-y-2">
                {g.dims.map((d) => (
                  <li
                    key={d}
                    className="flex items-center gap-2 text-sm font-semibold text-ink-900"
                  >
                    <span
                      className="brand-gradient size-1.5 rounded-full"
                      aria-hidden="true"
                    />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-24">
        <div className="surface-card p-10 md:p-14">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The key idea
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Not scripts.{" "}
            <span className="brand-gradient-text">
              Structures you speak against.
            </span>
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-600">
            When you describe a real situation in Build a Rep, Cognify
            generates a thinking structure tailored to your scenario, a short scaffold of sections and bullets you hold in mind while you speak.
            Not a conversation to memorize. A shape for your own thinking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <GradientButton href="/how-it-works" size="lg">
              See the methodology
            </GradientButton>
            <GradientButton href="/signin" size="lg" variant="outline">
              Log in &amp; train →
            </GradientButton>
          </div>
        </div>
      </section>
    </>
  );
}
