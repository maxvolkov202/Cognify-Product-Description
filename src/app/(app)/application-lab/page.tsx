import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  GraduationCap,
  MessagesSquare,
  Presentation,
  Scale,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { communicationProfile } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { isSkillLabAppsEnabled } from "@/lib/flags";
import { currentUser } from "@/lib/session/current-user";
import { getCurrentSkillScores } from "@/lib/db/queries/progress";
import { SkillLabClient } from "@/components/product/SkillLabClient";
import {
  SKILL_DIMENSIONS,
  type SkillDimension,
} from "@/types/domain";
import {
  ALL_SUB_SKILLS,
  SUB_SKILL_TO_DIMENSION,
  type SubSkillId,
} from "@/types/sub-skills";
import {
  APPLICATION_DESCRIPTIONS,
  APPLICATION_IDS,
  APPLICATION_LABELS,
  type ApplicationId,
} from "@/types/application-skills";
import { APPLICATION_ACCENTS } from "@/lib/skill-lab/application-accents";

export const metadata: Metadata = {
  title: "Application Lab · Cognify",
  description:
    "Train real-world communication applications — Storytelling, Presenting, Teaching, Interviewing, Persuasion — with focused reps and coaching.",
};

export const dynamic = "force-dynamic";

const APPLICATION_ICONS: Record<
  ApplicationId,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  storytelling: BookOpen,
  presenting: Presentation,
  teaching: GraduationCap,
  interviewing: MessagesSquare,
  persuasion: Scale,
};

/**
 * Skill Lab (PRD v3 §6, D9).
 *
 * Flag ON: the PRD's application training environment — the user picks
 * WHAT to improve (Storytelling / Presenting / Teaching / Interviewing /
 * Persuasion); Cognify decides everything else. Dimension drills moved
 * to /drills (Daily Workout extras); old ?focus= deep-links redirect so
 * dashboard cards keep working unchanged.
 *
 * Flag OFF: the legacy dimension-drill Skill Lab, byte-identical.
 */
export default async function SkillLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialFocus = parseFocusParam(params.focus);
  const initialSubSkill = parseSubSkillParam(params.subSkill, initialFocus);

  if (isSkillLabAppsEnabled()) {
    // Legacy deep-links (WeakestLinkCard, SubSkillBreakdown, hero) drill
    // a Core Skill — that now lives at /drills.
    if (initialFocus) {
      redirect(
        `/drills?focus=${initialFocus}${initialSubSkill ? `&subSkill=${initialSubSkill}` : ""}`,
      );
    }
    return <ApplicationsHub />;
  }

  const user = await currentUser();
  const scores = user ? await getCurrentSkillScores(user.id) : null;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        <SkillLabClient
          currentScores={scores ?? {}}
          {...(initialFocus ? { initialFocus } : {})}
          {...(initialSubSkill ? { initialSubSkill } : {})}
        />
      </div>
    </div>
  );
}

async function ApplicationsHub() {
  const user = await currentUser();
  const appScores = user
    ? await safeDb(async () => {
        const [row] = await db
          .select({ applications: communicationProfile.applications })
          .from(communicationProfile)
          .where(eq(communicationProfile.userId, user.id))
          .limit(1);
        return row?.applications ?? {};
      }, {})
    : {};

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900">
      {/* Brand glow behind the hero — matches the dashboard's ambient accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_30%_0%,color-mix(in_srgb,var(--color-brand-lavender)_14%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        <header className="mb-8">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
            <FlaskConical className="size-3.5" strokeWidth={2.5} />
            Application Lab
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Master the{" "}
            <span className="bg-gradient-to-r from-brand-lavender to-fuchsia-500 bg-clip-text text-transparent">
              moments that matter
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-ink-300">
            Pick the communication application you want to improve. Cognify
            picks the exercises, coaching, and difficulty — and every session
            gets more personal as it learns how you perform.
          </p>
        </header>

        {/* 5 applications in a symmetric grid. On desktop we use a 6-col
            track so each card spans 2 columns (3 per row); the 4th card
            starts at column 2 so the trailing pair (Interviewing +
            Persuasion) centers under the top three instead of hugging the
            left edge. At sm the plain 2-col flow is unaffected. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {APPLICATION_IDS.map((appId, i) => {
            const Icon = APPLICATION_ICONS[appId];
            const est = appScores[appId];
            const accent = APPLICATION_ACCENTS[appId];
            return (
              <Link
                key={appId}
                href={`/application-lab/${appId}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg lg:col-span-2 ${i === 3 ? "lg:col-start-2" : ""} ${accent.hoverBorder}`}
              >
                {/* Per-application gradient wash, revealed on hover. */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${accent.wash}`}
                />
                {/* Gradient hairline across the card top. */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent.tile}`}
                />
                <div className="relative flex items-start justify-between">
                  <span
                    className={`inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${accent.tile} ${accent.glow}`}
                  >
                    <Icon className="size-5" strokeWidth={2.25} />
                  </span>
                  {est ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${accent.chip}`}
                    >
                      {Math.round(est.score)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      New
                    </span>
                  )}
                </div>
                <h2 className="relative mt-4 text-lg font-bold text-slate-900 dark:text-white">
                  {APPLICATION_LABELS[appId]}
                </h2>
                <p className="relative mt-1 flex-1 text-sm leading-relaxed text-slate-500 dark:text-ink-400">
                  {APPLICATION_DESCRIPTIONS[appId]}
                </p>
                <span
                  className={`relative mt-4 inline-flex items-center gap-1 text-sm font-semibold ${accent.link}`}
                >
                  Start training
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-slate-400 dark:text-ink-500">
          Every rep is scored on the six Core Skills — Application Lab trains
          how you apply them. Fundamentals live in your{" "}
          <Link
            href="/workout"
            className="inline-flex min-h-[44px] items-center -my-3 align-middle font-semibold text-purple-600 dark:text-brand-lavender hover:underline"
          >
            Daily Workout
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function parseFocusParam(
  value: string | string[] | undefined,
): SkillDimension | undefined {
  if (typeof value !== "string") return undefined;
  return (SKILL_DIMENSIONS as readonly string[]).includes(value)
    ? (value as SkillDimension)
    : undefined;
}

function parseSubSkillParam(
  value: string | string[] | undefined,
  forDim: SkillDimension | undefined,
): SubSkillId | undefined {
  if (typeof value !== "string") return undefined;
  if (!(ALL_SUB_SKILLS as readonly string[]).includes(value)) return undefined;
  const subSkill = value as SubSkillId;
  // Drop sub-skill if it doesn't belong to the focused dim — caller
  // probably built a malformed link or the dim was renamed since.
  if (forDim && SUB_SKILL_TO_DIMENSION[subSkill] !== forDim) return undefined;
  return subSkill;
}
