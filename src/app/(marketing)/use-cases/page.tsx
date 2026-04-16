import type { Metadata } from "next";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "Use cases",
  description:
    "Interview prep. Pitch training. Meeting presence. Feedback delivery. Career centers. L&D programs. Cognify trains the moments that define careers.",
};

const caseStudies = [
  {
    audience: "Career centers",
    title: "Students prepared for interviews and pitches.",
    body: "Cohort onboarding. Daily reps through interview-prep prompts. Progress exports your career-services team can show to deans and employers.",
  },
  {
    audience: "L&D teams",
    title: "Communication that compounds.",
    body: "Per-seat licensing. Admin dashboards. Calibration sessions. Quantified progress per employee, ready for the CFO.",
  },
  {
    audience: "Sales teams",
    title: "Ramp time cut. Pitch clarity earned.",
    body: "Scenario training on real deals. Framework generation for discovery, demo, and close conversations. Measurable improvement over four weeks.",
  },
  {
    audience: "Consulting & finance",
    title: "Frameworks that earn trust.",
    body: "SCQA, MECE, and executive-ready framing. Practice explaining complex decisions to skeptical audiences under time pressure.",
  },
  {
    audience: "Medicine & law",
    title: "Patient and client communication that lands.",
    body: "Practice difficult conversations. Deliver bad news with structure. Explain complex options clearly. Build the muscle memory that matters.",
  },
  {
    audience: "Leadership",
    title: "Feedback delivered without flinching.",
    body: "The Behavior → Impact → Expectation framework, practiced daily. Build the skill of delivering tough feedback clearly and kindly.",
  },
] as const;

export default function UseCasesPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft" />
        <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-24 text-center md:pt-32">
          <h1 className="mx-auto max-w-3xl text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[60px]">
            Communication sits behind{" "}
            <span className="brand-gradient-text">every professional moment.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-600">
            Start focused. Expand broadly. Cognify enters through career centers and
            L&amp;D teams and expands into every role where communication is the
            bottleneck.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.map((c) => (
            <div key={c.title} className="surface-card p-7">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                {c.audience}
              </p>
              <h3 className="mt-2 text-lg font-bold text-ink-900">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <GradientButton href="/for-teams" size="lg">
            Book a pilot for your team
          </GradientButton>
        </div>
      </section>
    </>
  );
}
