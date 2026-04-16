import type { Metadata } from "next";
import { SupportForm } from "@/components/marketing/SupportForm";

export const metadata: Metadata = {
  title: "Help & Support · Cognify",
  description:
    "Help center, FAQs, and direct contact for Cognify — the communication gym.",
};

type Faq = {
  question: string;
  answer: string;
};

const SECTIONS: Array<{
  id: string;
  heading: string;
  blurb: string;
  faqs: Faq[];
}> = [
  {
    id: "getting-started",
    heading: "Getting started",
    blurb:
      "The fastest way to see what Cognify is for: run one rep. 10-second setup, under a minute start to finish.",
    faqs: [
      {
        question: "What's the fastest way to try it?",
        answer:
          "Create an account, then run a Daily Workout. It's 4 reps in about 10 minutes. You'll get live feedback on every rep across six dimensions with transcript-anchored callouts. If you want to taste it first, click 'Try a rep' on the landing page — 20 seconds, no signup.",
      },
      {
        question: "Do I need a special setup or mic?",
        answer:
          "No. Your laptop or phone mic is fine. Quiet room matters more than hardware. Grant mic permission when your browser asks.",
      },
      {
        question: "How long does onboarding take?",
        answer:
          "Three questions — what you do, who you talk to, what you want to get better at. Under a minute. The answers feed how Cognify picks your reps.",
      },
    ],
  },
  {
    id: "scoring",
    heading: "Scoring & feedback",
    blurb:
      "Every rep is scored on six research-backed dimensions — three for what you say (clarity, structure, relevance) and three for how you say it (confidence, pacing, tone).",
    faqs: [
      {
        question: "Why am I seeing these six dimensions and not others?",
        answer:
          "The rubric draws from Pinker, Orwell, Minto, Duarte, and Matt Abrahams' work on real-time communication. Full research and citations live at /about/references. Click \"Why this matters\" on any callout to see the relevant excerpt.",
      },
      {
        question: "How does the \"each rep builds off the last\" work?",
        answer:
          "After every rep, Cognify detects your weakest dimension. The next rep in your session biases toward a rep type that specifically trains that weakness — and the prompt-select screen tells you why.",
      },
      {
        question: "Can I see exactly what you're flagging?",
        answer:
          "Yes. Every callout includes a direct quote from your transcript with a timestamp, a suggested better phrasing, and a \"Why this matters\" link to the research behind the dimension.",
      },
      {
        question: "Can scores move — is there real improvement to track?",
        answer:
          "Yes. Your progress page shows per-dimension trend lines over 7/30/90 days. The calendar strip on the dashboard shows every day you trained and your composite score for that day. Monthly reports stitch it together.",
      },
    ],
  },
  {
    id: "billing",
    heading: "Billing",
    blurb:
      "Cognify is currently free during the private beta. If you're here from a team pilot, reach out below for team invoicing.",
    faqs: [
      {
        question: "Is this free?",
        answer:
          "Yes — during the beta. Individual plans and team pilots will be announced before anything changes. Nothing hidden behind paywalls in the meantime.",
      },
      {
        question: "Do you offer team / enterprise plans?",
        answer:
          "Team pilots are available by request. Use the contact form below and pick \"Other\" — someone will reach out to scope a pilot.",
      },
    ],
  },
  {
    id: "privacy",
    heading: "Privacy & data",
    blurb:
      "Your reps are yours. Audio and transcripts are stored for your dashboard and deleted on request.",
    faqs: [
      {
        question: "Who can hear my recordings?",
        answer:
          "Only you. Recordings are stored in your account for playback and are not shared externally. You can delete any rep from your progress page.",
      },
      {
        question: "Do you train AI on my speech?",
        answer:
          "No. Claude (via Anthropic) scores your reps but does not train on your audio or transcripts. Anthropic's data policy applies end-to-end.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-12">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Help & Support
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Real answers. A real human on the other end.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-ink-600 md:text-lg">
          Most things you&rsquo;ll want are below. If the answer isn&rsquo;t
          here, use the form — we read every message and typically reply the
          same day.
        </p>
        <nav
          aria-label="Jump to section"
          className="mt-6 flex flex-wrap gap-2"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 hover:border-brand-purple/50 hover:bg-brand-purple/5"
            >
              {s.heading}
            </a>
          ))}
          <a
            href="#contact"
            className="brand-gradient rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            Contact
          </a>
        </nav>
      </div>

      <div className="space-y-14">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
              {s.heading}
            </h2>
            <p className="mt-2 text-sm text-ink-600 md:text-base">{s.blurb}</p>
            <dl className="mt-6 space-y-4">
              {s.faqs.map((f) => (
                <div
                  key={f.question}
                  className="rounded-2xl border border-ink-200 bg-white p-5"
                >
                  <dt className="text-base font-bold text-ink-900">
                    {f.question}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-600 md:text-base">
                    {f.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section id="contact" className="scroll-mt-24">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
            Still stuck? Send us a note.
          </h2>
          <p className="mt-2 text-sm text-ink-600 md:text-base">
            Direct line to the Cognify team. Bug reports, feature ideas,
            pilot inquiries — all land in the same inbox.
          </p>
          <div className="mt-6">
            <SupportForm />
          </div>
        </section>
      </div>
    </div>
  );
}
