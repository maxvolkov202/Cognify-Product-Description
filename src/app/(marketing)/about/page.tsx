import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "About",
  description: "The moment it clicked. Intelligence isn't the problem. Structure is.",
};

const values = [
  {
    title: "Clarity over complexity",
    body: "Simple, structured communication beats clever thinking under pressure.",
  },
  {
    title: "Reps over theory",
    body: "Reading doesn't build skill. Practice does.",
  },
  {
    title: "Measurable growth over vague confidence",
    body: "Every rep is scored. Every pattern is visible.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-5xl px-6 pb-14 pt-24 md:pt-32">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h1 className="text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[68px]">
              The moment it clicked.
            </h1>
            <p className="mt-6 text-xl font-semibold text-ink-800">
              Intelligence isn&rsquo;t the problem. <br />
              Structure is.
            </p>
            <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-ink-600">
              <p>
                I spent years watching talented people struggle in high-stakes moments.
                Not because they didn&rsquo;t know their material. Not because they
                lacked intelligence.
              </p>
              <p>
                But because when pressure hit (interviews, sales calls, presentations) their structure dissolved.
              </p>
              <p>They knew what they wanted to say. They just couldn&rsquo;t deliver it clearly.</p>
              <p>
                The gap wasn&rsquo;t knowledge. It was muscle memory. No one had trained
                their brain to hold structure under pressure.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <div className="brand-gradient absolute -inset-10 rounded-full opacity-20 blur-3xl" />
              <div className="relative scale-[2.5]">
                <Logo variant="mark" href="" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-200/60 bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Most people don&rsquo;t need more information.
            <br />
            <span className="brand-gradient-text">They need reps.</span>
          </h2>
          <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-ink-600">
            <p>You don&rsquo;t build strength by reading about lifting weights. You train.</p>
            <p>You don&rsquo;t gain endurance by studying running form. You run.</p>
            <p>Communication works the same way.</p>
            <p>
              If you want clarity when it matters, you have to practice clarity when it
              matters.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-24">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          So we built a gym for communication.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink-600">
          Not a course. Not a workshop. Not a list of tips. A training environment.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {values.map((v) => (
            <div key={v.title} className="surface-card p-7">
              <h3 className="text-lg font-bold text-ink-900">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          This is just the beginning.
        </h2>
        <p className="mt-4 text-lg text-ink-600">
          Cognify is for people who want to communicate clearly when it counts.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <GradientButton href="/for-individuals" size="lg">
            Start your first rep
          </GradientButton>
          <Link
            href="/about/team"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
          >
            <Users className="size-4" />
            Team & advisors
          </Link>
          <Link
            href="/about/references"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
          >
            <BookOpen className="size-4" />
            See our sources
          </Link>
        </div>
      </section>
    </>
  );
}
