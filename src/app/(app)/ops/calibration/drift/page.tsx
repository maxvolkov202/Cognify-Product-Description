import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getRecentDrift,
  groupDriftByWeekAndDim,
  summarizeDrift,
  type DriftRow,
} from "@/lib/db/queries/callout-drift";

export const metadata = {
  title: "Callout drift · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Phase 7 surface — operator-facing read view of cognify_v2.callout_drift_reports.
 *
 * The weekly cron (`/api/cron/weekly-callout-drift`) aggregates the last
 * 7 days of callout_corrections by (dimension, sub_skill, verdict) and
 * writes rows here, flagging entries where wrong_rate ≥ 25% AND
 * total_for_group ≥ 4. This page surfaces those flags so operators can
 * spot dims that need rubric attention.
 *
 * Empty until users start correcting callouts in production. Until then
 * the cron writes no rows. The page renders an explainer in that case
 * so the empty state is informative, not broken-looking.
 */
export default async function CalloutDriftPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const rows = await getRecentDrift(8);
  const summary = summarizeDrift(rows);
  const grouped = groupDriftByWeekAndDim(rows);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Internal · Operators only
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Callout drift
          </h1>
          <p className="mt-3 max-w-3xl text-base text-ink-600">
            Weekly aggregated{" "}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[11px]">
              callout_corrections
            </code>{" "}
            wrong-rate per (dimension, sub-skill). Rows are flagged when
            wrong rate ≥ 25% AND the group has ≥ 4 corrections (sample-size
            floor). Cron:{" "}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[11px]">
              /api/cron/weekly-callout-drift
            </code>{" "}
            (weekly schedule in vercel.json). See also:{" "}
            <Link
              href="/ops/calibration"
              className="text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple/80"
            >
              calibration distribution
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Stat label="Drift rows" value={String(summary.totalRows)} />
        <Stat
          label="Flagged"
          value={String(summary.flaggedRows)}
          highlight={summary.flaggedRows > 0}
        />
        <Stat label="Weeks observed" value={String(summary.weeksObserved)} />
        <Stat label="Latest week" value={summary.latestWeek ?? "—"} />
      </div>

      {grouped.length === 0 ? <EmptyState /> : null}

      {grouped.map(({ weekStart, perDimension }) => (
        <section key={weekStart} className="mt-10">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Week of {weekStart}
            </h2>
            {perDimension.some((d) => d.flagged) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                <AlertTriangle
                  className="size-3"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                Flagged dims
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2
                  className="size-3"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                Clean
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {perDimension.map((dim) => (
              <DimensionCard key={dim.dimension} dim={dim} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-12 flex items-center gap-2 text-[11px] text-ink-400">
        <Clock className="size-3.5" aria-hidden="true" />
        Cron runs weekly. To trigger manually:{" "}
        <code className="font-mono">
          curl -H &quot;authorization: Bearer $CRON_SECRET&quot; …/api/cron/weekly-callout-drift
        </code>
      </p>
    </div>
  );
}

function DimensionCard({
  dim,
}: {
  dim: {
    dimension: string;
    rows: DriftRow[];
    flagged: boolean;
    wrongCount: number;
    totalForDim: number;
  };
}) {
  const wrongRate =
    dim.totalForDim > 0 ? Math.round((dim.wrongCount / dim.totalForDim) * 100) : 0;
  return (
    <div
      className={`surface-card p-5 ${dim.flagged ? "border-l-4 border-l-amber-400" : ""}`}
    >
      <div className="brand-gradient h-1 -mx-5 -mt-5 mb-4" aria-hidden="true" />
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-400">
          {dim.dimension.replace("_", " ")}
        </p>
        {dim.flagged && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
            Flagged
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-ink-900">
        {wrongRate}
        <span className="text-sm text-ink-400">%</span>
      </p>
      <p className="mt-0.5 text-[11px] text-ink-500">
        wrong rate · {dim.wrongCount} of {dim.totalForDim} corrections
      </p>

      <div className="mt-3 space-y-1.5">
        {dim.rows.map((r, idx) => (
          <div
            key={r.id ?? idx}
            className="flex items-center justify-between gap-3 text-[11px]"
          >
            <span className="font-semibold text-ink-700">
              {r.verdict.replace("_", " ")}
              {r.subSkill ? (
                <span className="ml-1 font-mono text-[10px] text-ink-500">
                  ({r.subSkill})
                </span>
              ) : null}
            </span>
            <span className="tabular-nums text-ink-700">
              {r.count}
              <span className="text-[10px] text-ink-400">
                {" "}
                / {r.totalForGroup}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-2xl font-extrabold tabular-nums ${highlight ? "text-amber-700" : "text-ink-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 surface-card overflow-hidden p-10 text-center">
      <CheckCircle2
        className="mx-auto size-10 text-ink-300"
        aria-hidden="true"
      />
      <p className="mt-3 text-lg font-semibold text-ink-700">
        No drift rows yet
      </p>
      <p className="mt-1 max-w-xl mx-auto text-sm text-ink-500">
        The cron writes rows only when users start correcting callouts in
        production. Until then the table is empty — expected, not broken.
        Submit a correction from a real rep&apos;s feedback to seed the
        signal.
      </p>
    </div>
  );
}
