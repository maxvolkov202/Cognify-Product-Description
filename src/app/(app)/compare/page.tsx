import Link from "next/link";
import { currentUser } from "@/lib/session/current-user";
import { getRecentReps } from "@/lib/db/queries/progress";
import { GradientButton } from "@/components/shared/GradientButton";

export default async function ComparePage() {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const recent = await getRecentReps(userId, 50);

  const byPrompt = new Map<string, typeof recent>();
  for (const rep of recent) {
    const list = byPrompt.get(rep.promptText) ?? [];
    list.push(rep);
    byPrompt.set(rep.promptText, list);
  }

  const groups = Array.from(byPrompt.entries())
    .filter(([, reps]) => reps.length >= 2)
    .sort(([, a], [, b]) => b.length - a.length);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Rep comparison
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          See yourself improve.
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600">
          Compare multiple attempts on the same prompt side-by-side. Watch the scores
          climb, the filler rate drop, the structure tighten.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="mt-12 surface-card p-10 text-center">
          <h2 className="text-2xl font-extrabold text-ink-900">
            Run the same prompt twice to unlock this view.
          </h2>
          <p className="mt-3 text-sm text-ink-600">
            Comparison shines when you run the same prompt 3–5 times across a week.
            David&rsquo;s validation model: the user gets demonstrably better,
            provably.
          </p>
          <div className="mt-8">
            <GradientButton href="/workout" size="lg">
              Run a workout
            </GradientButton>
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {groups.map(([prompt, attempts]) => {
            const sorted = [...attempts].sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            );
            const first = sorted[0]!;
            const last = sorted[sorted.length - 1]!;
            const delta = last.compositeScore - first.compositeScore;
            return (
              <Link
                key={prompt}
                href={`/compare/${encodeURIComponent(prompt)}` as never}
                className="surface-card group block p-6 transition-shadow hover:shadow-[var(--shadow-glow)]"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {attempts.length} attempts
                </p>
                <h3 className="mt-1 text-lg font-bold text-ink-900 line-clamp-2">{prompt}</h3>
                <div className="mt-4 flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                      First
                    </p>
                    <p className="text-2xl font-extrabold text-ink-700 tabular-nums">
                      {Math.round(first.compositeScore)}
                    </p>
                  </div>
                  <span className="text-ink-400">→</span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                      Latest
                    </p>
                    <p className="brand-gradient-text text-2xl font-extrabold tabular-nums">
                      {Math.round(last.compositeScore)}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                      Delta
                    </p>
                    <p
                      className={`text-2xl font-extrabold tabular-nums ${delta >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {delta >= 0 ? "+" : ""}
                      {Math.round(delta)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
