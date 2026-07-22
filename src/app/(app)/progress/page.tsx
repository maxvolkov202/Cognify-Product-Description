import Link from "next/link";
import { currentUser } from "@/lib/session/current-user";
import { RUBRIC_VERSION } from "@/lib/scoring/rubric";
import {
  getSkillTrends,
  getCurrentSkillScores,
  getActivityHeatmap,
  getRecentReps,
  getPressureRepStats,
  getDailyCompositeTrend,
  getBeforeAfterReps,
} from "@/lib/db/queries/progress";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";
import { hasDatabase } from "@/lib/db/safe";
import { SkillTrendChart } from "@/components/product/SkillTrendChart";
import { StreakHeatmap } from "@/components/product/StreakHeatmap";
import { SkillRadar } from "@/components/product/SkillRadar";
import { WeeklyNarrativeCard } from "@/components/product/WeeklyNarrativeCard";
import { ImprovementCurve } from "@/components/product/ImprovementCurve";
import { BeforeAfterAudio } from "@/components/product/BeforeAfterAudio";
import { DailyScoreCard } from "@/components/product/DailyScoreCard";
import { GradientButton } from "@/components/shared/GradientButton";
import {
  Flame,
  Play,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Zap,
  FileDown,
  Trophy,
} from "lucide-react";
import { InfoTooltip } from "@/components/shared/InfoTooltip";

