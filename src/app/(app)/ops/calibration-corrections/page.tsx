import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileDown } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { getPromotableCorrections } from "@/lib/db/queries/review-queue";

export const metadata = {
  title: "Calibration corrections · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Ch.C3 — Pending calibration corrections.
 *
 * Lists score_corrections rows older than 7 days that propose a
 * lower/higher composite score with non-null corrected_composite.
 * These are eligible for promotion into the reference bank via
 * `npx tsx scripts/promote-corrections.ts`. The page is informational
 * only — promotion is operator-run + hand-merged.
 */
export default async function CalibrationCorrectionsPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const corrections = await getPromotableCorrections({ cooloffDays: 7 });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Internal · Operators only
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Calibration corrections
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-600">
          Operator review verdicts older than 7 days that propose a
          lower/higher composite score. Promote into the reference bank
          via the script below — proposals are written to a sidecar
          file, not auto-merged.
        </p>
      </div>

      <div className="mt-6 surface-card overflow-hidden p-5">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <FileDown className="mt-0.5 size-5 text-brand-purple" />
          <div>
            <p className="text-sm font-semibold text-ink-700">
              Generate a promotion proposal
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Run from a shell with DATABASE_URL pointing at the prod DB:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-ink-50 p-2 font-mono text-[11px] text-ink-700">
              npx tsx scripts/promote-corrections.ts
            </pre>
            <p className="mt-2 text-xs text-ink-500">
              Output: <code>scripts/calibration/proposed-YYYY-MM-DD.proposed.json</code>
              {" "} for hand-merge into <code>reference-reps.json</code> via PR review.
              See <code>docs/CALIBRATION_LOOP.md</code> for the full loop.
            </p>
          </div>
        </div>
      </div>

      {corrections.length === 0 ? (
        <div className="mt-8 surface-card overflow-hidden p-10 text-center">
          <CheckCircle2
            className="mx-auto size-10 text-success"
            aria-hidden="true"
          />
          <p className="mt-3 text-lg font-semibold text-ink-700">
            No promotable corrections
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Either no operators have submitted corrected scores yet, or
            none have aged past the 7-day cool-off window.
          </p>
        </div>
      ) : (
        <div className="mt-8 surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Rep</th>
                <th className="px-3 py-2 text-left">Prompt</th>
                <th className="px-3 py-2 text-left">Verdict</th>
                <th className="px-3 py-2 text-right">LLM composite</th>
                <th className="px-3 py-2 text-right">Operator suggests</th>
                <th className="px-3 py-2 text-left">Reviewed</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((c) => (
                <tr key={c.correctionId} className="border-t border-ink-100 align-top">
                  <td className="px-3 py-3 font-mono text-[11px] text-ink-600">
                    {c.repId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-700">
                    {truncate(c.rep.promptText, 80)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        c.verdict === "should_be_lower"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {c.verdict.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[12px]">
                    {c.rep.composite}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[12px] font-bold text-ink-900">
                    {c.correctedComposite}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-ink-500">
                    <Clock className="mr-1 inline size-3" />
                    {new Date(c.reviewedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-ink-500">
                    {c.notes ? truncate(c.notes, 60) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-12 text-[11px] text-ink-400">
        Total promotable: {corrections.length}. Older corrections are
        always shown — no archival happens automatically. Once promoted,
        corrections remain in score_corrections as historical record.
      </p>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
