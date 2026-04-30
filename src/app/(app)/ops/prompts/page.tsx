import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, TrendingUp, Repeat } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getRankedPromptEngagement,
  getEngagementSummary,
} from "@/lib/db/queries/prompt-engagement";

export const metadata = {
  title: "Prompt engagement · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Prompt-evolution operator view. Surfaces aggregate engagement signals
 * captured by /api/prompt-events + /api/prompt-history so we can flag
 * low-quality prompts for replacement.
 *
 * Empty until production usage accumulates ≥10 shown events per prompt
 * (the ranking floor that keeps single-data-point prompts from
 * dominating). Empty-state copy explains.
 */
export default async function PromptOpsPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const [ranked, summary] = await Promise.all([
    getRankedPromptEngagement({ limit: 200 }),
    getEngagementSummary(),
  ]);

  // Bottom 20 by quality score = candidates for replacement.
  const worstPrompts = ranked.slice(0, 20);
  // Top 20 by quality score = high-engagement prompts to model after.
  const bestPrompts = [...ranked].slice(-20).reverse();
  const overallPickRate =
    summary.totalShown > 0 ? summary.totalPicked / summary.totalShown : 0;
  const overallRefreshRate =
    summary.totalShown > 0
      ? summary.totalRefreshedPast / summary.totalShown
      : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/ops"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.5} />
        Ops dashboard
      </Link>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Internal · Operators only
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Prompt engagement
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Pick rate vs refresh rate per prompt. Bottom-quality prompts
            are candidates for replacement; top-quality prompts are the
            voice to model after.
          </p>
        </div>
        <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold text-brand-purple">
          {profile.name ?? profile.email ?? "Operator"}
        </span>
      </div>

      {/* ——— Summary tiles ————————————————————————————————— */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Prompts seen"
          value={summary.totalPrompts.toLocaleString()}
          hint={`out of bank size`}
        />
        <SummaryTile
          label="Total shown"
          value={summary.totalShown.toLocaleString()}
          hint="slate render events"
        />
        <SummaryTile
          label="Pick rate"
          value={(overallPickRate * 100).toFixed(1) + "%"}
          hint={`${summary.totalPicked.toLocaleString()} picks`}
          tone="positive"
        />
        <SummaryTile
          label="Refresh rate"
          value={(overallRefreshRate * 100).toFixed(1) + "%"}
          hint={`${summary.totalRefreshedPast.toLocaleString()} rejections`}
          tone="warn"
        />
      </div>

      {/* ——— Empty state ————————————————————————————————— */}
      {ranked.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
          <AlertCircle
            className="mx-auto size-6 text-ink-400"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold text-ink-700">
            No ranked prompts yet
          </p>
          <p className="mt-1 max-w-md mx-auto text-[13px] text-ink-500">
            Rankings populate once a prompt has at least 10 shown events.
            Continue daily-workout usage; refresh this page when the
            summary tiles above show meaningful counts.
          </p>
        </div>
      )}

      {/* ——— Worst quality ————————————————————————————————— */}
      {worstPrompts.length > 0 && (
        <Section
          title="Lowest-quality prompts"
          subtitle="High refresh rate, low pick rate. Candidates for replacement."
          icon={<AlertCircle className="size-4" strokeWidth={2.5} />}
          accent="rose"
        >
          <PromptTable rows={worstPrompts} />
        </Section>
      )}

      {/* ——— Best quality ————————————————————————————————— */}
      {bestPrompts.length > 0 && (
        <Section
          title="Highest-quality prompts"
          subtitle="High pick rate, low refresh rate. Voice to model after."
          icon={<TrendingUp className="size-4" strokeWidth={2.5} />}
          accent="emerald"
        >
          <PromptTable rows={bestPrompts} />
        </Section>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-extrabold tabular-nums tracking-tight ${
          tone === "positive"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-rose-700"
              : "text-ink-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[12px] text-ink-500">{hint}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "rose" | "emerald";
  children: React.ReactNode;
}) {
  const accentClass =
    accent === "rose"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${accentClass}`}
        >
          {icon}
          <span className="uppercase tracking-wider">{title}</span>
        </span>
      </div>
      <p className="mt-2 text-[13px] text-ink-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PromptTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getRankedPromptEngagement>>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-ink-50">
          <tr className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
            <th className="px-4 py-2.5">Prompt id</th>
            <th className="px-4 py-2.5 text-right tabular-nums">Shown</th>
            <th className="px-4 py-2.5 text-right tabular-nums">Picked</th>
            <th className="px-4 py-2.5 text-right tabular-nums">Refreshed</th>
            <th className="px-4 py-2.5 text-right tabular-nums">Pick %</th>
            <th className="px-4 py-2.5 text-right tabular-nums">Refresh %</th>
            <th className="px-4 py-2.5 text-right tabular-nums">Quality</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.promptId}
              className="border-t border-ink-100 odd:bg-white even:bg-ink-50/40"
            >
              <td className="px-4 py-2 font-mono text-[12px] text-ink-700">
                {r.promptId}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-ink-600">
                {r.shownCount}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-ink-600">
                {r.pickedCount}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-ink-600">
                {r.refreshedPastCount}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                {(r.pickRate * 100).toFixed(0)}%
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-rose-700">
                {(r.refreshRate * 100).toFixed(0)}%
              </td>
              <td
                className={`px-4 py-2 text-right tabular-nums font-bold ${
                  r.quality < -0.1
                    ? "text-rose-700"
                    : r.quality > 0.2
                      ? "text-emerald-700"
                      : "text-ink-700"
                }`}
              >
                {r.quality >= 0 ? "+" : ""}
                {r.quality.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
