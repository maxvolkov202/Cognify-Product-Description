// PRD v3 Phase 6 — Weekly + Team Challenges dashboard card (PRD §10.10,
// §10.11). Server component: replaces the weekly LeagueBoard under
// FF_RANK_SYSTEM (D4 fold — see dashboard/page.tsx).

import Link from "next/link";
import { ArrowRight, Swords, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { currentUser } from "@/lib/session/current-user";
import {
  getOrCreateThisWeekChallenges,
  getTeamChallenges,
} from "@/lib/db/queries/weekly-challenges";

export async function WeeklyChallengesCard() {
  const user = await currentUser();
  if (!user) return null;
  const [week, teamChallenges] = await Promise.all([
    getOrCreateThisWeekChallenges(user.id),
    getTeamChallenges(user.id),
  ]);
  if (!week || week.challenges.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Swords className="w-4 h-4 text-purple-600 dark:text-brand-lavender" />
          This week&apos;s challenges
        </h2>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-brand-lavender hover:underline min-h-[44px]"
        >
          Weekly leaderboard <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {week.challenges.map((c) => {
          const progress = Math.min(c.target, week.progress[c.id] ?? 0);
          const completed = week.completedIds.includes(c.id);
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border p-3",
                completed
                  ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30"
                  : "border-slate-100 dark:border-ink-800",
              )}
            >
              <div className="text-xs font-bold text-slate-800 dark:text-ink-100">
                {c.title}
                {completed && " ✓"}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-ink-400">
                {c.description}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      completed ? "bg-emerald-500" : "bg-purple-400",
                    )}
                    style={{
                      width: `${Math.round((progress / c.target) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-ink-400">
                  {progress}/{c.target}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {teamChallenges.length > 0 && (
        <div className="mt-3 space-y-2">
          {teamChallenges.map((t) => (
            <div
              key={t.teamId}
              className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-ink-800 px-3 py-2"
            >
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 dark:text-ink-100 truncate">
                  {t.teamName} — {t.title}
                  {t.completed && " ✓"}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      t.completed ? "bg-emerald-500" : "bg-purple-400",
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((t.progress / t.target) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-ink-400 shrink-0">
                {Math.min(t.progress, t.target)}/{t.target}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
