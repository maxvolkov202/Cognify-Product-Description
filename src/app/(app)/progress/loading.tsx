// Suspense fallback for /progress while the 8-query Promise.all settles.
export default function ProgressLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-12">
      <div className="h-7 w-32 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl border border-ink-100 bg-ink-50 dark:border-ink-800 dark:bg-ink-900"
          />
        ))}
      </div>
    </div>
  );
}
