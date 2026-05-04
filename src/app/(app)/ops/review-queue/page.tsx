import { notFound } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getReviewQueue,
  getReviewQueueCount,
} from "@/lib/db/queries/review-queue";
import { ReviewSubmitter } from "./submitter";

export const metadata = {
  title: "Review queue · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Ch.C2 — Operator review queue.
 *
 * Lists reps that flagged for human review (composite ≥ 95) and have
 * no existing entry in score_corrections. Operator submits a verdict
 * via the inline form; on success the row disappears (page revalidates).
 */
export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [queue, totalCount] = await Promise.all([
    getReviewQueue({ limit: PAGE_SIZE, offset }),
    getReviewQueueCount(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Internal · Operators only
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Review queue
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Reps with composite ≥ 95 that haven&apos;t been reviewed yet.
            Submit a verdict to remove from the queue. Verdicts feed
            Ch.C3&apos;s reference-bank promotion script.
          </p>
        </div>
        <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold text-brand-purple">
          {totalCount} pending
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="mt-12 surface-card overflow-hidden p-10 text-center">
          <CheckCircle2
            className="mx-auto size-10 text-success"
            aria-hidden="true"
          />
          <p className="mt-3 text-lg font-semibold text-ink-700">
            No reps awaiting review
          </p>
          <p className="mt-1 text-sm text-ink-500">
            All reps with composite ≥ 95 have been reviewed (or none have
            been scored yet).
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {queue.map((rep) => (
            <div
              key={rep.id}
              className="surface-card overflow-hidden border-l-4 border-l-brand-purple"
            >
              <div className="brand-gradient h-1" aria-hidden="true" />
              <div className="grid gap-6 p-5 md:grid-cols-[2fr_1fr]">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                      Rep {rep.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {rep.userEmail ?? "(no email)"} ·{" "}
                      {new Date(rep.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 text-base font-semibold text-ink-900">
                    {rep.promptText}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-ink-400">
                    {Math.round(rep.durationMs / 1000)}s ·{" "}
                    {rep.modelVersion ?? "unknown model"} ·{" "}
                    {rep.rubricVersion ?? "unknown rubric"}
                  </p>
                  {rep.audioUrl && (
                    <audio
                      controls
                      src={rep.audioUrl}
                      className="mt-3 h-10 w-full max-w-md"
                    />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Score
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink-900">
                    {rep.composite}
                    <span className="ml-1 text-sm font-semibold text-amber-700">
                      flagged ≥ 95
                    </span>
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-ink-600">
                    {Object.entries(rep.dimensions).map(([dim, score]) => (
                      <li key={dim}>
                        {dim}: <span className="font-bold">{score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="border-t border-ink-100 bg-ink-50/40 p-4">
                <ReviewSubmitter repId={rep.id} composite={rep.composite} />
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs text-ink-500">
                Page {page} of {totalPages} · {totalCount} pending
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?page=${page - 1}`}
                    className="rounded-md border border-ink-200 px-3 py-1 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    ← Prev
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?page=${page + 1}`}
                    className="rounded-md border border-ink-200 px-3 py-1 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Next →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-12 flex items-center gap-2 text-[11px] text-ink-400">
        <AlertCircle className="size-3.5" aria-hidden="true" />
        Verdicts persist to <code className="font-mono">score_corrections</code>;
        Ch.C3 promotes corrections older than 7 days into the reference bank.
      </p>
    </div>
  );
}
