import { Flame } from "lucide-react";
import { RankBadge } from "@/components/product/progression/RankBadge";
import type { RankInfo } from "@/lib/progression/rank";

type Entry = {
  rank: number;
  name: string;
  composite: number;
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
  /** v2 (FF_RANK_SYSTEM): show a dedicated Cognify Rank column IN PLACE OF the
   *  composite value column. Off → show the composite column, no rank. */
  showRank?: boolean;
};

export function LeaderboardTable({ entries, showRank = false }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 dark:border-ink-700">
      <table className="w-full">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:bg-ink-900 dark:text-ink-400">
          <tr>
            <th className="px-6 py-4 text-left">#</th>
            <th className="px-6 py-4 text-left">Name</th>
            <th className="hidden px-6 py-4 text-left md:table-cell">Team</th>
            {showRank ? (
              <th className="px-4 py-4 text-left">Rank</th>
            ) : (
              <th className="px-4 py-4 text-right">Composite</th>
            )}
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
                </div>
              </td>
              <td className="hidden px-6 py-4 text-ink-600 md:table-cell dark:text-ink-300">{e.team}</td>
              {showRank ? (
                <td className="px-4 py-4">
                  {e.rankBadge ? (
                    <span
                      className="inline-flex items-center gap-1.5"
                      title={e.rankBadge.label}
                    >
                      <RankBadge rank={e.rankBadge} size={20} />
                      <span
                        className="text-xs font-bold"
                        style={{ color: e.rankBadge.tierColor }}
                      >
                        {e.rankBadge.label}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
              ) : (
                <td className="px-4 py-4 text-right">
                  <span className="text-lg font-extrabold tabular-nums text-ink-900 dark:text-white">
                    {e.composite}
                  </span>
                </td>
              )}
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
