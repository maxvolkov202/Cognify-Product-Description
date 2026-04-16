import { Flame, TrendingDown, TrendingUp, Minus } from "lucide-react";

type Entry = {
  rank: number;
  name: string;
  composite: number;
  streak: number;
  reps: number;
  delta: number;
  team: string;
};

type Props = {
  entries: readonly Entry[];
};

export function LeaderboardTable({ entries }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200">
      <table className="w-full">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          <tr>
            <th className="px-6 py-4 text-left">Rank</th>
            <th className="px-6 py-4 text-left">Name</th>
            <th className="hidden px-6 py-4 text-left md:table-cell">Team</th>
            <th className="px-4 py-4 text-right">Composite</th>
            <th className="hidden px-4 py-4 text-right sm:table-cell">Streak</th>
            <th className="hidden px-4 py-4 text-right sm:table-cell">Reps</th>
            <th className="px-4 py-4 text-right">Δ</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={e.rank}
              className={`text-sm ${i % 2 === 0 ? "bg-white" : "bg-ink-50/40"} border-t border-ink-200`}
            >
              <td className="px-6 py-4">
                <span className="brand-gradient-text text-lg font-extrabold tabular-nums">
                  #{e.rank}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} />
                  <span className="font-semibold text-ink-900">{e.name}</span>
                </div>
              </td>
              <td className="hidden px-6 py-4 text-ink-600 md:table-cell">{e.team}</td>
              <td className="px-4 py-4 text-right">
                <span className="text-lg font-extrabold tabular-nums text-ink-900">
                  {e.composite}
                </span>
              </td>
              <td className="hidden px-4 py-4 text-right sm:table-cell">
                <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                  <Flame className="size-3 text-brand-purple" />
                  {e.streak}
                </span>
              </td>
              <td className="hidden px-4 py-4 text-right text-xs text-ink-600 sm:table-cell">
                {e.reps}
              </td>
              <td className="px-4 py-4 text-right">
                <DeltaBadge delta={e.delta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-ink-400">
        <Minus className="size-3" />
        0
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-success">
        <TrendingUp className="size-3" />+{delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-danger">
      <TrendingDown className="size-3" />
      {delta}
    </span>
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
