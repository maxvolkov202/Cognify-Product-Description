"use client";

import { useState } from "react";
import { Trophy, Flame, Users } from "lucide-react";
import { LeaderboardTable } from "@/components/product/LeaderboardTable";
import type {
  LeaderboardBoard,
  LeaderboardScope,
} from "@/lib/db/queries/leaderboard";

type Props = {
  global: LeaderboardBoard;
  thisWeek: LeaderboardBoard;
  team: LeaderboardBoard;
  /** True when the authenticated user is in at least one team. Drives
   *  the "My team" tab's empty-state copy — "no team yet" is different
   *  from "nobody on your team has reps yet". */
  userInTeam: boolean;
};

const TABS: { id: LeaderboardScope; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "this_week", label: "This week" },
  { id: "team", label: "My team" },
];

export function LeaderboardTabs({
  global,
  thisWeek,
  team,
  userInTeam,
}: Props) {
  const [scope, setScope] = useState<LeaderboardScope>("global");

  const activeBoard =
    scope === "global" ? global : scope === "this_week" ? thisWeek : team;
  const top3 = activeBoard.entries.slice(0, 3);

  const title =
    scope === "global"
      ? "The gym's best, last 30 days."
      : scope === "this_week"
        ? "The gym's best this week."
        : "Your team's leaders.";
  const subtitle =
    scope === "global"
      ? "Ranked by average composite across the last 30 days of reps. A fresh board — stop training and you fall off."
      : scope === "this_week"
        ? "Ranked by average composite for the current ISO week (Monday → now). Weekly leaders rotate every Monday."
        : "Ranked by average composite within your team over the last 30 days.";

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Leaderboard
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600">{subtitle}</p>
      </div>

      <div className="mt-8 flex gap-2">
        {TABS.map((t) => (
          <FilterChip
            key={t.id}
            active={scope === t.id}
            onClick={() => setScope(t.id)}
          >
            {t.label}
          </FilterChip>
        ))}
      </div>

      {activeBoard.entries.length === 0 ? (
        <EmptyState scope={scope} userInTeam={userInTeam} />
      ) : (
        <>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {top3.map((entry, i) => (
              <PodiumCard key={entry.userId} entry={entry} position={i} />
            ))}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <HighlightCard
              icon={<Flame className="size-5 text-white" />}
              label="Longest streak"
              name={activeBoard.topStreak?.name ?? "—"}
              value={
                activeBoard.topStreak
                  ? `${activeBoard.topStreak.streak} day${activeBoard.topStreak.streak === 1 ? "" : "s"}`
                  : "No streak yet"
              }
            />
            <HighlightCard
              icon={<Trophy className="size-5 text-white" />}
              label={
                scope === "this_week"
                  ? "Biggest climb this week"
                  : "Biggest climb vs last week"
              }
              name={activeBoard.biggestClimb?.name ?? "—"}
              value={
                activeBoard.biggestClimb
                  ? `+${activeBoard.biggestClimb.delta} points`
                  : "No climbs yet"
              }
            />
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Full rankings
            </h2>
            <div className="mt-4">
              <LeaderboardTable entries={activeBoard.entries} />
            </div>

            {activeBoard.selfEntry &&
              !activeBoard.entries.some(
                (e) => e.userId === activeBoard.selfEntry!.userId,
              ) && (
                <div className="mt-5 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                    Your rank
                  </p>
                  <p className="mt-1 text-sm text-ink-700">
                    <strong className="text-ink-900">
                      #{activeBoard.selfEntry.rank}
                    </strong>{" "}
                    · composite {activeBoard.selfEntry.composite} ·{" "}
                    {activeBoard.selfEntry.reps} rep
                    {activeBoard.selfEntry.reps === 1 ? "" : "s"} ·{" "}
                    {activeBoard.selfEntry.streak}-day streak
                  </p>
                </div>
              )}
          </div>
        </>
      )}
    </>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "brand-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
          : "rounded-full border border-ink-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-600 hover:border-ink-300"
      }
    >
      {children}
    </button>
  );
}

function PodiumCard({
  entry,
  position,
}: {
  entry: { rank: number; name: string; team: string; composite: number };
  position: number;
}) {
  const heights = ["h-44", "h-40", "h-36"];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div
      className={`surface-card relative flex flex-col justify-end overflow-hidden p-6 ${heights[position] ?? "h-36"}`}
    >
      <div
        className="brand-gradient absolute inset-x-0 top-0 h-1"
        aria-hidden="true"
      />
      <div className="text-4xl">{medals[position]}</div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        #{entry.rank} · {entry.team}
      </div>
      <div className="mt-1 text-lg font-extrabold text-ink-900">
        {entry.name}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="brand-gradient-text text-3xl font-extrabold tabular-nums">
          {entry.composite}
        </span>
        <span className="text-xs text-ink-500">composite</span>
      </div>
    </div>
  );
}

function HighlightCard({
  icon,
  label,
  name,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="surface-card flex items-center gap-5 p-6">
      <div className="brand-gradient grid size-12 shrink-0 place-items-center rounded-xl shadow-sm">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </p>
        <p className="mt-1 text-xl font-extrabold text-ink-900">{name}</p>
        <p className="brand-gradient-text text-lg font-extrabold">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({
  scope,
  userInTeam,
}: {
  scope: LeaderboardScope;
  userInTeam: boolean;
}) {
  if (scope === "team" && !userInTeam) {
    return (
      <div className="mt-10 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8 md:p-10 text-center">
          <Users
            className="mx-auto size-10 text-brand-purple"
            strokeWidth={2}
            aria-hidden="true"
          />
          <h2 className="mt-4 text-2xl font-extrabold text-ink-900 md:text-3xl">
            You&rsquo;re not on a team yet.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            Team rankings compare you against your coworkers or cohort —
            Cognify uses the team list from your org or university to show
            who&rsquo;s training hardest near you. Ask whoever runs your
            team&rsquo;s Cognify account to add you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-8 md:p-10 text-center">
        <Trophy
          className="mx-auto size-10 text-brand-purple"
          strokeWidth={2}
          aria-hidden="true"
        />
        <h2 className="mt-4 text-2xl font-extrabold text-ink-900 md:text-3xl">
          {scope === "this_week"
            ? "No reps this week yet."
            : scope === "team"
              ? "No reps on your team yet this period."
              : "The board activates as users train."}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          {scope === "this_week"
            ? "Run a Daily Workout to put yourself on this week's board."
            : "Once a few users log reps in this period, rankings show up here."}
        </p>
      </div>
    </div>
  );
}
