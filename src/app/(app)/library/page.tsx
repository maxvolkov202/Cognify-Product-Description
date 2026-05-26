import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Mic,
  PlayCircle,
  Trophy,
  Users,
} from "lucide-react";
import { getOgImageUrl, faviconForUrl } from "@/lib/library/og-image";
import { LibraryTypographicHero } from "@/components/product/LibraryTypographicHero";

export const metadata: Metadata = {
  title: "Library · Cognify",
  description:
    "Curated examples of strong communication. Watch the moves before you train them.",
};

type Item = {
  title: string;
  source: string;
  why: string;
  url: string;
  kind: "talk" | "story" | "guide";
};

type Section = {
  id: string;
  title: string;
  blurb: string;
  icon: typeof BookOpen;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    id: "speeches",
    title: "Great speeches and talks",
    blurb:
      "Watch the structure, not just the delivery. Notice how every great speaker leads with the headline.",
    icon: Trophy,
    items: [
      {
        title: "The 110 techniques of communication and public speaking",
        source: "David JP Phillips, TEDx",
        why: "A working catalog of the moves you can train rep by rep.",
        url: "https://www.ted.com/talks/david_jp_phillips_the_110_techniques_of_communication_and_public_speaking",
        kind: "talk",
      },
      {
        title: "How to speak so that people want to listen",
        source: "Julian Treasure, TED",
        why: "Tone, pace, register. The how-you-say-it canon.",
        url: "https://www.youtube.com/watch?v=eIho2S0ZahI",
        kind: "talk",
      },
      {
        title: "Think Faster, Talk Smarter",
        source: "Matt Abrahams, Stanford GSB",
        why: "The exact methodology Cognify's impromptu reps build on.",
        url: "https://www.youtube.com/watch?v=-FOCpMAww28",
        kind: "talk",
      },
      {
        title: "Make body language your superpower",
        source: "Stanford GSB",
        why: "Gesture and posture cues that move authority signals.",
        url: "https://www.youtube.com/watch?v=cvIdPMmuptU",
        kind: "talk",
      },
    ],
  },
  {
    id: "executive",
    title: "How CEOs and executives speak",
    blurb:
      "Communication is what gets you in the room and what keeps you there.",
    icon: Mic,
    items: [
      {
        title: "You're a CEO. Now how do you speak like one?",
        source: "Genard Method",
        why: "What changes when the audience expects authority by default.",
        url: "https://www.genardmethod.com/blog/youre-a-ceo.-now-how-do-you-speak-like-one",
        kind: "guide",
      },
      {
        title: "Public speaking tips for leaders",
        source: "Monster Hiring",
        why: "Translate the high-level moves into the meeting you have tomorrow.",
        url: "https://hiring.monster.com/resources/workforce-management/leadership-management-skills/public-speaking-tips/",
        kind: "guide",
      },
      {
        title: "Steve Jobs' 2005 Stanford commencement address",
        source: "YouTube",
        why: "Three stories, no slides. Structure as the entire performance.",
        url: "https://www.youtube.com/watch?v=UQrBWH2rews",
        kind: "talk",
      },
      {
        title: "Simon Sinek on leadership communication",
        source: "YouTube",
        why: "Why leading with the why outperforms leading with the what.",
        url: "https://www.youtube.com/watch?v=k-zMRPZpvcw",
        kind: "talk",
      },
    ],
  },
  {
    id: "negotiation",
    title: "Negotiation under pressure",
    blurb:
      "Tactical communication when every word changes the outcome.",
    icon: Users,
    items: [
      {
        title: "Negotiation examples that actually moved the needle",
        source: "Procurement Tactics",
        why: "Real cases where the right phrase unlocked a stuck deal.",
        url: "https://procurementtactics.com/negotiation-examples/",
        kind: "story",
      },
      {
        title: "Tactical empathy in action",
        source: "Chris Voss, MasterClass clips",
        why: "Labeling, mirroring, calibrated questions. The Cognify Adapt rep in the wild.",
        url: "https://www.youtube.com/watch?v=hi6i8cwfE68",
        kind: "talk",
      },
      {
        title: "Communication that closed the deal",
        source: "YouTube",
        why: "Stories of where one beat in the conversation flipped the outcome.",
        url: "https://www.youtube.com/watch?v=DZntD2KEJs0",
        kind: "story",
      },
    ],
  },
  {
    id: "structure",
    title: "Frameworks behind the rubric",
    blurb:
      "The thinking scaffolds Cognify scores you against. Worth a rewatch.",
    icon: BookOpen,
    items: [
      {
        title: "How to find your own voice",
        source: "Mel Robbins",
        why: "Vocal presence and tone when the room shifts.",
        url: "https://www.youtube.com/watch?v=iJq-thyDF9Q",
        kind: "talk",
      },
      {
        title: "How to give a great speech",
        source: "TED-Ed",
        why: "The Main + 3 + Close shape rendered in 4 minutes.",
        url: "https://www.youtube.com/watch?v=F0UW99pyCLk",
        kind: "talk",
      },
      {
        title: "Why some communicators get heard",
        source: "Nancy Duarte, TED",
        why: "Story shape as a load-bearing communication tool.",
        url: "https://www.youtube.com/watch?v=nWUmjFpKkqo",
        kind: "talk",
      },
      {
        title: "Public speaking under pressure",
        source: "YouTube",
        why: "How to keep structure when adrenaline tries to flatten it.",
        url: "https://www.youtube.com/watch?v=bsxJVgb6Kls",
        kind: "talk",
      },
    ],
  },
];

