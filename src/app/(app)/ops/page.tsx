import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getSignupMetrics,
  getActivityMetrics,
  getFunnelMetrics,
  getRecentSignups,
  getTopVerticals,
} from "@/lib/db/queries/ops";
import {
  Users,
  Flame,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const metadata = {
  title: "Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const [signups, activity, funnel, recent, verticals] = await Promise.all([
    getSignupMetrics(),
    getActivityMetrics(),
    getFunnelMetrics(),
    getRecentSignups(25),
    getTopVerticals(),
  ]);

  const maxDaily = Math.max(1, ...signups.daily.map((d) => d.count));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Internal · Operators only
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Ops dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-600">
            Live signup, activity, and funnel metrics. Authenticated-user data
            only — guest sessions are excluded from counts.
          </p>
        </div>
        <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold text-brand-purple">
          {profile.name ?? profile.email ?? "Operator"}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href="/ops/prompts"
          className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand-purple hover:bg-brand-purple/15"
        >
          Prompt engagement →
        </a>
        <a
          href="/ops/calibration"
          className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand-purple hover:bg-brand-purple/15"
        >
          Calibration drift →
        </a>
        <a
          href="/ops/reference-bank"
          className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand-purple hover:bg-brand-purple/15"
        >
          Reference bank →
        </a>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Signups
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat
            icon={<Users className="size-4" />}
            label="Total signups"
            value={signups.total}
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="Last 7 days"
            value={signups.last7d}
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="Last 30 days"
            value={signups.last30d}
          />
        </div>

        <div className="mt-4 surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Daily signups · last 30 days
            </p>
            <div className="mt-4 flex h-32 items-end gap-1">
              {signups.daily.map((d) => {
                const pct = d.count === 0 ? 2 : (d.count / maxDaily) * 100;
                return (
                  <div
                    key={d.date}
                    className="group relative flex-1"
                    title={`${d.date}: ${d.count}`}
                  >
                    <div
                      className={`brand-gradient w-full rounded-t transition ${d.count === 0 ? "opacity-20" : ""}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-ink-400">
              <span>{signups.daily[0]?.date}</span>
              <span>{signups.daily[signups.daily.length - 1]?.date}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Activity
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat
            icon={<Flame className="size-4" />}
            label="DAU"
            value={activity.dau}
            sub="Users who ran a rep in the last 24h"
          />
          <Stat
            icon={<Flame className="size-4" />}
            label="WAU"
            value={activity.wau}
            sub="Last 7 days"
          />
          <Stat
            icon={<Flame className="size-4" />}
            label="MAU"
            value={activity.mau}
            sub="Last 30 days"
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat
            icon={<BarChart3 className="size-4" />}
            label="Reps · 7d"
            value={activity.repsLast7d}
          />
          <Stat
            icon={<BarChart3 className="size-4" />}
            label="Reps · 30d"
            value={activity.repsLast30d}
          />
          <Stat
            icon={<BarChart3 className="size-4" />}
            label="Reps · total"
            value={activity.repsTotal}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Onboarding funnel
        </h2>
        <div className="mt-4 surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="divide-y divide-ink-100">
            <FunnelRow label="1. Signed up" value={funnel.signedUp} total={funnel.signedUp} />
            <FunnelRow label="2. Picked vertical" value={funnel.pickedVertical} total={funnel.signedUp} />
            <FunnelRow label="3. Picked personas" value={funnel.pickedPersonas} total={funnel.signedUp} />
            <FunnelRow label="4. Picked goals" value={funnel.pickedGoals} total={funnel.signedUp} />
            <FunnelRow label="5. Saw tutorial" value={funnel.sawTutorial} total={funnel.signedUp} />
            <FunnelRow label="6. Ran first rep" value={funnel.ranFirstRep} total={funnel.signedUp} />
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
            Recent signups
          </h2>
          <div className="mt-4 surface-card overflow-hidden">
            <div className="brand-gradient h-1" aria-hidden="true" />
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">Domain</th>
                  <th className="px-3 py-2 text-left">Vertical</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Onboarded</th>
                  <th className="px-3 py-2 text-left">Tutorial</th>
                  <th className="px-3 py-2 text-left">First rep</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-xs text-ink-400"
                    >
                      No signups yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((r) => (
                    <tr key={r.id} className="border-t border-ink-100">
                      <td className="px-3 py-2 font-mono text-[12px] text-ink-700">
                        {r.emailDomain}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-ink-700">
                        {r.vertical ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-ink-500">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Check ok={r.onboardedAt !== null} />
                      </td>
                      <td className="px-3 py-2">
                        <Check ok={r.tutorialSeenAt !== null} />
                      </td>
                      <td className="px-3 py-2">
                        <Check ok={r.hasRepped} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
            Top verticals
          </h2>
          <div className="mt-4 surface-card overflow-hidden p-5">
            {verticals.length === 0 ? (
              <p className="text-xs text-ink-400">No vertical data yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {verticals.map((v) => {
                  const pct =
                    verticals[0]?.count && verticals[0].count > 0
                      ? (v.count / verticals[0].count) * 100
                      : 0;
                  return (
                    <li key={v.vertical}>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-ink-700">
                          {v.vertical}
                        </span>
                        <span className="font-bold tabular-nums text-ink-900">
                          {v.count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100">
                        <div
                          className="brand-gradient h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <p className="mt-12 text-[11px] text-ink-400">
        Data refreshes on every page load. Counts exclude guest users.
        Operators can be flagged via the `is_operator` column on `users`.
      </p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="surface-card flex items-start gap-3 p-4">
      <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-lg text-white">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-ink-900">
          {value.toLocaleString()}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <p className="w-48 shrink-0 text-sm font-semibold text-ink-700">
        {label}
      </p>
      <div className="flex-1">
        <div className="h-2 w-full rounded-full bg-ink-100">
          <div
            className="brand-gradient h-2 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="w-28 shrink-0 text-right text-sm tabular-nums text-ink-700">
        {value.toLocaleString()}{" "}
        <span className="text-[10px] font-semibold text-ink-400">
          ({pct.toFixed(0)}%)
        </span>
      </p>
    </div>
  );
}

function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="size-4 text-success" aria-label="yes" />
  ) : (
    <AlertCircle className="size-4 text-ink-300" aria-label="no" />
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
