import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Team & advisors · Cognify",
  description:
    "Cognify is shaped by advisors with long careers in AI, communication science, and enterprise learning — Hupe, Nahamoo, Ellen, Jeffrey, and David.",
};

type Advisor = {
  /** Short name used as the visible label + photo alt text. */
  name: string;
  /** One-line credibility — role + what they're known for. */
  oneLine: string;
  /** One paragraph. Why they're involved + what they shaped. */
  bio: string;
  /** Which product principle they drive. Shown as a chip. */
  principle: string;
  /** Initials rendered in the gradient avatar until headshots arrive. */
  initials: string;
};

const ADVISORS: readonly Advisor[] = [
  {
    name: "Mr. Hupe",
    oneLine: "Performance-under-pressure advisor · Subject.AI pilot channel",
    bio:
      "Hupe pushed us on the hardest principle in communication training: what you practice calm, you lose under pressure. He pointed to Tim Tebow — impeccable technique in practice, reverts to old mechanics in live play — as the pattern Cognify had to design against. Every Daily Workout includes a required pressure rep because of that conversation. Hupe also brings the Subject.AI pilot opportunity (California + Saudi Arabia) for our first international expansion.",
    principle: "Pressure builds habit",
    initials: "H",
  },
  {
    name: "Mr. Nahamoo",
    oneLine: "Measurability advisor · ex-IBM Research speech + recall-speed",
    bio:
      "Nahamoo insisted that training without measurement is theater. The daily score, weekly trend, and monthly report card exist because of his push — users have to feel the improvement, not just believe in it. His background in speech science shapes how we think about recall speed as a trainable dimension, not a personality trait.",
    principle: "Measure the gain",
    initials: "N",
  },
  {
    name: "Ellen",
    oneLine: "Reasoning engine collaborator · Aisle 23",
    bio:
      "Ellen and her team at Aisle 23 are building the algorithmic reasoning layer that powers Cognify's advanced feedback. The goal: feedback that teaches, not just scores. The collaboration is active and ongoing.",
    principle: "Advanced feedback engine",
    initials: "E",
  },
  {
    name: "Jeffrey",
    oneLine: "IP advisor · NESSIS · patent attorney introduction",
    bio:
      "Jeffrey connects Cognify to the patent counsel drafting our provisional filing around the Boxology — the algorithmic process flow that makes Cognify a training system rather than an analysis tool. He keeps the IP strategy grounded: file, defend, license.",
    principle: "Protect the IP",
    initials: "J",
  },
  {
    name: "David",
    oneLine: "Validation advisor · ex-IBM, creator of Watson",
    bio:
      "David seeded the external-validation flagship: a user runs 5 reps on a topic over a week; blind listeners rank them without seeing scores. The aggregated ranking becomes proof of improvement that no algorithm can fake. That loop is now the 5-Session Improvement Curve — a pitch artifact for enterprise and a credibility anchor for consumer.",
    principle: "Validate with humans",
    initials: "D",
  },
] as const;

export default function TeamPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft"
          aria-hidden="true"
        />
        <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-24 text-center md:pt-32">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-purple">
            Team & advisors
          </p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[60px]">
            Built with <span className="brand-gradient-text">people</span>,
            <br />
            who&rsquo;ve spent careers on this problem.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-600">
            Cognify isn&rsquo;t an opinion about communication. It&rsquo;s the
            translation of five advisors&rsquo; direct input into product —
            performance under pressure, measurable improvement, advanced
            reasoning, IP protection, and human validation.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-2">
          {ADVISORS.map((a) => (
            <article
              key={a.name}
              className="surface-card overflow-hidden"
            >
              <div className="brand-gradient h-1" aria-hidden="true" />
              <div className="p-6 md:p-7">
                <div className="flex items-start gap-4">
                  <AvatarInitials initials={a.initials} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold tracking-tight text-ink-900">
                      {a.name}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-ink-600">
                      {a.oneLine}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-lavender/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-purple">
                      {a.principle}
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-ink-700">
                  {a.bio}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-ink-200 bg-white p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-purple">
            Inside Cognify
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
            The team translating advisor input into product.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
            Max Volkov (engineering), Hunter Begehr (strategy), Owen Sargeant
            (product research), and Bob Sides (founding CTO, v1) are the core
            team shipping Cognify. We work in the open with our advisors —
            every quarter&rsquo;s direction traces back to a conversation on
            this page.
          </p>
          <div className="mt-5">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-purple hover:text-brand-magenta"
            >
              About Cognify
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Gradient avatar with initials. Replaced with real headshots in WS-9 Phase
 * 9.3 once the team + advisors provide photos. Using initials now keeps the
 * page shippable today.
 */
function AvatarInitials({ initials }: { initials: string }) {
  return (
    <div
      className="brand-gradient grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white shadow-[0_14px_40px_-14px_rgba(151,136,255,0.7)]"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
