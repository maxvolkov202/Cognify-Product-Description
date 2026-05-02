import Link from "next/link";
import { GradientButton } from "@/components/shared/GradientButton";
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Mic,
} from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getRecentReps,
  getActivityHeatmap,
  getSkillTrends,
  getRepById,
  getWeakestDimension,
  getRunningAverages,
} from "@/lib/db/queries/progress";
import { LevelStreakCard } from "@/components/product/dashboard/LevelStreakCard";
import { WeakestLinkCard } from "@/components/product/dashboard/WeakestLinkCard";
import { SubSkillBreakdownCard } from "@/components/product/dashboard/SubSkillBreakdownCard";
import { SkillAveragesGrid } from "@/components/product/dashboard/SkillAveragesGrid";
import { StreakCalendar } from "@/components/product/dashboard/StreakCalendar";
import { DailyQuestsStrip } from "@/components/product/dashboard/DailyQuestsStrip";
import { getOrCreateTodayQuests } from "@/lib/db/queries/daily-quests";
import { LeagueBoard } from "@/components/product/dashboard/LeagueBoard";
import {
  getOrCreateThisWeekMembership,
  getCohortLeaderboard,
} from "@/lib/db/queries/leagues";
import { anonymousHandle } from "@/lib/engagement/leagues";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";
import {
  bucketByDimension,
  getSubSkillRunningAverages,
  hasMeaningfulSubSkillData,
  type SubSkillStat,
} from "@/lib/db/queries/sub-skills";
import type { SubSkillId } from "@/types/sub-skills";
import { ResumeBanner } from "@/components/product/ResumeBanner";
import { DnaStatsStrip } from "@/components/product/DnaStatsStrip";
import { DashboardHero } from "@/components/product/DashboardHero";
import { DayDotsPreview } from "@/components/product/DayDotsPreview";
import { WeekCalendar } from "@/components/product/WeekCalendar";
import { TrainingStackRow } from "@/components/product/TrainingStackRow";
import { LibraryCallout } from "@/components/product/LibraryCallout";
import { buildNarrativeInsights } from "@/lib/insights/narrative";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSIONS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import type { SkillDimension } from "@/types/domain";

