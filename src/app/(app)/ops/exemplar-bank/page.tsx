import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  listExemplars,
  getExemplarBankStats,
  type ExemplarBankRow,
} from "@/lib/db/queries/exemplar-bank";
import {
  ExemplarRowControls,
  PromoteByRepIdForm,
} from "./controls";

export const metadata = {
  title: "Exemplar bank · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Phase 6 surface — the DB-backed few-shot exemplar bank consumed at
 * scoring time by retrieveSimilarReps. Distinct from /ops/reference-bank
 * (which lists the JSON calibration source).
 *
 * Two columns:
 *  - Top: promote-a-rep form (paste rep UUID → embed + insert)
 *  - Below: list of every exemplar row with promote/demote/notes controls
 *
 * Seeded reps and operator-promoted reps both live here. Seeded reps
 * have source_rep_id=null; promoted reps have source_rep_id set + a
 * "promo-" ref_id prefix.
 */
export default async function ExemplarBankPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const [stats, exemplars] = await Promise.all([
    getExemplarBankStats(),
    listExemplars(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Internal · Operators only
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Exemplar bank
        </h1>
        <p className="mt-3 max-w-3xl text-base text-ink-600">
          Few-shot reference reps used by Stage 2 scoring (retrieveSimilarReps).
          Promote operator-confirmed reps so the model has gold-standard
          anchors when grading shape-similar inputs. Demote rows that
          weaken calibration. Companion to{" "}
          <Link
            href="/ops/reference-bank"
            className="text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple/80"
          >
            /ops/reference-bank
          </Link>{" "}
          (JSON calibration source) and{" "}
          <Link
            href="/ops/review-queue"
            className="text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple/80"
          >
            /ops/review-queue
          </Link>{" "}
          (which now exposes a promote button on confirmed-accurate verdicts).
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Stat label="Total exemplars" value={String(stats.total)} />
        <Stat
          label="Promoted from real reps"
          value={String(stats.promotedFromReps)}
          sub="source_rep_id set"
        />
        <Stat
          label="Seeded reps"
          value={String(stats.seedReps)}
          sub="hand-crafted, no source rep"
        />
      </div>

      <div className="mt-8">
        <PromoteByRepIdForm />
      </div>

      <Section
        title={`Exemplars (${exemplars.length})`}
        subtitle="Newest promotion first. Notes save inline; demote removes the row from the bank."
      >
        {exemplars.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-500">
            No exemplars yet. Seed via{" "}
            <code className="rounded bg-ink-50 px-1 py-0.5 font-mono text-[11px]">
              node scripts/seed-reference-reps.mjs
            </code>{" "}
            or promote a rep above.
          </p>
        ) : (
          <ExemplarTable exemplars={exemplars} />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
        {title}
      </h2>
      <p className="mt-1 text-xs text-ink-500">{subtitle}</p>
      <div className="mt-4 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="overflow-x-auto">{children}</div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-ink-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
    </div>
  );
}

function ExemplarTable({ exemplars }: { exemplars: ExemplarBankRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-ink-100 bg-ink-50/60 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        <tr>
          <th className="px-3 py-2 text-left">Ref ID / source</th>
          <th className="px-3 py-2 text-left">Prompt / transcript</th>
          <th className="px-3 py-2 text-left">Known scores</th>
          <th className="px-3 py-2 text-left">Tags</th>
          <th className="px-3 py-2 text-left">Notes / actions</th>
        </tr>
      </thead>
      <tbody>
        {exemplars.map((ex) => {
          const known = ex.knownScores as {
            composite?: number;
            dimensions?: Record<string, number>;
            band?: string;
          };
          return (
            <tr key={ex.id} className="border-t border-ink-100 align-top">
              <td className="px-3 py-3 font-mono text-[11px] text-ink-700">
                <p className="font-bold">{ex.refId}</p>
                <p className="mt-1 text-[10px] text-ink-500">
                  {ex.sourceRepId ? (
                    <>
                      from rep
                      <br />
                      {ex.sourceRepId.slice(0, 8)}…
                    </>
                  ) : (
                    "seeded"
                  )}
                </p>
                <p className="mt-1 text-[10px] text-ink-400">
                  {new Date(ex.promotedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </td>
              <td className="px-3 py-3 text-[12px] text-ink-700">
                <p className="font-semibold">{truncate(ex.promptText, 80)}</p>
                <p className="mt-1 text-[11px] text-ink-500">
                  {truncate(ex.transcript, 200)}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
                  {Math.round(ex.durationMs / 1000)}s
                </p>
              </td>
              <td className="px-3 py-3 text-[12px] text-ink-700">
                <p>
                  <span className="font-semibold">Composite:</span>{" "}
                  {known.composite ?? "?"}
                </p>
                {known.dimensions && (
                  <p className="mt-1 font-mono text-[10px] text-ink-500">
                    C:{known.dimensions.clarity ?? "?"} S:
                    {known.dimensions.structure ?? "?"} Cn:
                    {known.dimensions.conciseness ?? "?"} T:
                    {known.dimensions.thinking_quality ?? "?"} D:
                    {known.dimensions.delivery ?? "?"} Tn:
                    {known.dimensions.tone ?? "?"}
                  </p>
                )}
                {known.band && (
                  <p className="mt-1 text-[10px] capitalize text-ink-500">
                    band: {known.band.replace("_", " ")}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 text-[11px] text-ink-600">
                {Object.entries(ex.tags ?? {}).map(([k, v]) => (
                  <p key={k} className="font-mono text-[10px]">
                    {k}={String(v)}
                  </p>
                ))}
              </td>
              <td className="px-3 py-3">
                <ExemplarRowControls
                  refId={ex.refId}
                  initialNotes={ex.notes}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
