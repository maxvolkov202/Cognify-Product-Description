import { Flame } from "lucide-react";
import { RankBadge } from "@/components/product/progression/RankBadge";
import type { RankInfo } from "@/lib/progression/rank";

type Entry = {
  rank: number;
  name: string;
  composite: number;
  /** Lifetime XP — shown instead of composite on the XP/Rank board. */
  xp?: number;
  streak: number;
  reps: number;
  team: string;
  /** PRD §10.5.1 — permanent Cognify Rank badge data (from lifetime XP). */
  rankBadge?: {
    label: string;
    tierColor: string;
    rankIndex: number;
    divisionRoman: RankInfo["divisionRoman"];
  };
};

type Props = {
  entries: readonly Entry[];
  /** Render the Cognify Rank shield next to names (FF_RANK_SYSTEM on). */
  showRank?: boolean;
  /** Show lifetime XP as the value column instead of composite (rank board). */
  showXp?: boolean;
};

export function LeaderboardTable({
  entries,
  showRank = false,
  showXp = false,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 dark:border-ink-700">
      <table className="w-full">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:bg-ink-900 dark:text-ink-400">
          <tr>
            <th className="px-6 py-4 text-left">Rank</th>
            <th className="px-6 py-4 text-left">Name</th>
            <th className="hidden px-6 py-4 text-left md:table-cell">Team</th>
            <th className="px-4 py-4 text-right">{showXp ? "XP" : "Composite"}</th>
            <th className="hidden px-4 py-4 text-right sm:table-cell">Streak</th>
            <th className="hidden px-4 py-4 text-right sm:table-cell">Reps</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={e.rank}
              className={`text-sm ${i % 2 === 0 ? "bg-white dark:bg-ink-950" : "bg-ink-50/40 dark:bg-ink-900/40"} border-t border-ink-200 dark:border-ink-700`}
            >
              <td className="px-6 py-4">
                <span className="brand-gradient-text text-lg font-extrabold tabular-nums">
                  #{e.rank}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} />
                  <span className="font-semibold text-ink-900 dark:text-white">{e.name}</span>
                  {showRank && e.rankBadge && (
                    <span
                      className="inline-flex items-center gap-1"
                      title={e.rankBadge.label}
                    >
                      <RankBadge rank={e.rankBadge} size={20} />
                      <span
                        className="hidden text-[11px] font-bold md:inline"
                        style={{ color: e.rankBadge.tierColor }}
                      >
                        {e.rankBadge.label}
                      </span>
                    </span>
                  )}
                </div>
              </td>
              <td className="hidden px-6 py-4 text-ink-600 md:table-cell dark:text-ink-300">{e.team}</td>
              <td className="px-4 py-4 text-right">
                <span className="text-lg font-extrabold tabular-nums text-ink-900 dark:text-white">
                  {showXp ? (e.xp ?? 0).toLocaleString() : e.composite}
                </span>
              </td>
              <td className="hidden px-4 py-4 text-right sm:table-cell">
                <span className="inline-flex items-center gap-1 text-xs text-ink-600 dark:text-ink-300">
                  <Flame className="size-3 text-brand-purple" />
                  {e.streak}
                </span>
              </td>
              <td className="hidden px-4 py-4 text-right text-xs text-ink-600 sm:table-cell dark:text-ink-300">
                {e.reps}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="brand-gradient grid size-8 place-items-center rounded-full text-xs font-bold text-white">
      {initial}
    </div>
  );
}
