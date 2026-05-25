import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getRepWithDetails } from "@/lib/db/queries/progress";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
  type SkillDimension,
} from "@/types/domain";

export const dynamic = "force-dynamic";

type Params = Promise<{ repId: string }>;

export default async function RepDetailPage({ params }: { params: Params }) {
  const { repId } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const rep = await getRepWithDetails(repId);
  if (!rep) notFound();
  if (rep.userId !== user.id) notFound();

  const dims: SkillDimension[] = [
    ...SKILL_DIMENSION_GROUPS.content,
    ...SKILL_DIMENSION_GROUPS.delivery,
  ];
  const scoreByDim = new Map(
    rep.dimensionScores.map((d) => [d.dimension, d.score]),
  );
  const composite = Math.round(rep.compositeScore);
  const seconds = Math.round(rep.durationMs / 1000);
  const date = new Date(rep.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const lead =
    rep.callouts.find((c) => c.tone === "warn" || c.tone === "critical") ??
    rep.callouts[0] ??
    null;
  const wins = rep.callouts.filter((c) => c.tone === "positive").slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-10 md:py-12">
      <Link
        href="/progress"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Back to progress
      </Link>

      <section className="rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-brand-lavender/5 to-brand-magenta/5 p-6 md:p-8 dark:border-ink-700 dark:from-ink-900 dark:via-brand-lavender/10 dark:to-brand-magenta/10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
          Rep · {date} · {seconds}s
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl dark:text-white">
          {rep.promptText}
        </h1>
        <p className="brand-gradient-text mt-4 text-6xl font-extrabold tabular-nums">
          {composite}
        </p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Composite
        </p>
      </section>

      <section className="rounded-3xl border border-ink-200 bg-white p-6 md:p-7 dark:border-ink-700 dark:bg-ink-900">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
          Six core skills
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {dims.map((dim) => {
            const score = scoreByDim.get(dim);
            const isContent = (
              SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
            ).includes(dim);
            return (
              <div key={dim}>
                <div className="flex items-baseline justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100">
                    <span
                      className={
                        isContent
                          ? "size-1.5 rounded-full bg-brand-blue"
                          : "size-1.5 rounded-full bg-brand-magenta"
                      }
                    />
                    {DIMENSION_LABELS[dim]}
                  </span>
                  <span className="brand-gradient-text text-lg font-extrabold tabular-nums">
                    {typeof score === "number" ? Math.round(score) : "—"}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-700">
                  <div
                    className="brand-gradient h-full rounded-full"
                    style={{
                      width: `${typeof score === "number" ? Math.round(score) : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {lead && (
        <section className="rounded-3xl border border-brand-purple/20 bg-brand-purple/5 p-6 dark:bg-brand-purple/15">
          <div className="flex items-center gap-1.5 text-brand-purple dark:text-brand-lavender">
            <Sparkles className="size-3.5" strokeWidth={2.5} />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              One thing to improve next rep
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink-900 dark:text-white">
            {lead.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {lead.body}
          </p>
          {lead.quote && (
            <p className="mt-3 rounded-lg border-l-2 border-brand-purple/40 bg-white p-3 text-xs italic text-ink-700 dark:bg-ink-900 dark:text-ink-200">
              &ldquo;{lead.quote}&rdquo;
            </p>
          )}
          {lead.suggestedRewrite && (
            <p className="mt-2 rounded-lg border-l-2 border-emerald-300 bg-emerald-50/60 p-3 text-xs text-ink-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-ink-200">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Try
              </span>
              {lead.suggestedRewrite}
            </p>
          )}
        </section>
      )}

      {wins.length > 0 && (
        <section className="rounded-3xl border border-ink-200 bg-white p-6 dark:border-ink-700 dark:bg-ink-900">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            What you nailed
          </p>
          <ul className="space-y-2">
            {wins.map((w, i) => (
              <li
                key={i}
                className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/15"
              >
                <p className="text-sm font-semibold text-ink-900 dark:text-white">{w.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  {w.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rep.transcript && (
        <section className="rounded-3xl border border-ink-200 bg-white p-6 dark:border-ink-700 dark:bg-ink-900">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            Transcript
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-ink-200">
            {rep.transcript}
          </p>
        </section>
      )}

      <div className="pt-2">
        <Link
          href="/workout"
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm"
        >
          Run another workout
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
