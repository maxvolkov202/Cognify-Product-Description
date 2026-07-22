import type React from "react";
import { Flame, Trophy, Swords, UserPlus } from "lucide-react";
import type { ActivityRow } from "@/lib/db/queries/activity";

/**
 * Shared friends live-feed row. Extracted verbatim from the inline
 * `RealActivityRow` in `app/(app)/friends/page.tsx` (Phase 0 of the UI +
 * Feature Overhaul Wave) so Phase 4 can mount the same row on the dashboard
 * without duplicating it. No behavior change — the friends page renders
 * identically after the extraction.
 *
 * `Avatar`, `initials`, and `relativeTime` are colocated here as the shared
 * home for the row's dependencies (the friends page imports them back).
 */

export function ActivityFeedRow({ row }: { row: ActivityRow }) {
  const icon: React.ReactNode = (() => {
    switch (row.payload.type) {
      case "workout_complete":
        return <Flame className="size-3.5 text-orange-500" />;
      case "new_high":
        return <Trophy className="size-3.5 text-amber-500" />;
      case "streak_milestone":
        return <Flame className="size-3.5 text-brand-purple dark:text-brand-lavender" />;
      case "challenge_win":
        return <Swords className="size-3.5 text-emerald-500" />;
      case "friend_joined":
        return <UserPlus className="size-3.5 text-blue-500" />;
    }
  })();

  const description: string = (() => {
    switch (row.payload.type) {
      case "workout_complete":
        return `Completed a workout — ${row.payload.composite} composite${
          row.payload.topDimension ? ` · strongest: ${row.payload.topDimension}` : ""
        }`;
      case "new_high":
        return `New personal best — ${row.payload.score} on ${row.payload.dimension}`;
      case "streak_milestone":
        return `Hit a ${row.payload.days}-day streak`;
      case "challenge_win":
        return `Won a challenge vs. ${row.payload.opponentName} — ${row.payload.score}`;
      case "friend_joined":
        return `Joined Cognify and ran their first rep`;
    }
  })();

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800">
      <Avatar initials={initials(row.userName)} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-semibold text-ink-800 dark:text-ink-100">
            {row.userName ?? "Someone"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-300">{description}</p>
      </div>
      <span className="shrink-0 text-[10px] text-ink-400 dark:text-ink-500">
        {relativeTime(row.createdAt)}
      </span>
    </div>
  );
}

// ——— Shared row dependencies ————————————————————————————————

export function Avatar({
  initials,
  size = "md",
  className = "",
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  };
  return (
    <div
      className={`brand-gradient grid shrink-0 place-items-center rounded-full font-bold text-white ${sizes[size]} ${className}`}
    >
      {initials}
    </div>
  );
}

export function initials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
