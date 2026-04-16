import Link from "next/link";
import { Users, TrendingUp } from "lucide-react";

const MOCK_TEAMS = [
  {
    id: "team-acme",
    name: "Acme Sales",
    seats: 24,
    activeSeats: 19,
    averageComposite: 74,
    deltaThisMonth: 8,
  },
  {
    id: "team-career-u",
    name: "University Career Center",
    seats: 180,
    activeSeats: 142,
    averageComposite: 68,
    deltaThisMonth: 12,
  },
  {
    id: "team-consulting",
    name: "Consulting Associates",
    seats: 42,
    activeSeats: 38,
    averageComposite: 81,
    deltaThisMonth: 5,
  },
] as const;

export default function TeamsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Admin · Teams
          </p>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Preview · demo data
          </span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Your teams.
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600">
          Every team&rsquo;s composite score, active seats, and monthly progress. Click
          through to see individual members and assign scenarios.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MOCK_TEAMS.map((team) => (
          <Link
            key={team.id}
            href={`/admin/teams/${team.id}` as never}
            className="surface-card group p-6 transition-shadow hover:shadow-[var(--shadow-glow)]"
          >
            <h2 className="text-xl font-extrabold text-ink-900">{team.name}</h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  Composite
                </p>
                <p className="brand-gradient-text mt-1 text-3xl font-extrabold tabular-nums">
                  {team.averageComposite}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  This month
                </p>
                <p className="mt-1 flex items-baseline gap-1 text-2xl font-extrabold tabular-nums text-success">
                  +{team.deltaThisMonth}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-ink-200 pt-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {team.activeSeats} / {team.seats} active
              </span>
              <span className="flex items-center gap-1.5 text-brand-purple">
                <TrendingUp className="size-3.5" />
                View
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
