"use client";

// PRD v3 Phase 6 — the unified completion celebration (PRD §10.8).
//
// One strip mounted on EVERY completion surface (Daily Workout day
// complete, Skill Lab session complete, Build a Rep readiness review):
// current Rank badge + progress toward the next rank, streak, today's
// achievements, and weekly-challenge progress. Self-fetching so hosts
// mount it unconditionally — the server action returns null when
// FF_RANK_SYSTEM is off and the strip renders nothing (legacy safe).
//
// This kills the toast-vs-screen split: saveRep's progression results
// used to be computed and silently dropped; this is the consumer.

import { useEffect, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  getProgressionSummary,
  type ProgressionSummary,
} from "@/server/actions/progression";
import { RankBadge } from "./RankBadge";

export default function ProgressionStrip({
  className,
}: {
  className?: string;
}) {
  const [summary, setSummary] = useState<ProgressionSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProgressionSummary().then((s) => {
      if (!cancelled && s) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;
  const { rank } = summary;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm",
        className,
      )}
      data-testid="progression-strip"
    >
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {rank.label}
            </span>
            {rank.nextLabel && (
              <span className="text-[11px] text-slate-400 dark:text-ink-500">
                next: {rank.nextLabel}
              </span>
            )}
            {summary.streakDays > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                <Flame className="w-3.5 h-3.5" /> {summary.streakDays}
              </span>
            )}
          </div>
          {/* §10.5.2 — progress bar, never raw XP numbers. */}
          <div
            className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(rank.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress toward ${rank.nextLabel ?? "max rank"}`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(3, Math.round(rank.progress * 100))}%`,
                backgroundColor: rank.tierColor,
              }}
            />
          </div>
        </div>
      </div>

      {summary.achievementsToday.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summary.achievementsToday.map((a) => (
            <span
              key={a.id}
              title={a.description}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300"
            >
              <Trophy className="w-3 h-3" /> {a.name}
            </span>
          ))}
        </div>
      )}

      {summary.weeklyChallenges.length > 0 && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {summary.weeklyChallenges.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-lg border px-2.5 py-1.5",
                c.completed
                  ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30"
                  : "border-slate-100 dark:border-ink-800",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-ink-300 truncate">
                  {c.title}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-ink-400">
                  {c.progress}/{c.target}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.completed ? "bg-emerald-500" : "bg-purple-400",
                  )}
                  style={{
                    width: `${Math.round((c.progress / c.target) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
