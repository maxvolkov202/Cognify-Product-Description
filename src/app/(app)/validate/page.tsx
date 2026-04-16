import Link from "next/link";
import { currentUser } from "@/lib/session/current-user";
import { getUserValidations } from "@/lib/db/queries/validation";
import { GradientButton } from "@/components/shared/GradientButton";
import { ExternalLink, Users } from "lucide-react";

export default async function ValidatePage() {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const validations = await getUserValidations(userId);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          External validation
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Let unbiased listeners be the judge.
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600">
          Run multiple attempts on the same topic. Share a blind-ranking link.
          Unbiased listeners rank your reps in random order without seeing scores. You
          get a receipt of improvement independent of any AI judgment.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <GradientButton href="/validate/new" size="lg">
          Create a blind ranking
        </GradientButton>
        <Link
          href="/compare"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300"
        >
          Or see attempts to compare
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Your validations
        </h2>
        {validations.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-ink-200 p-10 text-center">
            <p className="text-sm text-ink-500">
              No validations yet. Run 2–5 attempts on the same prompt first, then
              create a blind ranking.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {validations.map((v) => (
              <li key={v.id} className="surface-card p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-ink-900">{v.topic}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {v.repIds.length} reps · created{" "}
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-600">
                    <Users className="size-3.5" />
                    <span>{v.rankingCount} rankings</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/validate/results/${v.token}` as never}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
                  >
                    Results
                  </Link>
                  <Link
                    href={`/validate/${v.token}` as never}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple/30 bg-brand-purple/5 px-3 py-1.5 text-xs font-semibold text-brand-purple hover:bg-brand-purple/10"
                  >
                    <ExternalLink className="size-3" />
                    Share /validate/{v.token.slice(0, 8)}…
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
