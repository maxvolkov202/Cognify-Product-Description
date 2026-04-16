import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Trophy, Users } from "lucide-react";
import {
  getValidationByToken,
  getValidationAggregation,
} from "@/lib/db/queries/validation";

export default async function ValidationResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validation = await getValidationByToken(token);
  if (!validation) notFound();

  const aggregation = await getValidationAggregation(validation.id, validation.repIds);
  const sorted = [...aggregation].sort((a, b) => a.averageRank - b.averageRank);
  const winner = sorted[0] ?? null;
  const winnerIndex = winner ? validation.repIds.indexOf(winner.repId) + 1 : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link
        href="/validate"
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" /> Back to validations
      </Link>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Validation results
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          {validation.topic}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-sm text-ink-600">
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {validation.rankingCount} listener{validation.rankingCount === 1 ? "" : "s"}
          </span>
          <span>Created {new Date(validation.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mt-6 surface-card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Share this public link with listeners
        </p>
        <div className="mt-2 flex items-center gap-3">
          <code className="flex-1 truncate rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">
            /validate/{validation.token}
          </code>
          <Link
            href={`/validate/${validation.token}` as never}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
          >
            <Copy className="size-3" />
            Open
          </Link>
        </div>
      </div>

      {validation.rankingCount === 0 ? (
        <div className="mt-10 surface-card p-10 text-center">
          <p className="text-lg font-bold text-ink-900">Waiting for rankings.</p>
          <p className="mt-2 text-sm text-ink-600">
            Share the link above with 3–5 unbiased listeners to get meaningful results.
          </p>
        </div>
      ) : (
        <>
          {winner && winnerIndex && (
            <div className="mt-10 surface-card overflow-hidden">
              <div className="brand-gradient h-1" aria-hidden="true" />
              <div className="flex items-center gap-6 p-8">
                <div className="brand-gradient grid size-16 place-items-center rounded-2xl">
                  <Trophy className="size-8 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    Clearest attempt
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-ink-900">
                    Attempt {winnerIndex}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">
                    {winner.firstPlace} of {validation.rankingCount} listeners ranked it
                    clearest. Average rank: {winner.averageRank.toFixed(2)}.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Full rankings
            </h2>
            <div className="mt-4 space-y-3">
              {sorted.map((agg, i) => {
                const attemptIndex = validation.repIds.indexOf(agg.repId) + 1;
                return (
                  <div key={agg.repId} className="surface-card flex items-center gap-5 p-5">
                    <div className="brand-gradient-text w-10 text-center text-3xl font-extrabold tabular-nums">
                      #{i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-ink-900">
                        Attempt {attemptIndex}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Average rank: {agg.averageRank.toFixed(2)} · {agg.firstPlace}{" "}
                        first-place vote{agg.firstPlace === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-ink-400">Top votes</span>
                      <span className="brand-gradient-text text-xl font-extrabold tabular-nums">
                        {agg.firstPlace}/{validation.rankingCount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
