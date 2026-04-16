import Link from "next/link";
import { GradientButton } from "@/components/shared/GradientButton";
import { ArrowRight, Brain, Flame, Sparkles } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getRecentReps,
  getStreakDays,
  getActivityHeatmap,
  getSkillTrends,
  getRepById,
} from "@/lib/db/queries/progress";
import { CalendarStrip } from "@/components/product/CalendarStrip";
import { ThisWeekCard } from "@/components/product/ThisWeekCard";
import { buildNarrativeInsights } from "@/lib/insights/narrative";

export default async function DashboardPage() {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const [streak, recent, activity, trends, profile] = await Promise.all([
    getStreakDays(userId),
    getRecentReps(userId, 5),
    getActivityHeatmap(userId, 30),
    getSkillTrends(userId, 14),
    user ? getUserProfile(user.id) : Promise.resolve(null),
  ]);

  const hasAnyReps = recent.length > 0;
  const avgRecent = hasAnyReps
    ? Math.round(
        recent.reduce((sum, r) => sum + r.compositeScore, 0) / recent.length,
      )
    : null;

  const baselineRep = profile?.baselineRepId
    ? await getRepById(profile.baselineRepId)
    : null;

  const insights = buildNarrativeInsights(trends, avgRecent);

  // ——— Empty state: brand-new user, no reps yet (P3) ——————————
  if (!hasAnyReps) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="surface-card overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-8 md:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Welcome, {firstName}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
              You haven&rsquo;t trained yet.
            </h1>
            <p className="mt-3 text-base text-ink-600 md:text-lg">
              Your first rep becomes your baseline — the number every future
              rep gets measured against. 10 minutes, four reps, instant
              feedback. That&rsquo;s the workout.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <GradientButton href="/workout" size="lg">
                Start your first workout <ArrowRight className="ml-1 size-4" />
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
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 space-y-8">
      {/* ——— Hero ——————————————————————————————————————— */}
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Welcome back
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Hey {firstName}. Time to train.
        </h1>
        {baselineRep && avgRecent !== null && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold text-brand-purple">
            <Sparkles className="size-3" />
            Baseline {Math.round(baselineRep.compositeScore)} · recent{" "}
            {avgRecent}
            {avgRecent > baselineRep.compositeScore
              ? ` (+${Math.round(avgRecent - baselineRep.compositeScore)})`
              : avgRecent < baselineRep.compositeScore
                ? ` (${Math.round(avgRecent - baselineRep.compositeScore)})`
                : ""}
          </p>
        )}
      </header>

      {/* ——— Calendar strip ——————————————————————————— */}
      <CalendarStrip activity={activity} days={30} />

      {/* ——— Today's workout (with inline streak) —————— */}
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="grid gap-6 p-7 md:grid-cols-[1.4fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <Flame className="size-3.5 text-brand-purple" />
              Today&rsquo;s Workout
              {streak > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Day {streak} streak
                </span>
              )}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-ink-900">
              4 reps · ~10 minutes
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              Four speaking reps across different skill drills. Instant feedback
              after each — with a quote, a suggested rewrite, and one thing to
              try on the next rep.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <GradientButton href="/workout" size="lg">
              Start workout <ArrowRight className="ml-1 size-4" />
            </GradientButton>
            {avgRecent !== null && (
              <p className="text-xs text-ink-500">
                Recent composite:{" "}
                <span className="brand-gradient-text font-extrabold tabular-nums">
                  {avgRecent}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ——— Two mode cards —————————————————————————— */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard
          href="/workout"
          icon={<Flame className="size-5 text-white" />}
          title="Daily Workout"
          body="Build the habit. 10 minutes, 4–5 reps, every day. Each rep now shows a framework cheat-sheet to speak against — hide it to practice blind."
        />
        <ModeCard
          href="/build-a-rep"
          icon={<Brain className="size-5 text-white" />}
          title="Build a Rep"
          body="Describe a real moment you're about to face. Pick a stakeholder, spell out the outcome, get a structure. Not a script — a scaffold."
        />
      </div>

      {/* ——— This week narrative —————————————————————— */}
      {insights.length > 0 && <ThisWeekCard insights={insights} />}

      {/* ——— Recent reps ——————————————————————————— */}
      {hasAnyReps && (
        <section className="surface-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Recent reps
            </h2>
            <Link
              href="/progress"
              className="text-xs font-semibold text-brand-purple hover:text-brand-magenta"
            >
              See all →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-ink-100">
            {recent.map((rep) => (
              <li
                key={rep.id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-800">
                    {rep.promptText}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {new Date(rep.createdAt).toLocaleDateString()} ·{" "}
                    {(rep.durationMs / 1000).toFixed(0)}s
                  </p>
                </div>
                <span className="brand-gradient-text text-lg font-extrabold tabular-nums">
                  {Math.round(rep.compositeScore)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ModeCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href as never}
      className="surface-card group p-5 transition-shadow hover:shadow-[var(--shadow-glow)]"
    >
      <div className="brand-gradient grid size-10 place-items-center rounded-xl">
        {icon}
      </div>
      <h3 className="mt-3 text-lg font-bold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </Link>
  );
}
