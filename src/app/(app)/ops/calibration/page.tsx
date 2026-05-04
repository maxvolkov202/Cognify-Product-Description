import { notFound } from "next/navigation";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getFirstRepDistribution,
  getCompositeDistributionByCohort,
  getInterDimensionCorrelation,
  getRecentDriftRuns,
  type DriftRunSummary,
} from "@/lib/db/queries/calibration-metrics";
import {
  BAND_DEFINITIONS,
  DIMENSION_LABELS,
  type BandId,
  type SkillDimension,
} from "@/types/domain";

export const metadata = {
  title: "Calibration · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Ch.15 — Calibration observability surface.
 *
 * Three operator-facing views answering "is the AI scoring drifting
 * away from the spec?":
 *
 *  - First-rep distribution: every authenticated user's first-ever
 *    rep, bucketed by score band. The DNA spec target: ≥40% of first
 *    reps should land in the Competent (60-75) band. The page shows
 *    the actual percentage and a pass/fail badge against that target.
 *
 *  - Composite distribution by cohort: recent-7-day reps split by new
 *    (first 5 reps) vs established (5+ lifetime reps) vs all. After
 *    a rubric or prompt change, drift surfaces here as a histogram
 *    shift.
 *
 *  - Inter-dimension correlation: 6×6 Pearson matrix across recent-7d
 *    reps. Off-diagonal cells should be <0.6 — high correlation means
 *    the LLM is collapsing dimensions into one signal, defeating the
 *    point of multi-dim scoring.
 *
 * Note: the nightly drift cron + the calibration_runs history table
 * from the source plan are deferred until Anthropic credits restored —
 * those need live calibration harness runs to populate. This page
 * works against existing reps + dimension_scores data today.
 */
export default async function CalibrationOpsPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const [firstRep, distNew, distEstablished, distAll, correlation, driftRuns] =
    await Promise.all([
      getFirstRepDistribution(),
      getCompositeDistributionByCohort("new"),
      getCompositeDistributionByCohort("established"),
      getCompositeDistributionByCohort("all"),
      getInterDimensionCorrelation(),
      getRecentDriftRuns(7),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Ops · Calibration observability
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Calibration
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Live distribution metrics. The DNA spec claims new-user reps land
            in 60-75; this page measures that against actual scoring data so
            drift is catchable as soon as it surfaces.
          </p>
        </div>
        <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold text-brand-purple">
          {profile.name ?? profile.email ?? "Operator"}
        </span>
      </div>

      {/* First-rep distribution */}
      <section className="surface-card p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
              First-rep distribution
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-ink-900">
              Where new users land — DNA target ≥40% in Competent
            </h2>
          </div>
          <CompetentBadge ok={firstRep.competentTargetMet} />
        </div>
        {firstRep.total === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            No first reps yet. Returns once at least one user has saved a rep.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-3 md:grid-cols-6">
            {firstRep.perBand.map((b) => (
              <BandTile
                key={b.band}
                band={b.band}
                count={b.count}
                pct={b.pct}
              />
            ))}
          </div>
        )}
        <p className="mt-4 text-[12px] text-ink-500">
          Sample size: <span className="tabular-nums">{firstRep.total}</span>{" "}
          first reps.
        </p>
      </section>

      {/* Composite distribution by cohort */}
      <section className="surface-card p-6 md:p-8">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
            Composite distribution · last 7 days
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-ink-900">
            Where reps are landing right now
          </h2>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <CohortBlock label="New (first 5 reps)" dist={distNew} />
          <CohortBlock label="Established (5+ reps)" dist={distEstablished} />
          <CohortBlock label="All reps" dist={distAll} />
        </div>
      </section>

      {/* Inter-dimension correlation */}
      <section className="surface-card p-6 md:p-8">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
            Inter-dimension correlation · last 7 days
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-ink-900">
            Are dimensions scored independently?
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] text-ink-500">
            Pearson r between every pair of dimensions across the recent rep
            population. Off-diagonal cells &lt;0.6 mean the LLM is treating
            dimensions as distinct skills; cells &gt;0.7 mean the rubric or
            prompt is collapsing them and needs a tightening pass.
          </p>
        </div>
        {correlation.sampleSize < 5 ? (
          <p className="mt-4 text-sm text-ink-500">
            Need at least 5 reps in the window to compute correlations.
            Currently: {correlation.sampleSize}.
          </p>
        ) : (
          <CorrelationHeatmap correlation={correlation} />
        )}
      </section>

      {/* Drift history (Ch.15b) */}
      <section className="surface-card p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
              Drift history · last {driftRuns.length || 7} nightly runs
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-ink-900">
              How calibration is moving over time
            </h2>
            <p className="mt-2 max-w-2xl text-[12px] text-ink-500">
              The nightly cron (03:00 UTC) scores every reference rep through
              /api/score and persists the per-rep delta. Each row below is one
              run; the avg-|Δ| column is the mean absolute composite drift
              across the run&rsquo;s ref reps. Worst-Δ flags the largest single
              drift in the run.
            </p>
          </div>
          <Clock
            className="size-5 shrink-0 text-ink-400"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        {driftRuns.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-5 text-[12px] text-ink-500">
            <p className="font-semibold text-ink-700">
              No nightly drift runs recorded yet.
            </p>
            <p className="mt-1 leading-relaxed">
              Either the calibration_runs migration hasn&rsquo;t been applied
              to this database (run{" "}
              <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px]">
                node scripts/apply-migration.mjs
                drizzle/migrations/0012_calibration_runs.sql
              </code>
              ) or the cron hasn&rsquo;t fired since the table was created.
              The cron schedule lives in <code>vercel.json</code>; it can be
              triggered manually via{" "}
              <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px]">
                curl -H &quot;authorization: Bearer $CRON_SECRET&quot;
                https://cognify-v2-neon.vercel.app/api/cron/calibration-drift
              </code>
              .
            </p>
          </div>
        ) : (
          <DriftRunsTable runs={driftRuns} />
        )}
      </section>
    </div>
  );
}

