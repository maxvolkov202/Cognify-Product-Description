// App Router renders this as a Suspense fallback for /leaderboard while
// the four parallel queries (global, this_week, team, userInTeam) settle.
// Pre-fix the page blocked render entirely (audit UX-6).
export default function LeaderboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="h-7 w-40 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />
      <div className="mt-2 h-4 w-60 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-full bg-ink-100 dark:bg-ink-800"
          />
        ))}
      </div>
      <ul className="mt-8 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <li
            key={i}
            className="h-14 animate-pulse rounded-xl border border-ink-100 bg-ink-50 dark:border-ink-800 dark:bg-ink-900"
          />
        ))}
      </ul>
    </div>
  );
}
