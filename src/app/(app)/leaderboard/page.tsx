import { LeaderboardTable } from "@/components/product/LeaderboardTable";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { Trophy, Flame } from "lucide-react";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Sarah K.", composite: 94, streak: 42, reps: 28, delta: 5, team: "Acme Sales" },
  { rank: 2, name: "Varun P.", composite: 92, streak: 31, reps: 24, delta: 3, team: "Consulting Associates" },
  { rank: 3, name: "Priya R.", composite: 89, streak: 18, reps: 19, delta: -1, team: "University Career Center" },
  { rank: 4, name: "James L.", composite: 87, streak: 12, reps: 21, delta: 7, team: "Acme Sales" },
  { rank: 5, name: "Elena V.", composite: 85, streak: 22, reps: 26, delta: 2, team: "University Career Center" },
  { rank: 6, name: "Marcus T.", composite: 83, streak: 9, reps: 17, delta: 4, team: "Consulting Associates" },
  { rank: 7, name: "Aisha B.", composite: 82, streak: 15, reps: 20, delta: 1, team: "Acme Sales" },
  { rank: 8, name: "Oliver S.", composite: 80, streak: 7, reps: 14, delta: 6, team: "Acme Sales" },
  { rank: 9, name: "Mei L.", composite: 79, streak: 11, reps: 18, delta: 0, team: "University Career Center" },
  { rank: 10, name: "Jackson R.", composite: 78, streak: 5, reps: 12, delta: -2, team: "Consulting Associates" },
  { rank: 11, name: "Sofia M.", composite: 76, streak: 8, reps: 15, delta: 3, team: "Acme Sales" },
  { rank: 12, name: "Tomás G.", composite: 74, streak: 4, reps: 11, delta: 2, team: "Consulting Associates" },
  { rank: 13, name: "Hana K.", composite: 72, streak: 6, reps: 13, delta: 1, team: "University Career Center" },
  { rank: 14, name: "Noah D.", composite: 70, streak: 3, reps: 9, delta: -1, team: "Acme Sales" },
  { rank: 15, name: "Chloe W.", composite: 68, streak: 5, reps: 10, delta: 4, team: "University Career Center" },
] as const;

const TOP_STREAK = { name: "Sarah K.", streak: 42 };
const BIGGEST_CLIMB = { name: "James L.", delta: 7 };

export default function LeaderboardPage() {
  const top3 = MOCK_LEADERBOARD.slice(0, 3);


  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8">
        <DemoBanner
          message="This leaderboard shows sample names and scores so you can see the format. Real rankings activate once Cognify has a cohort of trained users to compare against."
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Leaderboard
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          The gym&rsquo;s best this week.
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600">
          Ranked by composite score across all six dimensions. Clarity compounds — and
          so does the gap between people who train and people who don&rsquo;t.
        </p>
      </div>

      <div className="mt-8 flex gap-2">
        <FilterChip active>Global</FilterChip>
        <FilterChip>This week</FilterChip>
        <FilterChip>My team</FilterChip>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {top3.map((entry, i) => (
          <PodiumCard key={entry.rank} entry={entry} position={i} />
        ))}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <HighlightCard
          icon={<Flame className="size-5 text-white" />}
          label="Longest streak"
          name={TOP_STREAK.name}
          value={`${TOP_STREAK.streak} days`}
        />
        <HighlightCard
          icon={<Trophy className="size-5 text-white" />}
          label="Biggest climb this week"
          name={BIGGEST_CLIMB.name}
          value={`+${BIGGEST_CLIMB.delta} points`}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Full rankings
        </h2>
        <div className="mt-4">
          <LeaderboardTable entries={MOCK_LEADERBOARD} />
        </div>
      </div>

    </div>
  );
}

function FilterChip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
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
  entry: (typeof MOCK_LEADERBOARD)[number];
  position: number;
}) {
  const heights = ["h-44", "h-40", "h-36"];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div
      className={`surface-card relative flex flex-col justify-end overflow-hidden p-6 ${heights[position] ?? "h-36"}`}
    >
      <div className="brand-gradient absolute inset-x-0 top-0 h-1" aria-hidden="true" />
      <div className="text-4xl">{medals[position]}</div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        #{entry.rank} · {entry.team}
      </div>
      <div className="mt-1 text-lg font-extrabold text-ink-900">{entry.name}</div>
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
