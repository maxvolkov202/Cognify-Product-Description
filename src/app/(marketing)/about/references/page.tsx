import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "References & Sources",
  description:
    "The practitioners, books, research, and frameworks Cognify's training methodology is grounded in. Cognify uses ideas; all content is original synthesis with clear attribution.",
};

type Source = {
  name: string;
  work?: string;
  year?: string;
  note?: string;
};

type Pillar = {
  id: string;
  title: string;
  blurb: string;
  staples: Source[];
  practitioners: Source[];
};

const PILLARS: Pillar[] = [
  {
    id: "frameworks",
    title: "Foundational Frameworks",
    blurb:
      "The canonical thinking frameworks Cognify teaches — each in the public domain as an intellectual concept, even where the books introducing them are copyrighted.",
    staples: [
      {
        name: "Barbara Minto",
        work: "The Pyramid Principle: Logic in Writing and Thinking",
        year: "1987",
        note: "SCQA, Minto Pyramid. First woman consultant at McKinsey.",
      },
      {
        name: "Michael Nygard",
        work: "Documenting Architecture Decisions",
        year: "2011",
        note: "ADRs — the 4-node decision framework used in engineering orgs worldwide.",
      },
      {
        name: "Toastmasters International",
        year: "1950s–",
        note: "PREP (Point → Reason → Example → Point) impromptu framework.",
      },
      {
        name: "Center for Creative Leadership",
        work: "Situation-Behavior-Impact (SBI) Model",
        year: "1990s",
        note: "Origin of the BIE feedback framework.",
      },
      {
        name: "Ken Schwaber & Jeff Sutherland",
        work: "Scrum (PPP daily standup format)",
        year: "1990s",
      },
      {
        name: "US Military Communication Doctrine",
        note: "BLUF — Bottom Line Up Front, adapted from mid-20th century intelligence briefing standards.",
      },
      {
        name: "Elias St. Elmo Lewis",
        work: "AIDA framework",
        year: "1898",
        note: "The oldest persuasion framework still in wide use.",
      },
    ],
    practitioners: [],
  },
  {
    id: "sales",
    title: "Sales & Cold Calling",
    blurb:
      "Cold calling and B2B sales conversations — the domain that stresses clarity, pacing, and confidence under maximum social friction.",
    staples: [
      {
        name: "Chris Voss",
        work: "Never Split the Difference",
        year: "2016",
        note: "Former FBI lead international kidnapping negotiator. Tactical empathy, labeling, mirroring, calibrated questions.",
      },
      {
        name: "Neil Rackham",
        work: "SPIN Selling",
        year: "1988",
      },
      {
        name: "Matthew Dixon",
        work: "The Challenger Sale",
        year: "2011",
      },
      {
        name: "Daniel Pink",
        work: "To Sell Is Human",
        year: "2012",
      },
    ],
    practitioners: [
      {
        name: "Connor Murray & Eric Finch",
        work: "Higher Levels — Cold Call Mastery",
        year: "2025",
        note: "Connor: Enterprise AE at Datadog, ex-Oracle #1 SDR. The modern tech-sales gold standard.",
      },
      {
        name: "Armand Farrokh & Nick Cegelski",
        work: "30 Minutes to President's Club podcast, Cold Calling Sucks (And That's Why It Works)",
        year: "2024",
      },
      {
        name: "Chris Orlob",
        work: "pclub.io",
        year: "2025",
        note: "Grew Gong from $200K to $200M+ ARR. Trained 11,000+ sales professionals. Specializes in C-suite selling.",
      },
      {
        name: "Josh Braun",
        work: "The Badass B2B Growth Guide, Braun Sales Academy",
        note: "Anti-\"commission breath\" outreach coaching.",
      },
      {
        name: "Gong Labs",
        work: "The Best Sales Insights of 2025 and cold-call data series",
        year: "2025",
        note: "Data from 300M+ analyzed sales calls.",
      },
    ],
  },
  {
    id: "exec",
    title: "Executive Briefings & Presentations",
    blurb:
      "Communicating with C-suite leaders, board members, and senior stakeholders under time pressure — every word competing for attention.",
    staples: [
      {
        name: "Barbara Minto",
        work: "The Pyramid Principle",
        year: "1987",
      },
      {
        name: "Jerry Weissman",
        work: "Presenting to Win",
        year: "2003 / 2011",
        note: "20+ years coaching Silicon Valley IPO roadshows at Cisco, Yahoo, Microsoft.",
      },
      {
        name: "Nancy Duarte",
        work: "Resonate, Slide:ology, Illuminate",
        year: "2008–2016",
        note: "Duarte Inc. — presentation design for Apple, Google, Cisco, TED.",
      },
      {
        name: "Chris Anderson",
        work: "TED Talks: The Official TED Guide to Public Speaking",
        year: "2016",
        note: "Curator of TED since 2001. The through-line principle.",
      },
      {
        name: "Carmine Gallo",
        work: "Talk Like TED, The Presentation Secrets of Steve Jobs, The Bezos Blueprint",
        year: "2009–2022",
      },
      {
        name: "Chip Heath & Dan Heath",
        work: "Made to Stick",
        year: "2007",
        note: "The SUCCES principles.",
      },
    ],
    practitioners: [
      {
        name: "Chris Orlob",
        work: "pclub.io — C-suite selling curriculum",
        year: "2025–2026",
      },
    ],
  },
  {
    id: "feedback",
    title: "Tough Feedback & Performance Conversations",
    blurb:
      "Giving corrective feedback that actually lands without triggering defensiveness — the hardest routine communication most professionals do.",
    staples: [
      {
        name: "Kim Scott",
        work: "Radical Candor",
        year: "2017",
        note: "Former Google and Apple executive. Care Personally × Challenge Directly.",
      },
      {
        name: "Douglas Stone & Sheila Heen",
        work: "Thanks for the Feedback",
        year: "2014",
        note: "Harvard Negotiation Project. Three triggers that shut down feedback reception.",
      },
      {
        name: "Kerry Patterson, Joseph Grenny et al.",
        work: "Crucial Conversations",
        year: "2002 / 2022 update",
      },
      {
        name: "Marshall Goldsmith",
        work: "What Got You Here Won't Get You There",
        year: "2007",
        note: "Feedforward — the future-focused alternative to traditional feedback.",
      },
      {
        name: "Center for Creative Leadership",
        work: "SBI Model",
        year: "1990s",
      },
    ],
    practitioners: [],
  },
  {
    id: "interviews",
    title: "Behavioral Interviews",
    blurb:
      "'Tell me about a time when…' — the dominant hiring format in 2025–2026 and the cleanest stress test of live structured thinking.",
    staples: [
      {
        name: "Amazon Leadership Principles",
        note: "The 16 LPs and the most behavioral-heavy hiring process in tech.",
      },
      {
        name: "Gayle Laakmann McDowell",
        work: "Cracking the Coding Interview, Cracking the PM Interview",
      },
      {
        name: "MIT Career Advising & Professional Development",
        work: "STAR Method Worksheet and Guide",
      },
      {
        name: "Structured Behavioral Interviewing Research",
        work: "Industrial/organizational psychology — Janz (1982), McDaniel et al. (1994)",
      },
    ],
    practitioners: [],
  },
  {
    id: "storytelling",
    title: "Storytelling & Public Speaking",
    blurb:
      "Making an idea memorable through narrative rather than recitation — the mechanics behind every great keynote and pitch.",
    staples: [
      {
        name: "Chris Anderson",
        work: "TED Talks: The Official TED Guide to Public Speaking",
        year: "2016",
      },
      {
        name: "Carmine Gallo",
        work: "Talk Like TED, The Storyteller's Secret",
        year: "2014 / 2016",
      },
      {
        name: "Nancy Duarte",
        work: "Resonate",
        year: "2010",
        note: "The contrast sparkline, STAR moments.",
      },
      {
        name: "Robert McKee",
        work: "Story",
        year: "1997",
        note: "The screenwriting bible used by Pixar and Netflix.",
      },
      {
        name: "Chip Heath & Dan Heath",
        work: "Made to Stick",
        year: "2007",
      },
      {
        name: "Brené Brown",
        work: "Daring Greatly, Dare to Lead",
        year: "2012 / 2018",
      },
      {
        name: "Joseph Campbell",
        work: "The Hero with a Thousand Faces",
        year: "1949",
      },
    ],
    practitioners: [],
  },
  {
    id: "impromptu",
    title: "Impromptu Speaking & Thinking on Your Feet",
    blurb:
      "Speaking when you didn't know you'd be speaking — the purest test of structured thinking under pressure, and the foundation of Cognify's Daily Workout.",
    staples: [
      {
        name: "Matt Abrahams",
        work: "Think Faster, Talk Smarter: How to Speak Successfully When You're Put on the Spot",
        year: "2023",
        note: "Lecturer at Stanford GSB. The modern definitive work on impromptu.",
      },
      {
        name: "Matt Abrahams",
        work: "Think Fast, Talk Smart podcast (Stanford GSB)",
        year: "2020–",
      },
      {
        name: "Toastmasters International",
        work: "Table Topics methodology",
        year: "1950s–",
      },
      {
        name: "Scott Berkun",
        work: "Confessions of a Public Speaker",
        year: "2009",
      },
      {
        name: "Alan Baddeley",
        work: "Working memory research",
        note: "Foundation for understanding cognitive load during impromptu.",
      },
    ],
    practitioners: [],
  },
  {
    id: "negotiation",
    title: "Negotiation & Persuasion",
    blurb:
      "Agreement-making under contested positions — the domain where every word carries tactical weight and listening is the primary skill.",
    staples: [
      {
        name: "Chris Voss",
        work: "Never Split the Difference",
        year: "2016",
      },
      {
        name: "Roger Fisher, William Ury, Bruce Patton",
        work: "Getting to Yes",
        year: "1981",
        note: "Harvard Negotiation Project. Principled negotiation, BATNA.",
      },
      {
        name: "William Ury",
        work: "Possible",
        year: "2024",
      },
      {
        name: "Deepak Malhotra & Max Bazerman",
        work: "Negotiation Genius",
        year: "2007",
      },
      {
        name: "Robert Cialdini",
        work: "Influence, Pre-Suasion",
        year: "1984 / 2016",
      },
    ],
    practitioners: [],
  },
  {
    id: "skills",
    title: "Cross-Cutting Communication Skills",
    blurb:
      "The foundational sources Cognify draws on for each of the six trainable dimensions, grouped into Content (clarity, structure, relevance) and Delivery (confidence, pacing, tone).",
    staples: [
      {
        name: "Strunk & White",
        work: "The Elements of Style",
        year: "1918 / 1959",
      },
      {
        name: "George Orwell",
        work: "Politics and the English Language",
        year: "1946",
      },
      {
        name: "William Zinsser",
        work: "On Writing Well",
        year: "1976",
      },
      {
        name: "Steven Pinker",
        work: "The Sense of Style",
        year: "2014",
      },
      {
        name: "Elizabeth Shriberg",
        work: "Speech disfluency research (SRI, Microsoft Research)",
        year: "1994–",
        note: "Foundational work on filler-word taxonomy and disfluency rates.",
      },
      {
        name: "Amy Cuddy",
        work: "Presence",
        year: "2015",
      },
      {
        name: "Daniel Kahneman",
        work: "Thinking, Fast and Slow",
        year: "2011",
      },
      {
        name: "Dan Pink",
        work: "To Sell Is Human",
        year: "2012",
      },
      {
        name: "Deborah Tannen",
        work: "That's Not What I Meant!, You Just Don't Understand",
        year: "1986 / 1990",
        note: "Sociolinguistic foundation for register and pragmatics.",
      },
    ],
    practitioners: [],
  },
];

