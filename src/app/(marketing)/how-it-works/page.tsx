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
    def: "Visible scaffolding — opening, flow, close.",
    low: "Topic jumping, missing transitions, weak openings.",
  },
  {
    group: "Content",
    name: "Relevance",
    def: "The rep actually addresses the prompt.",
    low: "Drift onto tangents, answering a different question.",
  },
  {
    group: "Delivery",
    name: "Confidence",
    def: "Perceived composure and self-assurance.",
    low: "Hedging, restarts, long pauses, over-apologizing.",
  },
  {
    group: "Delivery",
    name: "Pacing",
    def: "Speed, rhythm, and time budget discipline.",
    low: "Filler rate, rushing the close, going over time.",
  },
  {
    group: "Delivery",
    name: "Tone",
    def: "Calibration to audience and constraints.",
    low: "Same register regardless of who's listening.",
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
            training environment — a six-stage closed loop that builds communication
            skill the same way a gym builds strength.
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

        <div className="mt-10 overflow-hidden rounded-2xl border border-ink-200">
          <table className="w-full text-left">
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
          Delivery dimensions evaluate <em>how</em> you said it. Pacing is
          scored deterministically from word-level timestamps so its trend
          lines are model-stable across time.
        </p>
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
