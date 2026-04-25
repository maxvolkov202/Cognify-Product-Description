import type { Metadata } from "next";
import { GradientButton } from "@/components/shared/GradientButton";
import { StatsBar } from "@/components/marketing/StatsBar";
import { EnterpriseCTA } from "@/components/marketing/EnterpriseCTA";
import { CompetitorTable } from "@/components/marketing/CompetitorTable";
import { ROICalculator } from "@/components/marketing/ROICalculator";
import { PriorArt } from "@/components/marketing/PriorArt";

export const metadata: Metadata = {
  title: "For teams · brain productivity training",
  description:
    "Cognify is a brain productivity benefit for teams that lose real money to unclear communication. Daily reps, instant feedback, measurable growth, built as Corporate Health & Performance, not another training program.",
};

const valueProps = [
  {
    kicker: "01",
    title: "A brain productivity benefit, not a training program",
    body: "Cognify sits alongside the gym membership and the mental-health stipend, not the L&D budget that gets cut first. Subsidize cognitive EQ the way you already subsidize physical health. Same economic logic, same measurable return.",
  },
  {
    kicker: "02",
    title: "Tribal knowledge doesn't leave when people do",
    body: "Kraft-style losses from communication failure are real and well-documented. Cognify trains the shared language your team speaks, so structure, clarity, and composure under pressure become portable skills, not individual luck.",
  },
  {
    kicker: "03",
    title: "Per-seat proof that holds up in a review",
    body: "Per-skill scores, 30-day trend lines, and exportable PDF reports that stand up to audit. Nahamoo's measurability standard. Every dimension a user trains gets a ground-truth number behind it.",
  },
  {
    kicker: "04",
    title: "Blind-listener validation",
    body: "External validation mode: five reps on the same topic, ranked by unbiased listeners. The 5-Session Improvement Curve, David's validation protocol, is the proof artifact enterprise buyers have been asking for.",
  },
  {
    kicker: "05",
    title: "Not a course. A training system.",
    body: "Courses teach theory. Analysis tools polish delivery. Cognify trains the underlying skill (clarity, structure, conciseness, and composure under pressure) through short daily reps that compound.",
  },
  {
    kicker: "06",
    title: "Start focused. Expand broadly.",
    body: "Entry through customer-facing teams and career centers. Expansion into sales, consulting, finance, healthcare, law, leadership. Every vertical where communication sits behind the moment that decides the outcome.",
  },
] as const;

export default function ForTeamsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft" />
        <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-24 md:pt-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-600 backdrop-blur">
            <span className="brand-gradient size-1.5 rounded-full" />
            Corporate Health &amp; Performance
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-900 md:text-[64px]">
            Train your team to think clearly{" "}
            <span className="brand-gradient-text">under pressure.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
            Cognify is a brain productivity benefit. Daily reps that build the communication skill your team leans on when the stakes are real. Not another training program. Not a library of content. Measurable improvement per employee, positioned where it belongs: Corporate Health &amp; Performance.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <GradientButton href="#contact" size="lg">
              Bring Cognify to your organization
            </GradientButton>
            <GradientButton href="/how-it-works" variant="outline" size="lg">
              See the methodology
            </GradientButton>
          </div>
        </div>
      </section>

      <StatsBar />

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-8 md:grid-cols-2">
          {valueProps.map((v) => (
            <div key={v.kicker} className="surface-card p-8">
              <div className="brand-gradient-text text-4xl font-extrabold">{v.kicker}</div>
              <h3 className="mt-3 text-[22px] font-bold text-ink-900">{v.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <ROICalculator />
      <PriorArt />
      <CompetitorTable />
      <EnterpriseCTA />

      <section id="contact" className="mx-auto w-full max-w-3xl px-6 py-24">
        <div className="surface-card p-10 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-ink-900">
            Start a pilot.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            Tell us about your team. We&rsquo;ll set up a structured pilot, run a
            baseline assessment, and show you progress after four weeks of daily reps.
          </p>
          <div className="mt-8 flex justify-center">
            <GradientButton href="mailto:pilot@cognifygym.com" size="lg">
              Email pilot@cognifygym.com
            </GradientButton>
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Or book directly. Your Cognify contact will get back within one business day.
          </p>
        </div>
      </section>
    </>
  );
}
