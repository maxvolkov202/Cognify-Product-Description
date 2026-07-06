import type { Metadata } from "next";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Cognify's scoring model works. Six dimensions. Transparent methodology. Transcript-anchored feedback. Progress you can see.",
};

const steps = [
  {
    n: "01",
    title: "Prompt",
    body: "A scenario or drill prompt appears. Large type. Countdown starts. No notes allowed.",
  },
  {
    n: "02",
    title: "Think",
    body: "Three seconds to organize. Your brain learns to structure under pressure, not to prepare in advance.",
  },
  {
    n: "03",
    title: "Speak",
    body: "Short timed rep. Voice captured with a visible waveform and a countdown.",
  },
  {
    n: "04",
    title: "Feedback",
    body: "Scores across six dimensions. Every callout anchored to a transcript timestamp. Click to replay.",
  },
  {
    n: "05",
    title: "Refine",
    body: "Run the rep again with your weaknesses surfaced. Rep-to-rep diff shows what changed.",
  },
  {
    n: "06",
    title: "Compound",
    body: "Tomorrow's workout targets the skills you're weakest in. Reps compound.",
  },
] as const;

const dimensions = [
  {
    group: "Content",
    name: "Clarity",
    def: "Ideas land on the first hearing.",
    low: "Ambiguous pronouns, vague nouns, audience re-interpretation.",
  },
  {
    group: "Content",
    name: "Structure",
    def: "Visible scaffolding: opening, flow, close.",
    low: "Topic jumping, missing transitions, weak openings.",
  },
  {
    group: "Content",
    name: "Conciseness",
    def: "Maximum signal per word. Tight sentences over bloated ones.",
    low: "Filler, hedge-stacks, preambles, going over time budget.",
  },
  {
    group: "Content",
    name: "Thinking Quality",
    def: "Depth and rigor of the thought behind the words. Claims supported, complexity engaged.",
    low: "Unsupported claims, surface-level reasoning, no engagement with counterarguments.",
  },
  {
    group: "Delivery",
    name: "Pacing",
    def: "Rate, pauses, fillers, rhythm. The mechanics of speech under real-time conditions.",
    low: "Rushing the close, high filler rate, going over time, no purposeful pausing.",
  },
  {
    group: "Delivery",
    name: "Tone",
    def: "Vocal expressiveness — pitch variation, volume control, downward inflection, presence.",
    low: "Monotone, upspeak, locked volume, low vocal energy, mumbled articulation.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft" />
        <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-24 text-center md:pt-32">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The methodology
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[60px]">
            How Cognify trains{" "}
            <span className="brand-gradient-text">real communication skill.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
            Cognify isn&rsquo;t a course, a workshop, or a list of tips. It&rsquo;s a
            training environment, a six-stage closed loop that builds communication skill the same way a gym builds strength.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="surface-card p-7">
              <div className="brand-gradient-text text-4xl font-extrabold">{step.n}</div>
              <h3 className="mt-3 text-xl font-bold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Six trainable dimensions. <br />
          <span className="brand-gradient-text">Content + Delivery.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink-600">
          Every rep is scored across six dimensions grouped into Content (what
          you said) and Delivery (how you said it). Every callout is anchored
          to a moment in your transcript. No black-box scoring.
        </p>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-ink-200">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                <th className="px-6 py-4">Group</th>
                <th className="px-6 py-4">Dimension</th>
                <th className="px-6 py-4">What it means</th>
                <th className="px-6 py-4">A low score looks like</th>
              </tr>
            </thead>
            <tbody>
              {dimensions.map((d) => (
                <tr key={d.name} className="border-t border-ink-200 text-sm">
                  <td className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    {d.group}
                  </td>
                  <td className="px-6 py-4 font-bold text-ink-900">{d.name}</td>
                  <td className="px-6 py-4 text-ink-700">{d.def}</td>
                  <td className="px-6 py-4 italic text-ink-500">{d.low}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-ink-500">
          Three Content dimensions evaluate <em>what</em> you said. Three
          Delivery dimensions evaluate <em>how</em> you said it. Delivery is
          scored deterministically from word-level timestamps so its trend
          lines are model-stable across time.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-8 md:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Words we use
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
              A short glossary.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-ink-600">
              Consumer apps shouldn&rsquo;t require a decoder ring.
              Here&rsquo;s what the Cognify-specific words mean.
            </p>
            <dl className="mt-8 grid gap-6 md:grid-cols-2">
              <GlossaryItem
                term="Rep"
                def="One timed speaking attempt against a prompt. 20–90 seconds, scored as a single unit. The atomic unit of a Cognify session."
              />
              <GlossaryItem
                term="Rep type"
                def="The kind of speaking drill: Simplify, Structure, Think Fast, Be Concise, Reinforce, Persuade, Adapt, Deliver, Handle Pressure. Nine in total. Each targets a specific skill."
              />
              <GlossaryItem
                term="Daily Workout"
                def="A 5-minute session of 4 to 5 reps, with rep types picked based on your goals and your recent weakest skill."
              />
              <GlossaryItem
                term="Build a Rep"
                def="The scenario mode. You describe a real upcoming conversation; Cognify generates a thinking framework and you practice against it."
              />
              <GlossaryItem
                term="Callout"
                def={'A specific feedback note on a rep, e.g. “At 0:18 you named the stakes in 4 words.” Each callout is tagged to a dimension and a timestamp in your transcript.'}
              />
              <GlossaryItem
                term="Composite score"
                def="A 0–100 average across your six dimensions, weighted by how much each matters for the rep type. Think of it like a GPA for one rep."
              />
              <GlossaryItem
                term="Structural adherence"
                def="A scenario-only score for how closely your rep followed the framework Cognify generated for the conversation. Distinct from the six core dimensions."
              />
              <GlossaryItem
                term="Baseline rep"
                def="Your first-ever 60-second self-introduction. Anchors every later rep: deltas reference this as the zero line."
              />
              <GlossaryItem
                term="External validation"
                def="Blind-ranking mode. You share a link; 3+ listeners rank your reps without seeing scores. The aggregated ranking is human proof of improvement, not algorithmic."
              />
              <GlossaryItem
                term="Rubric version"
                def="The scoring ruleset used on a rep. Pinned per rep so historical trend lines stay honest when we tune the rubric. Current: v2-beta.2."
              />
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Most people don&rsquo;t need more information.{" "}
          <span className="brand-gradient-text">They need reps.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
          You don&rsquo;t build strength by reading about lifting weights. You train.
          You don&rsquo;t gain endurance by studying running form. You run. Communication
          works the same way. If you want clarity when it matters, you have to practice
          clarity when it matters.
        </p>
        <div className="mt-10 flex justify-center">
          <GradientButton href="/for-individuals" size="lg">
            Start your first rep
          </GradientButton>
        </div>
      </section>
    </>
  );
}

function GlossaryItem({ term, def }: { term: string; def: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4">
      <dt className="text-sm font-extrabold text-ink-900">{term}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink-600">{def}</dd>
    </div>
  );
}