const KIND_LABEL: Record<Item["kind"], string> = {
  talk: "Talk",
  story: "Story",
  guide: "Guide",
};

/** Extract a video thumbnail from a YouTube or TED url, or null when the
 *  source isn't a known video host (so we render the no-thumbnail card). */
function thumbnailFor(url: string): string | null {
  try {
    const u = new URL(url);
    // youtube.com/watch?v=...
    if (u.hostname.includes("youtube.com") && u.searchParams.has("v")) {
      const id = u.searchParams.get("v");
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    // youtu.be/<id>
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    // youtube.com/embed/<id>
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) {
      const id = u.pathname.replace("/embed/", "");
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {
    return null;
  }
  return null;
}

// Module-scope memo for the 15-item OG-image fetch. The SECTIONS array
// is static, so the result is stable for the process lifetime; promise-
// caching here means /library only pays the 15 fetches on the first
// render after a deploy (audit PR-12 follow-up).
let ogMapPromise: Promise<Map<string, string | null>> | null = null;
function buildOgMap(): Promise<Map<string, string | null>> {
  if (ogMapPromise) return ogMapPromise;
  const allItems = SECTIONS.flatMap((s) =>
    s.items.map((it) => ({ url: it.url, sectionId: s.id })),
  );
  ogMapPromise = Promise.allSettled(
    allItems.map(async (it) => {
      if (thumbnailFor(it.url)) return [it.url, null] as const;
      return [it.url, await getOgImageUrl(it.url)] as const;
    }),
  ).then((settled) => {
    const out = new Map<string, string | null>();
    for (const r of settled) {
      if (r.status === "fulfilled") out.set(r.value[0], r.value[1]);
    }
    return out;
  });
  return ogMapPromise;
}

export default async function LibraryPage() {
  const ogMap = await buildOgMap();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
      <header className="mb-10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
          Cognify Library
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-5xl dark:text-white">
          Watch what good looks like.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-500 dark:text-ink-400">
          A small, curated set of talks, stories, and guides from people who have spent careers studying how communication works. The reps build the muscle. These build the taste.
        </p>
      </header>

      <div className="space-y-10">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id}>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="brand-gradient grid size-8 place-items-center rounded-2xl">
                    <Icon className="size-4 text-white" strokeWidth={2.5} />
                  </span>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
                      {section.title}
                    </h2>
                    <p className="text-[12px] text-ink-500 dark:text-ink-400">{section.blurb}</p>
                  </div>
                </div>
              </div>
              <ul className="grid gap-4 md:grid-cols-2">
                {section.items.map((item) => {
                  const thumb = thumbnailFor(item.url);
                  const ogImage = !thumb ? ogMap.get(item.url) ?? null : null;
                  const heroImage = thumb ?? ogImage;
                  const isVideo = !!thumb;
                  return (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 hover:shadow-[0_18px_44px_-18px_rgba(176,114,255,0.45)] dark:border-ink-700 dark:bg-ink-900"
                      >
                        {heroImage ? (
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-900">
                            <Image
                              src={heroImage}
                              alt=""
                              fill
                              sizes="(min-width: 768px) 50vw, 100vw"
                              unoptimized
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            />
                            <div
                              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent"
                              aria-hidden="true"
                            />
                            {isVideo && (
                              <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <PlayCircle
                                  className="size-14 text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
                                  strokeWidth={1.5}
                                />
                              </div>
                            )}
                            <div className="absolute left-3 top-3 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                                {KIND_LABEL[item.kind]}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <LibraryTypographicHero
                              title={item.title}
                              source={item.source}
                              faviconUrl={faviconForUrl(item.url)}
                              sectionId={section.id}
                            />
                            <div className="absolute left-3 top-3">
                              <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-700 backdrop-blur dark:border-ink-700 dark:bg-ink-900/90 dark:text-ink-200">
                                {KIND_LABEL[item.kind]}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-1 flex-col gap-1.5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold tracking-tight text-ink-900 dark:text-white">
                              {item.title}
                            </p>
                            <ArrowUpRight
                              className="size-4 shrink-0 text-ink-400 transition-colors group-hover:text-brand-purple dark:text-ink-500 dark:group-hover:text-brand-lavender"
                              strokeWidth={2.5}
                            />
                          </div>
                          <p className="text-[11px] font-semibold text-ink-500 dark:text-ink-400">
                            {item.source}
                          </p>
                          <p className="text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                            {item.why}
                          </p>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-16 rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-brand-lavender/5 to-brand-magenta/5 p-6 md:p-8 dark:border-ink-700 dark:from-ink-900 dark:via-brand-lavender/10 dark:to-brand-magenta/10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
          From taste to reps
        </p>
        <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
          Watch one. Train one.
        </h3>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          Pick a talk above. Notice the move you want to steal. Then run a Daily Workout or open the Skill Lab and put that move into your body.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/workout"
            className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            Start Daily Workout
          </Link>
          <Link
            href="/skill-lab"
            className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-white px-5 py-2.5 text-sm font-bold text-brand-purple dark:bg-ink-900 dark:text-brand-lavender"
          >
            Open Skill Lab
          </Link>
        </div>
      </section>
    </div>
  );
}
