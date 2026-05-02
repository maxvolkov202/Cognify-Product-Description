import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import {
  ACHIEVEMENTS,
  type Achievement,
} from "@/lib/engagement/achievements";
import { getUserAchievements } from "@/lib/engagement/achievement-rules";
import { cn } from "@/lib/utils/cn";

export const metadata = {
  title: "Achievements · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BUCKET_LABELS: Record<Achievement["bucket"], string> = {
  volume: "Volume",
  skill: "Skill",
  streak: "Streak",
  exploration: "Exploration",
};

const TIER_STYLES: Record<NonNullable<Achievement["tier"]>, string> = {
  bronze: "border-amber-700/30 bg-amber-50 text-amber-800",
  silver: "border-ink-300 bg-ink-50 text-ink-700",
  gold: "border-yellow-500/40 bg-yellow-50 text-yellow-800",
  platinum: "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
};

export default async function AchievementsPage() {
  const me = await currentUser();
  if (!me) notFound();

  const earned = await getUserAchievements(me.id);
  const earnedMap = new Map(earned.map((e) => [e.id, e.earnedAt]));

  const totalUnlocked = earned.length;
  const total = ACHIEVEMENTS.length;

  // Bucket the achievements for grouped rendering.
  const buckets: Record<Achievement["bucket"], Achievement[]> = {
    volume: [],
    skill: [],
    streak: [],
    exploration: [],
  };
  for (const a of ACHIEVEMENTS) buckets[a.bucket].push(a);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.5} />
        Dashboard
      </Link>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
            Earnable
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Achievements
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Permanent earnable milestones across volume, skill, streak, and
            exploration. Some are easy, some take a year. The set is finite —
            collect them all.
          </p>
        </div>
        <div className="hidden text-right md:block">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
            Unlocked
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink-900">
            {totalUnlocked}
            <span className="ml-2 text-base font-bold text-ink-500">
              / {total}
            </span>
          </p>
        </div>
      </div>

      {(["volume", "skill", "streak", "exploration"] as const).map((bucket) => {
        const items = buckets[bucket];
        if (items.length === 0) return null;
        const unlockedHere = items.filter((a) => earnedMap.has(a.id)).length;
        return (
          <section key={bucket} className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-500">
                {BUCKET_LABELS[bucket]}
              </h2>
              <p className="text-[11px] tabular-nums text-ink-400">
                {unlockedHere} / {items.length}
              </p>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {items.map((a) => {
                const earnedAt = earnedMap.get(a.id);
                const unlocked = earnedAt != null;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "rounded-2xl border p-4 transition",
                      unlocked
                        ? "border-ink-200 bg-white"
                        : "border-dashed border-ink-200 bg-ink-50/40 opacity-80",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full",
                          unlocked
                            ? a.tier
                              ? TIER_STYLES[a.tier]
                              : "bg-brand-purple/10 text-brand-purple border border-brand-purple/30"
                            : "border border-ink-200 bg-ink-100 text-ink-400",
                        )}
                      >
                        {unlocked ? (
                          <CheckCircle2
                            className="size-4"
                            strokeWidth={2.5}
                            aria-label="Unlocked"
                          />
                        ) : (
                          <Lock
                            className="size-3.5"
                            strokeWidth={2.5}
                            aria-label="Locked"
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-extrabold",
                            unlocked ? "text-ink-900" : "text-ink-600",
                          )}
                        >
                          {a.name}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                          {a.description}
                        </p>
                        {unlocked && earnedAt && (
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
                            Earned {formatDate(earnedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
