import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getPerExerciseDrift,
  type PerExerciseDriftRow,
} from "@/lib/db/queries/calibration-metrics";

export const metadata = {
  title: "Per-exercise drift · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Phase B follow-up — per-exercise calibration drift surface.
 *
 * Slices scoring_telemetry by exercise_id (populated since Phase 8).
 * Operators use this to catch the case where one exercise's prompt
 * shape pulls scoring out of band — e.g. if "kill-the-filler" reps
 * suddenly start coming back at composite 90+ while every other
 * exercise stays calibrated, the rubric hint is too forgiving.
 *
 * Columns:
 *   - exercise (name, dim, slug)
 *   - n: rep count in window (30d)
 *   - mean / p50 composite
 *   - mock-fallback rate — >2% global threshold flagged red
 *   - p95 model latency — >8s budget flagged red
 *   - last seen
 */
export default async function PerExerciseDriftPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const rows = await getPerExerciseDrift();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Ops · Calibration · per-exercise drift
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Per-exercise drift
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Scoring distribution sliced by muscle-group exercise over the
            last 30 days. If one exercise drifts independently of the
            global mean, the rubric hint or fast-fail behavior needs a
            tightening pass.
          </p>
        </div>
        <Link
          href="/ops/calibration"
          className="rounded-full border border-ink-200 px-3 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-50"
        >
          ← All-rep view
        </Link>
      </div>

      {rows.length === 0 ? (
        <section className="surface-card p-6 md:p-8">
          <p className="text-sm text-ink-500">
            No scoring telemetry with an exercise_id in the last 30 days.
            This view populates once muscle-group reps start landing
            through the staged scoring path (
            <code className="rounded bg-ink-100 px-1">/api/score/twostage</code>
            ).
          </p>
        </section>
      ) : (
        <section className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60">
              <tr className="text-left">
                <Th>Exercise</Th>
                <Th align="right">n</Th>
                <Th align="right">Mean</Th>
                <Th align="right">p50</Th>
                <Th align="right">Mock %</Th>
                <Th align="right">p95 ms</Th>
                <Th align="right">Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <DriftRow key={row.exerciseId} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-[11px] text-ink-400">
        Window: rolling 30 days. Rows with null exercise_id (Skill Lab /
        scenario reps) are excluded — they live in the all-rep view at{" "}
        <Link href="/ops/calibration" className="underline">
          /ops/calibration
        </Link>
        .
      </p>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-500 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function DriftRow({ row }: { row: PerExerciseDriftRow }) {
  const mockPct = row.mockFallbackRate * 100;
  const mockFlag = mockPct > 2;
  const latencyFlag =
    row.p95ModelDurationMs != null && row.p95ModelDurationMs > 8000;
  return (
    <tr className="border-b border-ink-100/60 last:border-0">
      <td className="px-4 py-3">
        <div className="font-semibold text-ink-900">{row.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
          <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono">
            {row.dimension}
          </span>
          <span className="font-mono">{row.slug}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{row.repCount}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {row.meanComposite ?? "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {row.p50Composite ?? "—"}
      </td>
      <td
        className={`px-4 py-3 text-right tabular-nums ${
          mockFlag ? "font-semibold text-rose-600" : "text-ink-700"
        }`}
      >
        {mockPct.toFixed(1)}%
      </td>
      <td
        className={`px-4 py-3 text-right tabular-nums ${
          latencyFlag ? "font-semibold text-rose-600" : "text-ink-700"
        }`}
      >
        {row.p95ModelDurationMs ?? "—"}
      </td>
      <td className="px-4 py-3 text-right text-[11px] text-ink-500">
        {row.lastSeenAt
          ? new Date(row.lastSeenAt).toISOString().slice(0, 10)
          : "—"}
      </td>
    </tr>
  );
}