function DriftRunsTable({ runs }: { runs: DriftRunSummary[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-[12px]">
        <thead className="text-[10px] font-bold uppercase tracking-wide text-ink-500">
          <tr>
            <th className="pb-2 pr-3">Run</th>
            <th className="pb-2 pr-3">Reps</th>
            <th className="pb-2 pr-3">OK</th>
            <th className="pb-2 pr-3">Drift</th>
            <th className="pb-2 pr-3">Fallback</th>
            <th className="pb-2 pr-3">Errors</th>
            <th className="pb-2 pr-3">Avg |Δ|</th>
            <th className="pb-2 pr-3">Worst Δ</th>
            <th className="pb-2 pr-3">Alert</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.runId} className="border-t border-ink-100">
              <td className="py-2 pr-3 font-medium text-ink-700">
                {run.ranAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </td>
              <td className="py-2 pr-3 tabular-nums">{run.totalReps}</td>
              <td className="py-2 pr-3 tabular-nums text-emerald-600">
                {run.okCount}
              </td>
              <td className="py-2 pr-3 tabular-nums text-amber-600">
                {run.driftCount}
              </td>
              <td className="py-2 pr-3 tabular-nums text-ink-500">
                {run.fallbackCount > 0 ? (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    {run.fallbackCount}
                  </span>
                ) : (
                  <span>0</span>
                )}
              </td>
              <td className="py-2 pr-3 tabular-nums text-ink-500">
                {run.errorCount > 0 ? (
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                    {run.errorCount}
                  </span>
                ) : (
                  <span>0</span>
                )}
              </td>
              <td className="py-2 pr-3 tabular-nums">
                {run.avgAbsDelta != null ? run.avgAbsDelta : "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums">
                {run.worstDelta != null
                  ? (run.worstDelta > 0 ? "+" : "") + run.worstDelta
                  : "—"}
              </td>
              <td className="py-2 pr-3 text-[10px] tabular-nums">
                {run.alertSentAt ? (
                  <span
                    className="rounded-full bg-rose-50 px-1.5 py-0.5 font-bold text-rose-700"
                    title={`Alert webhook fired at ${run.alertSentAt.toISOString()}`}
                  >
                    {run.alertSentAt
                      .toISOString()
                      .slice(11, 16)}{" "}
                    UTC
                  </span>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompetentBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
      <CheckCircle2 className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      Target met
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
      <AlertTriangle
        className="size-3.5"
        strokeWidth={2.5}
        aria-hidden="true"
      />
      Below 40%
    </span>
  );
}

function BandTile({
  band,
  count,
  pct,
}: {
  band: BandId;
  count: number;
  pct: number;
}) {
  const def = BAND_DEFINITIONS.find((b) => b.id === band)!;
  const isCompetent = band === "competent";
  return (
    <div
      className="rounded-2xl border border-ink-200 bg-white p-3"
      style={
        isCompetent
          ? { boxShadow: "inset 0 0 0 2px rgba(176,114,255,0.35)" }
          : undefined
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
        {def.label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
        {pct}
        <span className="text-[12px] text-ink-400">%</span>
      </p>
      <p className="mt-0.5 text-[11px] text-ink-500 tabular-nums">
        n={count}
      </p>
    </div>
  );
}

function CohortBlock({
  label,
  dist,
}: {
  label: string;
  dist: { total: number; perBand: { band: BandId; count: number; pct: number }[] };
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-700">
          {label}
        </p>
        <p className="text-[10px] text-ink-400 tabular-nums">
          n={dist.total}
        </p>
      </div>
      {dist.total === 0 ? (
        <p className="mt-3 text-[12px] text-ink-500">No reps in window.</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {dist.perBand.map((b) => {
            const def = BAND_DEFINITIONS.find((d) => d.id === b.band)!;
            return (
              <div
                key={b.band}
                className="flex items-center gap-3 text-[11px]"
              >
                <span className="w-28 shrink-0 truncate font-semibold text-ink-700">
                  {def.label}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-brand-purple transition-[width]"
                    style={{ width: `${Math.max(2, b.pct)}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-ink-700">
                  {b.pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CorrelationHeatmap({
  correlation,
}: {
  correlation: {
    dimensions: readonly SkillDimension[];
    matrix: (number | null)[][];
    sampleSize: number;
  };
}) {
  const dims = correlation.dimensions;
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[600px] border-separate border-spacing-1 text-center text-[11px]">
        <thead>
          <tr>
            <th />
            {dims.map((d) => (
              <th
                key={d}
                className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-ink-500"
              >
                {DIMENSION_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dims.map((rowDim, i) => (
            <tr key={rowDim}>
              <th
                scope="row"
                className="pr-2 text-right text-[10px] font-bold uppercase tracking-wide text-ink-500"
              >
                {DIMENSION_LABELS[rowDim]}
              </th>
              {dims.map((colDim, j) => {
                const r = correlation.matrix[i]?.[j] ?? null;
                return (
                  <td
                    key={colDim}
                    className="rounded-md p-2 tabular-nums"
                    style={{
                      backgroundColor: corrColor(r),
                      color: r != null && Math.abs(r) >= 0.5 ? "white" : "#374151",
                      fontWeight: i === j ? 800 : 600,
                    }}
                    title={
                      r == null
                        ? "insufficient samples"
                        : `${DIMENSION_LABELS[rowDim]} vs ${DIMENSION_LABELS[colDim]}: r=${r}`
                    }
                  >
                    {r == null ? "—" : r.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-ink-500">
        Sample size:{" "}
        <span className="tabular-nums">{correlation.sampleSize}</span> reps in
        the last 7 days. Cells over 0.6 (rendered red) suggest the LLM is
        collapsing those dimensions.
      </p>
    </div>
  );
}

function corrColor(r: number | null): string {
  if (r == null) return "rgba(0,0,0,0.04)";
  // Diverging palette: -1 → blue, 0 → light gray, +1 → red.
  // The "danger" reading is high positive r between distinct dims, so
  // the upper end of the scale is intentionally loud.
  if (r >= 0.85) return "rgba(220, 38, 38, 0.85)";
  if (r >= 0.7) return "rgba(239, 68, 68, 0.7)";
  if (r >= 0.55) return "rgba(245, 158, 11, 0.55)";
  if (r >= 0.4) return "rgba(245, 158, 11, 0.3)";
  if (r >= 0.2) return "rgba(176, 114, 255, 0.18)";
  if (r >= -0.2) return "rgba(0, 0, 0, 0.04)";
  return "rgba(59, 130, 246, 0.25)";
}
