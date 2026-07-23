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
  /** PRD v3 Phase 6 (§10.9) — Overall Communication Score board ("Top
   *  communicators"). When provided (FF_RANK_SYSTEM) it doubles as the
   *  global board and the fairness-focused tab set turns on. */
  commScore?: LeaderboardBoard | null;
  /** All-time board ranked by lifetime XP (Cognify Rank / seniority) —
   *  the fairest default: one lucky rep can't top it. Its presence is the
   *  v2 (FF_RANK_SYSTEM) signal. */
  rankBoard?: LeaderboardBoard | null;
};

type TabId = LeaderboardScope | "comm_score" | "rank";

export function LeaderboardTabs({
  global,
  thisWeek,
  team,
  userInTeam,
  commScore = null,
  rankBoard = null,
}: Props) {
  const v2 = rankBoard != null;
  // The XP / Cognify Rank board opens by default — it's the fairest board
  // (lifetime XP rewards seniority + sustained training, so a single lucky
  // high-scoring rep can't jump to #1), so it's the first chip too. "Top
  // communicators" (Overall Communication Score) is the all-comers global
  // board — no separate "Global" tab. Weekly-improvement is off for now.
  const [scope, setScope] = useState<TabId>(v2 ? "rank" : "global");

  const tabs: { id: TabId; label: string }[] = v2
    ? [
        { id: "rank" as const, label: "By rank" },
        { id: "comm_score" as const, label: "Top communicators" },
        { id: "team" as const, label: "My team" },
      ]
    : [
        { id: "global" as const, label: "Global" },
        { id: "this_week" as const, label: "This week" },
        { id: "team" as const, label: "My team" },
      ];

  const activeBoard =
    scope === "rank"
      ? (rankBoard ?? global)
      : scope === "comm_score"
        ? (commScore ?? global)
        : scope === "global"
          ? global
          : scope === "this_week"
            ? thisWeek
            : team;
  const top3 = activeBoard.entries.slice(0, 3);

  // The rank board is sorted by XP, so it must DISPLAY xp (not composite) or
  // the value column would look out of order.
  const showXp = scope === "rank";

  const title =
    scope === "rank"
      ? "The gym's most seasoned."
      : scope === "comm_score"
        ? "The strongest communicators."
        : scope === "global"
          ? "The gym's best, all-time."
          : scope === "this_week"
            ? "The gym's best this week."
            : "Your team's leaders.";
  const subtitle =
    scope === "rank"
      ? "Ranked by total XP — your Cognify Rank. Seniority and sustained training win here, so one lucky high-scoring rep can't jump to the top."
      : scope === "comm_score"
        ? "Ranked by Overall Communication Score — Cognify's long-run estimate across all six Core Skills. The all-comers board."
        : scope === "global"
          ? "Ranked by average composite across all reps, all-time. Rewards a high average — even off a single strong rep."
          : scope === "this_week"
            ? "Ranked by average composite for the current ISO week (Monday → now). Weekly leaders rotate every Monday."
            : "Ranked by average composite within your team, all-time.";

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Leaderboard
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl dark:text-white">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600 dark:text-ink-300">{subtitle}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
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
          <div className="mt-10 grid gap-4 md:grid-cols-3 md:items-end">
            {top3.map((entry, i) => (
              <PodiumCard
                key={entry.userId}
                entry={entry}
                position={i}
                showXp={showXp}
              />
            ))}
          </div>

          <div className="mt-10">
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
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Full rankings
            </h2>
            <div className="mt-4">
              {/* Rank badge column is v2-only (FF_RANK_SYSTEM). */}
              <LeaderboardTable
                entries={activeBoard.entries}
                showRank={v2}
                showXp={showXp}
              />
            </div>

            {activeBoard.selfEntry &&
              !activeBoard.entries.some(
                (e) => e.userId === activeBoard.selfEntry!.userId,
              ) && (
                <div className="mt-5 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-4 dark:bg-brand-purple/10">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                    Your rank
                  </p>
                  <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
                    <strong className="text-ink-900 dark:text-white">
                      #{activeBoard.selfEntry.rank}
                    </strong>{" "}
                    ·{" "}
                    {showXp
                      ? `${activeBoard.selfEntry.xp.toLocaleString()} XP`
                      : `composite ${activeBoard.selfEntry.composite}`}{" "}
                    · {activeBoard.selfEntry.reps} rep
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
          : "rounded-full border border-ink-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-ink-600"
      }
    >
      {children}
    </button>
  );
}

function PodiumCard({
  entry,
  position,
  showXp = false,
}: {
  entry: {
    rank: number;
    name: string;
    team: string;
    composite: number;
    xp: number;
  };
  position: number;
  showXp?: boolean;
}) {
  const isFirst = position === 0;
  const heights = ["h-52", "h-40", "h-36"];
  // #1 sits in the middle column on desktop — classic podium arrangement.
  const orders = ["md:order-2", "md:order-1", "md:order-3"];
  const medals = [
    { color: "#eab308", numeral: "1", label: "Gold — 1st place" },
    { color: "#94a3b8", numeral: "2", label: "Silver — 2nd place" },
    { color: "#b45309", numeral: "3", label: "Bronze — 3rd place" },
  ];
  const medal = medals[position] ?? medals[2]!;
  return (
    <div
      className={`surface-card relative flex flex-col justify-end overflow-hidden p-6 ${heights[position] ?? "h-36"} ${orders[position] ?? ""} ${isFirst ? "shadow-[var(--shadow-glow-md)]" : ""}`}
    >
      <div
        className={`brand-gradient absolute inset-x-0 top-0 ${isFirst ? "h-1.5" : "h-1"}`}
        aria-hidden="true"
      />
      <span
        role="img"
        aria-label={medal.label}
        className={`grid place-items-center rounded-full font-extrabold text-white shadow-sm ${isFirst ? "size-11 text-lg" : "size-9 text-base"}`}
        style={{ backgroundColor: medal.color }}
      >
        {medal.numeral}
      </span>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        #{entry.rank} · {entry.team}
      </div>
      <div className="mt-1 text-lg font-extrabold text-ink-900 dark:text-white">
        {entry.name}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="brand-gradient-text text-3xl font-extrabold tabular-nums">
          {showXp ? entry.xp.toLocaleString() : entry.composite}
        </span>
        <span className="text-xs text-ink-500 dark:text-ink-400">
          {showXp ? "XP" : "composite"}
        </span>
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
        <p className="mt-1 text-xl font-extrabold text-ink-900 dark:text-white">{name}</p>
        <p className="brand-gradient-text text-lg font-extrabold">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({
  scope,
  userInTeam,
}: {
  scope: TabId;
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
          <h2 className="mt-4 text-2xl font-extrabold text-ink-900 md:text-3xl dark:text-white">
            You&rsquo;re not on a team yet.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 dark:text-ink-300">
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
        <h2 className="mt-4 text-2xl font-extrabold text-ink-900 md:text-3xl dark:text-white">
          {scope === "this_week"
            ? "No reps this week yet."
            : scope === "team"
              ? "No reps on your team yet this period."
              : "The board activates as users train."}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {scope === "this_week"
            ? "Run a Daily Workout to put yourself on this week's board."
            : "Once a few users log reps in this period, rankings show up here."}
        </p>
      </div>
    </div>
  );
}
