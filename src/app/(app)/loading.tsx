export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-ink-200" />
        <div className="h-10 w-80 animate-pulse rounded-lg bg-ink-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-full bg-ink-100" />
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <div className="surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-8">
            <div className="h-3 w-32 animate-pulse rounded-full bg-ink-200" />
            <div className="mt-4 h-8 w-64 animate-pulse rounded bg-ink-200" />
            <div className="mt-3 h-4 w-80 animate-pulse rounded-full bg-ink-100" />
            <div className="mt-6 h-12 w-40 animate-pulse rounded-full bg-ink-200" />
          </div>
        </div>
        <div className="surface-card p-6">
          <div className="h-3 w-20 animate-pulse rounded-full bg-ink-200" />
          <div className="mt-4 h-12 w-24 animate-pulse rounded bg-ink-200" />
          <div className="mt-3 h-3 w-32 animate-pulse rounded-full bg-ink-100" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface-card p-6">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-ink-200" />
            <div className="mt-4 h-5 w-32 animate-pulse rounded bg-ink-200" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded-full bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