export default async function DashboardPage() {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const leaguesEnabled = process.env.FF_LEAGUES === "true";
  // Ch.12 — sub-skill UI gate. When off, dashboard renders identically
  // to pre-Ch.12. When on, the SubSkillBreakdownCard mounts and the
  // WeakestLinkCard upgrades to "weakest sub-skill within the weakest
  // dim" copy where data exists. Off path skips the query entirely so
  // we don't pay the read cost for users who can't see the surface.
  const subSkillUiEnabled = process.env.FF_SUBSKILL_UI === "true";

  const [
    streakStatus,
    recent,
    activity,
    trends,
    profile,
    weakest,
    todaysQuests,
    leagueMember,
    subSkillStats,
    runningAverages,
  ] = await Promise.all([
    getStreakStatus(userId),
    getRecentReps(userId, 5),
    getActivityHeatmap(userId, 30),
    getSkillTrends(userId, 14),
    user ? getUserProfile(user.id) : Promise.resolve(null),
    user ? getWeakestDimension(user.id) : Promise.resolve(null),
    user ? getOrCreateTodayQuests(user.id) : Promise.resolve(null),
    user && leaguesEnabled
      ? getOrCreateThisWeekMembership(user.id)
      : Promise.resolve(null),
    user && subSkillUiEnabled
      ? getSubSkillRunningAverages(user.id)
      : Promise.resolve({} as Partial<Record<SubSkillId, SubSkillStat>>),
    user ? getRunningAverages(user.id) : Promise.resolve([]),
  ]);

  const subSkillBreakdown = bucketByDimension(subSkillStats);
  const hasSubSkillData =
    subSkillUiEnabled && hasMeaningfulSubSkillData(subSkillStats);
  // The WeakestLinkCard upgrade only fires when (a) sub-skill UI is on,
  // (b) we have a weakest dim, AND (c) that dim has at least one
  // sub-skill with enough samples. Otherwise the card stays in its
  // dimension-only legacy mode.
  const weakestSubSkillForLink =
    hasSubSkillData && weakest
      ? subSkillBreakdown[weakest.dimension]?.weakest
        ? {
            id: subSkillBreakdown[weakest.dimension]!.weakest!.id,
            avg: subSkillBreakdown[weakest.dimension]!.weakest!.stat.avg,
          }
        : null
      : null;
  const totalSubSkillObservations = Object.values(subSkillStats).reduce(
    (sum, s) => sum + (s?.sampleSize ?? 0),
    0,
  );

  // Fetch cohort separately since it depends on the membership.
  const cohort = leagueMember
    ? await getCohortLeaderboard(leagueMember.leagueId)
    : [];

  const hasAnyReps = recent.length > 0;
  const avgRecent = hasAnyReps
    ? Math.round(
        recent.reduce((sum, r) => sum + r.compositeScore, 0) / recent.length,
      )
    : null;

  const baselineRep = profile?.baselineRepId
    ? await getRepById(profile.baselineRepId)
    : null;
  const baselineComposite = baselineRep
    ? Math.round(baselineRep.compositeScore)
    : null;

  const insights = buildNarrativeInsights(trends, avgRecent);

  // ——— Today's focus dimension ————————————————————————
  // Lowest-scoring dim from the most recent point per dimension; falls back
  // to the first untrained dimension; falls back to "clarity".
  const focus = pickFocusDim(trends);

  // ——— This-week rep counts per mode ——————————————————
  // We don't track mode per rep here; instead derive a single "reps this
  // week" total from activity, then split heuristically across the three
  // tiles. For now, surface the total on Daily Workout and show 0/0 on the
  // other two — they'll get wired up when per-mode rep history lands.
  const sevenDayActivity = activity.slice(-7);
  const totalRepsThisWeek = sevenDayActivity.reduce(
    (s, d) => s + d.count,
    0,
  );

  // ——— Empty state: brand-new user, no reps yet ————————
  if (!hasAnyReps) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-brand-lavender/10 to-brand-magenta/10 p-8 shadow-[0_18px_60px_-30px_rgba(176,114,255,0.5)] md:p-10">
          <div
            className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-50 blur-3xl"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle, rgba(176,114,255,0.3), transparent 70%)",
            }}
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Welcome, {firstName}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
              Day 1 of becoming someone who never loses the room.
            </h1>
            <p className="mt-3 text-base text-ink-600 md:text-lg">
              Five minutes. Four reps. Instant feedback. Your first rep becomes the baseline every future rep gets measured against.
            </p>
            <DayDotsPreview className="mt-7" />
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <GradientButton href="/workout" size="lg">
                Start your first rep <ArrowRight className="ml-1 size-4" />
              </GradientButton>
              <Link
                href="/tutorial"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
              >
                Take the tour first
              </Link>
            </div>
            <p className="mt-6 text-xs text-ink-500">
              Prefer to start smaller?{" "}
              <Link
                href="/build-a-rep"
                className="font-semibold text-brand-purple hover:underline"
              >
                Build a single rep around a real conversation you&rsquo;re
                preparing for →
              </Link>
            </p>
          </div>
        </div>
        {/* Ch.17 — DNA stats motivator strip on the empty state. Only
         *  surfaces for users with 0 reps so it doesn't crowd the
         *  established-user dashboard. Seed by date so the rotation is
         *  stable through SSR + hydration. */}
        <div className="mt-10">
          <DnaStatsStrip
            seed={`dashboard-empty::${new Date().toISOString().slice(0, 10)}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10 md:py-12">
      <ResumeBanner />

      {profile && (
        <LevelStreakCard
          level={profile.level}
          xp={profile.xp}
          currentStreakDays={streakStatus.streakDays}
          longestStreakDays={streakStatus.streakDays}
        />
      )}

      {profile && (
        <WeakestLinkCard
          weakest={weakest}
          totalReps={profile.lifetimeReps}
          weakestSubSkill={weakestSubSkillForLink}
        />
      )}

      {subSkillUiEnabled && profile && profile.lifetimeReps > 0 && (
        <SubSkillBreakdownCard
          breakdown={subSkillBreakdown}
          totalSampleSize={totalSubSkillObservations}
        />
      )}

      {profile && profile.lifetimeReps > 0 && (
        <StreakCalendar
          activity={activity.slice(-30)}
          currentStreakDays={streakStatus.streakDays}
        />
      )}

      {todaysQuests && (
        <DailyQuestsStrip
          quests={todaysQuests.quests}
          completedIds={todaysQuests.completedIds}
        />
      )}

      {leagueMember && cohort.length > 0 && user && (
        <LeagueBoard
          tier={leagueMember.tier}
          selfUserId={user.id}
          cohort={cohort.map((m) => ({
            userId: m.userId,
            weeklyXp: m.weeklyXp,
            handle: anonymousHandle(m.userId, m.weekStart),
          }))}
        />
      )}

      <DashboardHero
        firstName={firstName}
        streakDays={streakStatus.streakDays}
        freezesAvailable={streakStatus.freezesAvailable}
        activeToday={streakStatus.activeToday}
        avgRecent={avgRecent}
        baselineComposite={baselineComposite}
        focusDim={focus.dim}
        focusDimScore={focus.score}
      />

      <WeekCalendar activity={sevenDayActivity} />

      <TrainingStackRow
        modes={[
          {
            href: "/workout",
            label: "Time to train",
            tagline:
              "Four speaking reps across different skill drills. Instant feedback after each one. One improvement to focus on every rep.",
            repsThisWeek: totalRepsThisWeek,
            iconKey: "workout",
          },
          {
            href: "/skill-lab",
            label: "Skill Lab",
            tagline:
              "Pick one of the six core skills and drill it with focused exercises until it clicks.",
            repsThisWeek: 0,
            iconKey: "lab",
          },
          {
            href: "/build-a-rep",
            label: "Build a Rep",
            tagline:
              "Describe a real moment you need to prepare for. Get a structure for your thinking and run the rep.",
            repsThisWeek: 0,
            iconKey: "build",
          },
        ]}
      />

      <LibraryCallout />

      {/* Ch.14 — DNA Gap 7. Six-dim running-average grid: weighted
       *  recent average + 14-day delta arrow per dim. Sits above the
       *  legacy SkillProgressBlock (latest-score bars) so users see
       *  smoothed-vs-latest at a glance. Always mounted (renders
       *  empty-state tiles for new users) so the six trained dims are
       *  visible from rep #0. */}
      {profile && <SkillAveragesGrid averages={runningAverages} />}

      <SkillProgressBlock
        trends={trends}
        streakDays={streakStatus.streakDays}
        repsToday={streakStatus.activeToday ? sevenDayActivity[6]?.count ?? 0 : 0}
        totalSessions={recent.length}
      />

      {insights.length > 0 && <CoachMemo insights={insights} />}

      {hasAnyReps && <LastSessions recent={recent} />}
    </div>
  );
}

function SkillProgressBlock({
  trends,
  streakDays,
  repsToday,
  totalSessions,
}: {
  trends: { dimension: SkillDimension; points: { score: number }[] }[];
  streakDays: number;
  repsToday: number;
  totalSessions: number;
}) {
  const allDims: SkillDimension[] = [
    ...SKILL_DIMENSION_GROUPS.content,
    ...SKILL_DIMENSION_GROUPS.delivery,
  ];
  const latest = new Map<SkillDimension, number>();
  for (const t of trends) {
    if (t.points.length > 0) {
      latest.set(t.dimension, t.points[t.points.length - 1]!.score);
    }
  }
  const stats = [
    { label: "Day streak", value: streakDays },
    { label: "Reps today", value: repsToday },
    { label: "Total sessions", value: totalSessions },
  ];
  return (
    <section className="rounded-3xl border border-ink-200 bg-white p-6 md:p-7">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
          Six core skills
        </p>
        <p className="text-[11px] font-medium text-ink-400">
          What every Cognify rep is scored on.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {allDims.map((dim) => {
          const score = latest.get(dim) ?? null;
          const isContent = (
            SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]
          ).includes(dim);
          return (
            <div key={dim}>
              <div className="flex items-baseline justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-800">
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
                  {score ?? "—"}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="brand-gradient h-full rounded-full transition-[width]"
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-7 grid grid-cols-3 gap-4 border-t border-ink-200 pt-5 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="brand-gradient-text text-3xl font-extrabold tabular-nums">
              {s.value}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ——— Coach memo (server-rendered, dark gradient) ————————————

function CoachMemo({
  insights,
}: {
  insights: ReturnType<typeof buildNarrativeInsights>;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-transparent bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 p-6 text-white shadow-[0_24px_60px_-24px_rgba(20,20,40,0.5)] md:p-8">
      <div
        className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full blur-3xl"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle, rgba(106,163,255,0.35), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-12 size-56 rounded-full blur-3xl"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle, rgba(231,124,240,0.3), transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="brand-gradient grid size-9 place-items-center rounded-xl">
            <Sparkles className="size-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-lavender">
              Coach&rsquo;s memo
            </p>
            <p className="text-sm font-semibold text-white/80">
              What moved this week
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold tabular-nums text-white/80">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-start gap-2">
                  <InsightIcon kind={insight.kind} />
                  <p className="text-[13px] leading-relaxed text-white/90 md:text-sm">
                    {insight.text}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex justify-end">
          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur-sm transition hover:bg-white/15"
          >
            See full progress
            <ArrowRight className="size-3" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function InsightIcon({
  kind,
}: {
  kind: "improvement" | "strength" | "steady" | "regression" | "opportunity";
}) {
  const cls = "mt-0.5 size-3.5 shrink-0";
  switch (kind) {
    case "improvement":
      return <TrendingUp className={`${cls} text-emerald-400`} strokeWidth={2.5} />;
    case "regression":
      return <TrendingDown className={`${cls} text-rose-400`} strokeWidth={2.5} />;
    case "strength":
      return <Sparkles className={`${cls} text-amber-300`} strokeWidth={2.5} />;
    case "steady":
      return <Activity className={`${cls} text-brand-lavender`} strokeWidth={2.5} />;
    case "opportunity":
      return <Target className={`${cls} text-brand-magenta`} strokeWidth={2.5} />;
  }
}

// ——— Last sessions (server-rendered, three cards) ——————————

type RecentRep = Awaited<ReturnType<typeof getRecentReps>>[number];

function LastSessions({ recent }: { recent: RecentRep[] }) {
  // Show 3 most recent in card form; older live behind /progress.
  const top = recent.slice(0, 3);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
          Last sessions
        </h2>
        <Link
          href="/progress"
          className="text-xs font-bold text-brand-purple hover:text-brand-magenta"
        >
          See all →
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {top.map((rep) => (
          <SessionCard key={rep.id} rep={rep} />
        ))}
      </div>
    </section>
  );
}

function SessionCard({ rep }: { rep: RecentRep }) {
  const composite = Math.round(rep.compositeScore);
  // Pill bars proportional to composite — a tiny readout at the bottom of
  // the card so each session feels alive.
  const fillPct = Math.max(8, Math.min(100, composite));
  const date = new Date(rep.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const seconds = Math.round(rep.durationMs / 1000);
  return (
    <Link
      href={`/progress/rep/${rep.id}` as never}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-white to-brand-lavender/5 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-purple/30 hover:shadow-[0_12px_36px_-16px_rgba(176,114,255,0.45)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-800">
            {rep.promptText}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-ink-400">
            {date} · {seconds}s
          </p>
        </div>
        <div className="brand-gradient-text shrink-0 text-2xl font-extrabold tabular-nums leading-none">
          {composite}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className="brand-gradient h-full rounded-full"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="inline-flex items-center gap-1 text-brand-purple opacity-0 transition-opacity group-hover:opacity-100">
          <Mic className="size-3" strokeWidth={2.5} />
          Run it back
        </span>
        <span className="text-ink-400">→ progress</span>
      </div>
    </Link>
  );
}

// ——— Today's focus dimension picker ————————————————————

function pickFocusDim(
  trends: { dimension: SkillDimension; points: { score: number }[] }[],
): { dim: SkillDimension | null; score: number | null } {
  // Latest score per dimension
  const latest = new Map<SkillDimension, number>();
  for (const t of trends) {
    if (t.points.length === 0) continue;
    latest.set(t.dimension, t.points[t.points.length - 1]!.score);
  }

  // First untrained dim takes priority — gives the user a clear next step
  for (const d of SKILL_DIMENSIONS) {
    if (!latest.has(d)) return { dim: d, score: null };
  }

  // Otherwise lowest-scored dim
  let weakest: SkillDimension | null = null;
  let min = Infinity;
  for (const [d, s] of latest) {
    if (s < min) {
      min = s;
      weakest = d;
    }
  }
  return weakest
    ? { dim: weakest, score: Math.round(min) }
    : { dim: null, score: null };
}