export default async function ProgressPage() {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  const [
    trends,
    currentScores,
    activity,
    recentReps,
    streakStatus,
    pressureStats,
    dailyCompositeTrend,
    beforeAfter,
  ] = await Promise.all([
    getSkillTrends(userId, 30),
    getCurrentSkillScores(userId),
    getActivityHeatmap(userId, 84),
    getRecentReps(userId, 12),
    getStreakStatus(userId),
    getPressureRepStats(userId, 60),
    getDailyCompositeTrend(userId, 90),
    getBeforeAfterReps(userId),
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
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
            Progress
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl dark:text-white">
            Your training, measured.
          </h1>
          <p className="mt-1 max-w-2xl text-lg text-ink-600 dark:text-ink-300">
            Every rep scored across six dimensions. Every callout anchored to a timestamp
            in your transcript. No grades — just signals that show improvement compound.
          </p>
        </div>
        {/* Phase 11.E4 — Achievements had no entry point outside the
            post-completion strip; Progress is its natural home. */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/achievements"
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:text-white"
          >
            <Trophy className="size-3.5" />
            Achievements
          </Link>
          <Link
            href="/report"
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:text-white"
          >
            <FileDown className="size-3.5" />
            Export report
          </Link>
        </div>
      </div>

      {!hasDatabase() && (
        <div className="mt-6 rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-5 py-4 text-sm text-ink-700 dark:bg-brand-purple/15 dark:text-ink-200">
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
              No data yet
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-ink-900 md:text-3xl dark:text-white">
              This page fills in as you train.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-ink-600 md:text-base dark:text-ink-300">
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
      {dailyCompositeTrend.length > 0 && (
        <div className="mt-8">
          <DailyScoreCard points={dailyCompositeTrend} />
        </div>
      )}

      <div className="mt-8">
        <WeeklyNarrativeCard />
      </div>

      {topImprovement && (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/40 dark:bg-emerald-500/15">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-emerald-800 text-[11px] dark:text-emerald-300">
                Nice — real improvement
              </p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
                Your <strong className="capitalize">{topImprovement.dimension}</strong>{" "}
                is up +{topImprovement.delta} points over the last 30 days. Keep
                pushing — the gap between reps is where the growth shows.
              </p>
            </div>
          </div>
        </div>
      )}

      {pressureStats.count > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-amber-50/70 to-amber-100/40 dark:border-amber-500/40 dark:from-amber-500/15 dark:via-amber-500/10 dark:to-amber-500/20">
          <div className="flex items-start gap-3 p-5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
              <Zap className="size-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300">
                Pressure performance · last 60 days
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-950 dark:text-amber-100">
                {pressureStats.count} pressure{" "}
                {pressureStats.count === 1 ? "rep" : "reps"} completed ·
                avg composite{" "}
                <strong>{pressureStats.avgComposite ?? "—"}</strong>
                {pressureStats.byArchetype[0] && (
                  <>
                    {" "}
                    · strongest under{" "}
                    <strong>
                      {pressureStats.byArchetype[0].archetypeName}
                    </strong>{" "}
                    ({pressureStats.byArchetype[0].avgComposite})
                  </>
                )}
              </p>
              {pressureStats.byArchetype.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {pressureStats.byArchetype.map((a) => (
                    <span
                      key={a.archetypeName}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-ink-900/60 dark:text-amber-200"
                    >
                      {a.archetypeName}
                      <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                        {a.avgComposite}
                      </span>
                      <span className="text-[10px] text-amber-500 dark:text-amber-400">
                        × {a.count}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hasValidatable && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-5 dark:bg-brand-purple/15">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/25 dark:text-brand-lavender">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-brand-purple text-[11px] dark:text-brand-lavender">
                Ready for a blind-listener check?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-800 dark:text-ink-100">
                You&rsquo;ve run the same prompt multiple times. Send your
                attempts to a friend or coach — they rank without seeing scores,
                giving you honest human feedback on which version landed.
              </p>
            </div>
          </div>
          <Link
            href="/validate/new"
            className="inline-flex items-center gap-1 rounded-full border border-brand-purple bg-white px-4 py-2 text-xs font-semibold text-brand-purple hover:bg-brand-purple/10 dark:bg-ink-900 dark:text-brand-lavender dark:hover:bg-brand-purple/15"
          >
            Set up validation
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {streakStatus.appliedFreezeDate && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-300 bg-gradient-to-br from-sky-50 via-sky-50/70 to-sky-100/40 p-4 dark:border-sky-500/40 dark:from-sky-500/15 dark:via-sky-500/10 dark:to-sky-500/20">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300">
            <Flame className="size-4" strokeWidth={2.5} />
          </div>
          <p className="flex-1 text-sm font-semibold text-sky-950 dark:text-sky-100">
            Streak freeze applied — you missed a day but your{" "}
            {streakStatus.streakDays}-day streak is intact. {streakStatus.freezesAvailable}{" "}
            freeze{streakStatus.freezesAvailable === 1 ? "" : "s"} left.
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-4">
        <StatCard
          icon={<Flame className="size-4 text-white" />}
          label="Current streak"
          value={streakStatus.streakDays.toString()}
          suffix="days"
          tooltip={
            streakStatus.freezesAvailable > 0
              ? `Banked freezes: ${streakStatus.freezesAvailable}. Earned every 7 consecutive days; auto-applied when you miss one day.`
              : "Earned every 7 consecutive days. Protects your streak from a single missed day."
          }
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
          tooltip="Weighted average of your scores across all six dimensions (0–100). Higher = all skills firing together, not just one."
        />
        <StatCard
          icon={<TrendingUp className="size-4 text-white" />}
          label="Rubric version"
          value={RUBRIC_VERSION}
          mono
          tooltip="The scoring rubric that produced these numbers. Pinned per rep so historical scores don't shift when we tune the rubric later."
        />
      </div>

      {dailyCompositeTrend.length >= 2 && (
        <div className="mt-10">
          <ImprovementCurve
            points={dailyCompositeTrend}
            peakComposite={
              dailyCompositeTrend.reduce(
                (max, p) => Math.max(max, p.composite),
                0,
              ) || null
            }
          />
        </div>
      )}

      {beforeAfter && (
        <div className="mt-8">
          <BeforeAfterAudio
            oldest={beforeAfter.oldest}
            newest={beforeAfter.newest}
          />
        </div>
      )}

      {/* Skill trends — full width so all six charts breathe (3-up on
          desktop, 2-up on phones so the page doesn't scroll forever). */}
      <div className="mt-10 surface-card p-6 sm:p-8">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">Skill trends</h2>
            <InfoTooltip content="One line per dimension. Trend up = consistent improvement week over week. Each point is a rep." />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            last 30 days
          </span>
        </div>
        <div className="mt-6">
          <SkillTrendChart trends={trends} />
        </div>
      </div>

      {/* Current shape + Activity — two at-a-glance widgets paired side by
          side (they fit well together); stack on phones. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="surface-card p-6 sm:p-8">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">Current shape</h2>
            <InfoTooltip content="Your latest score on each of the six dimensions. The hexagon shape shows strengths vs. gaps at a glance." />
          </div>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
            Latest score across all six dimensions.
          </p>
          <div className="mt-4 flex justify-center">
            <SkillRadar scores={currentScores} size={280} />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
            A balanced hexagon = you&rsquo;re consistent across all six
            dimensions. Dents point at where work compounds fastest.
          </p>
        </div>

        <div className="surface-card flex flex-col p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">Activity</h2>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">12-week heat map of your reps.</p>
          {/* Center the heatmap in the remaining card height so it visually
              balances the radar beside it. */}
          <div className="mt-6 flex flex-1 items-center">
            <StreakHeatmap activity={activity} days={84} />
          </div>
        </div>
      </div>

      {/* Recent reps — full-width list. */}
      <div className="mt-8 surface-card p-5 sm:p-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">Recent reps</h2>
          <Link
            href="/workout"
            className="text-xs font-semibold text-brand-purple hover:text-brand-magenta dark:text-brand-lavender"
          >
            Run another →
          </Link>
        </div>
        {recentReps.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-ink-200 p-8 text-center dark:border-ink-700">
            <p className="text-sm text-ink-500 dark:text-ink-400">No reps yet. Your first rep becomes your baseline.</p>
            <div className="mt-4">
              <GradientButton href="/workout" size="md">
                Start your first rep
              </GradientButton>
            </div>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100 dark:divide-ink-700">
            {recentReps.map((rep) => (
              <li
                key={rep.id}
                className="flex items-start justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words font-medium text-ink-800 dark:text-ink-100">
                    {rep.promptText}
                  </p>
                  <p className="mt-0.5 break-words text-[11px] text-ink-400 dark:text-ink-500">
                    {new Date(rep.createdAt).toLocaleString()} ·{" "}
                    {(rep.durationMs / 1000).toFixed(0)}s
                  </p>
                </div>
                <span className="shrink-0 brand-gradient-text text-lg font-extrabold tabular-nums">
                  {Math.round(rep.compositeScore)}
                </span>
              </li>
            ))}
          </ul>
        )}
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
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  mono?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        <span className="brand-gradient grid size-6 place-items-center rounded-md">
          {icon}
        </span>
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={`brand-gradient-text text-4xl font-extrabold tabular-nums ${mono ? "font-mono text-xl" : ""}`}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-ink-500 dark:text-ink-400">{suffix}</span>}
      </div>
    </div>
  );
}
