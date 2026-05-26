export default function FriendsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="h-7 w-28 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-ink-100 bg-ink-50 dark:border-ink-800 dark:bg-ink-900"
          />
        ))}
      </div>
    </div>
  );
}