function SourceCard({ source }: { source: Source }) {
  return (
    <li className="flex flex-col">
      <span className="text-sm font-semibold text-ink-900">
        {source.name}
        {source.year && (
          <span className="ml-2 text-xs font-normal text-ink-400">
            {source.year}
          </span>
        )}
      </span>
      {source.work && (
        <span className="mt-0.5 text-xs italic text-ink-600">
          {source.work}
        </span>
      )}
      {source.note && (
        <span className="mt-1 text-xs leading-relaxed text-ink-500">
          {source.note}
        </span>
      )}
    </li>
  );
}

export default function ReferencesPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-4xl px-6 pb-10 pt-24 md:pt-32">
        <Link
          href="/about"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="size-3.5" />
          Back to About
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="brand-gradient grid size-12 place-items-center rounded-xl">
            <BookOpen className="size-6 text-white" aria-hidden="true" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            References &amp; Sources
          </span>
        </div>
        <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[64px] md:leading-[1.05]">
          What Cognify is <span className="brand-gradient-text">built on</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
          Cognify's training methodology is grounded in decades of research and
          the current generation of practitioners teaching communication at the
          highest level. We treat sourcing as load-bearing — every framework,
          every skill dimension, every domain in our knowledge base cites the
          authors and practitioners behind it.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-500">
          <strong className="text-ink-700">Cognify uses ideas.</strong>{" "}
          All content on the platform is original synthesis. Frameworks and
          research findings are in the public domain as intellectual concepts;
          short attributed quotes used for educational commentary fall under
          fair use. No long verbatim passages from any copyrighted work are
          reproduced. This page exists so every source gets the credit it's
          owed.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.id}
              id={pillar.id}
              className="surface-card overflow-hidden"
            >
              <div className="brand-gradient h-1" aria-hidden="true" />
              <div className="p-7">
                <h2 className="text-xl font-bold tracking-tight text-ink-900">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  {pillar.blurb}
                </p>

                {pillar.staples.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                      Staple sources
                    </p>
                    <ul className="mt-3 space-y-3">
                      {pillar.staples.map((s) => (
                        <SourceCard key={`${pillar.id}-s-${s.name}-${s.work ?? ""}`} source={s} />
                      ))}
                    </ul>
                  </div>
                )}

                {pillar.practitioners.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                      Current practitioners (2020–2026)
                    </p>
                    <ul className="mt-3 space-y-3">
                      {pillar.practitioners.map((s) => (
                        <SourceCard key={`${pillar.id}-p-${s.name}-${s.work ?? ""}`} source={s} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          Rigor is the product.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-600">
          Every rep you run in Cognify is scored against this body of
          knowledge. Every callout cites its source. Every framework is traced
          to the author who introduced it. This is why we can show
          measurable improvement — the rubric is explainable all the way down.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <GradientButton href="/how-it-works" size="lg">
            How the scoring works
          </GradientButton>
          <Link
            href="/about"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
          >
            Back to About
          </Link>
        </div>
        <p className="mt-10 text-xs text-ink-400">
          If you believe a source should be credited here and isn't, or if any
          attribution needs correction, contact the team.
        </p>
      </section>
    </>
  );
}
