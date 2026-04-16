import Link from "next/link";
import { currentUser } from "@/lib/session/current-user";
import {
  getSkillTrends,
  getCurrentSkillScores,
  getActivityHeatmap,
  getRecentReps,
  getStreakDays,
} from "@/lib/db/queries/progress";
import { hasDatabase } from "@/lib/db/safe";
import { SkillTrendChart } from "@/components/product/SkillTrendChart";
import { StreakHeatmap } from "@/components/product/StreakHeatmap";
import { SkillRadar } from "@/components/product/SkillRadar";
import { GradientButton } from "@/components/shared/GradientButton";
import { Flame, Play, TrendingUp, Sparkles, ArrowRight } from "lucide-react";

export default async function ProgressPage() {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  const [trends, currentScores, activity, recentReps, streakDays] = await Promise.all([
    getSkillTrends(userId, 30),
    getCurrentSkillScores(userId),
    getActivityHeatmap(userId, 84),
    getRecentReps(userId, 12),
    getStreakDays(userId),
  ]);

  const totalReps = activity.reduce((sum, a) => sum + a.count, 0);
  const averageComposite =
    recentReps.length > 0
      ? Math.round(
          recentReps.reduce((sum, r) => sum + r.compositeScore, 0) / recentReps.length,
        )
      : null;

  // ——— Biggest improvement across the window (celebration banner) ———
  // Compares the first vs latest score per dimension over the trend window.
  // Surfaces the largest positive delta as a "nice work" banner.
  let topImprovement: { dimension: string; delta: number } | null = null;
  for (const trend of trends) {
    if (trend.points.length < 2) continue;
    const first = trend.points[0]!.score;
    const last = trend.points[trend.points.length - 1]!.score;
    const delta = Math.round(last - first);
    if (delta >= 5 && (!topImprovement || delta > topImprovement.delta)) {
      topImprovement = { dimension: trend.dimension, delta };
    }
  }

  // ——— Validate bridge — suggest blind ranking when user has 2+ reps
  // on the same prompt. Users at this point have enough material to get
  // honest human feedback on which attempts actually landed.
  const promptCounts = new Map<string, number>();
  for (const r of recentReps) {
    promptCounts.set(r.promptText, (promptCounts.get(r.promptText) ?? 0) + 1);
  }
  const hasValidatable = Array.from(promptCounts.values()).some((c) => c >= 2);

  // currentScores is already typed with the new rubric dimensions, so
  // we pass it directly to the radar without rebuilding the object.

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Progress
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Your training, measured.
        </h1>
        <p className="mt-1 max-w-2xl text-lg text-ink-600">
          Every rep scored across six dimensions. Every callout anchored to a timestamp
          in your transcript. No grades — just signals that show improvement compound.
        </p>
      </div>

      {!hasDatabase() && (
        <div className="mt-6 rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-5 py-4 text-sm text-ink-700">
          <strong>Persistence is off.</strong> Set <code>DATABASE_URL</code> in{" "}
          <code>.env.local</code> to enable longitudinal progress. Run a free Neon branch
          and paste the connection string.
        </div>
      )}

      {/* Empty state: no reps yet — hide the whole instrumentation and show a
          single clear CTA. Otherwise the charts all render as empty and the
          page reads as broken. */}
      {totalReps === 0 && recentReps.length === 0 && (
        <div className="mt-10 surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-8 md:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              No data yet
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-ink-900 md:text-3xl">
              This page fills in as you train.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-ink-600 md:text-base">
              After your first rep: per-skill trend lines over 7/30/90 days, an
              activity heat map, a streak counter, and a monthly report card.
              It all builds from the reps you run.
            </p>
            <div className="mt-6">
              <GradientButton href="/workout" size="lg">
                Start your first workout
              </GradientButton>
            </div>
          </div>
        </div>
      )}

      {totalReps > 0 || recentReps.length > 0 ? (
      <>
      {topImprovement && (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-emerald-800 text-[11px]">
                Nice — real improvement
              </p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900">
                Your <strong className="capitalize">{topImprovement.dimension}</strong>{" "}
                is up +{topImprovement.delta} points over the last 30 days. Keep
                pushing — the gap between reps is where the growth shows.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasValidatable && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-purple/10 text-brand-purple">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-brand-purple text-[11px]">
                Ready for a blind-listener check?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-800">
                You&rsquo;ve run the same prompt multiple times. Send your
                attempts to a friend or coach — they rank without seeing scores,
                giving you honest human feedback on which version landed.
              </p>
            </div>
          </div>
          <Link
            href="/validate/new"
            className="inline-flex items-center gap-1 rounded-full border border-brand-purple bg-white px-4 py-2 text-xs font-semibold text-brand-purple hover:bg-brand-purple/10"
          >
            Set up validation
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-4">
        <StatCard
          icon={<Flame className="size-4 text-white" />}
          label="Current streak"
          value={streakDays.toString()}
          suffix="days"
        />
        <StatCard
          icon={<Play className="size-4 text-white" />}
          label="Reps last 12 weeks"
          value={totalReps.toString()}
        />
        <StatCard
          icon={<TrendingUp className="size-4 text-white" />}
          label="Recent composite"
          value={averageComposite?.toString() ?? "—"}
        />
        <StatCard
          icon={<TrendingUp className="size-4 text-white" />}
          label="Rubric version"
          value="v2-beta.1"
          mono
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="surface-card p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-extrabold text-ink-900">Skill trends</h2>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              last 30 days
            </span>
          </div>
          <div className="mt-6">
            <SkillTrendChart trends={trends} />
          </div>
        </div>

        <div className="surface-card p-8">
          <h2 className="text-xl font-extrabold text-ink-900">Current shape</h2>
          <p className="mt-1 text-xs text-ink-500">
            Latest score across all six dimensions.
          </p>
          <div className="mt-4 flex justify-center">
            <SkillRadar scores={currentScores} size={280} />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
            A balanced hexagon = you&rsquo;re consistent across all six
            dimensions. Dents point at where work compounds fastest.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.3fr]">
        <div className="surface-card p-8">
          <h2 className="text-xl font-extrabold text-ink-900">Activity</h2>
          <p className="mt-1 text-xs text-ink-500">12-week heat map of your reps.</p>
          <div className="mt-6">
            <StreakHeatmap activity={activity} days={84} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-500">
            <span>Less</span>
            <div className="flex gap-0.5">
              <span className="size-3 rounded-sm bg-ink-100" />
              <span className="size-3 rounded-sm bg-brand-purple/25" />
              <span className="size-3 rounded-sm bg-brand-purple/50" />
              <span className="size-3 rounded-sm bg-brand-purple/75" />
              <span className="size-3 rounded-sm bg-brand-purple" />
            </div>
            <span>More reps that day</span>
          </div>
        </div>

        <div className="surface-card p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-extrabold text-ink-900">Recent reps</h2>
            <Link
              href="/workout"
              className="text-xs font-semibold text-brand-purple hover:text-brand-magenta"
            >
              Run another →
            </Link>
          </div>
          {recentReps.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-ink-200 p-8 text-center">
              <p className="text-sm text-ink-500">No reps yet. Your first rep becomes your baseline.</p>
              <div className="mt-4">
                <GradientButton href="/workout" size="md">
                  Start your first rep
                </GradientButton>
              </div>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100">
              {recentReps.map((rep) => (
                <li
                  key={rep.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-800">{rep.promptText}</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {new Date(rep.createdAt).toLocaleString()} ·{" "}
                      {(rep.durationMs / 1000).toFixed(0)}s
                    </p>
                  </div>
                  <span className="brand-gradient-text text-lg font-extrabold tabular-nums">
                    {Math.round(rep.compositeScore)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  mono?: boolean;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        <span className="brand-gradient grid size-6 place-items-center rounded-md">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={`brand-gradient-text text-4xl font-extrabold tabular-nums ${mono ? "font-mono text-xl" : ""}`}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-ink-500">{suffix}</span>}
      </div>
    </div>
  );
}
