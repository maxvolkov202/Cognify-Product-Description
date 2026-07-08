// Phase 9 — muscle-group timeline + charts.
//
// Server component. Reads ?dim=clarity from searchParams; renders
// filter chips (one per muscle group + "All"), a composite-over-time
// line chart, a volume-bars chart (30/60/90 day windows), a
// training-time heatmap, and a chronological list of timeline rows.

import Link from "next/link";
import { currentUser } from "@/lib/session/current-user";
import {
  MUSCLE_GROUP_IDS,
  MUSCLE_GROUP_LABELS,
  type MuscleGroupId,
} from "@/types/domain";
import { getMuscleGroupTimeline } from "@/lib/db/queries/muscle-group-progress";
import CompositeLineChart from "@/components/product/progress/CompositeLineChart";
import VolumeBars from "@/components/product/progress/VolumeBars";
import TrainingHeatmap, {
  type HeatmapPoint,
} from "@/components/product/progress/TrainingHeatmap";
import MuscleGroupTimelineRow from "@/components/product/progress/MuscleGroupTimelineRow";

export const dynamic = "force-dynamic";

function isMuscleGroupId(s: string): s is MuscleGroupId {
  return (MUSCLE_GROUP_IDS as readonly string[]).includes(s);
}

type SearchParams = Promise<{ dim?: string }>;

export default async function MuscleGroupProgressPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const dimParam = params.dim ?? "";
  const dim: MuscleGroupId | null = isMuscleGroupId(dimParam) ? dimParam : null;

  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  const timeline = await getMuscleGroupTimeline(userId, dim, 60);

  if (process.env.NODE_ENV !== "production") {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "muscle_group_timeline_viewed",
        dim,
        rowCount: timeline.length,
      }),
    );
  }

  // Charts derive from the timeline (already user-scoped + sorted).
  const linePoints = timeline
    .slice()
    .reverse()
    .map((r) => ({ date: r.dayDate, composite: r.composite }));

  const now = Date.now();
  const counts = { d30: 0, d60: 0, d90: 0 };
  for (const r of timeline) {
    const ts = new Date(r.dayDate + "T00:00:00Z").getTime();
    const days = (now - ts) / 86_400_000;
    if (days <= 30) counts.d30 += r.completedReps;
    if (days <= 60) counts.d60 += r.completedReps;
    if (days <= 90) counts.d90 += r.completedReps;
  }
  const volumeBuckets = [
    { label: "30d", count: counts.d30 },
    { label: "60d", count: counts.d60 },
    { label: "90d", count: counts.d90 },
  ];

  // Heatmap derived from rep durations + day dates. We approximate
  // hour-of-day by assuming midday for now (the rep table doesn't
  // record clock time on its own; reps.createdAt is the truth but
  // wasn't pulled into the timeline aggregate). Phase 9 ships a
  // dow-only heatmap; richer hour resolution is a follow-up.
  const heatmapPoints: HeatmapPoint[] = timeline.map((r) => {
    const d = new Date(r.dayDate + "T00:00:00Z");
    return {
      dow: d.getUTCDay(),
      hour: 12,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">
          Muscle-group progress
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {dim
            ? `Showing ${MUSCLE_GROUP_LABELS[dim]} days across the last 60 sessions.`
            : "All muscle groups, most-recent-first. Filter by dim to see one in isolation."}
        </p>
      </header>

      {/* Filter chips */}
      <nav
        className="flex gap-1.5 overflow-x-auto pb-2 mb-6"
        aria-label="Filter by muscle group"
      >
        <FilterChip href="/progress/muscle-groups" active={dim === null}>
          All
        </FilterChip>
        {MUSCLE_GROUP_IDS.map((id) => (
          <FilterChip
            key={id}
            href={`/progress/muscle-groups?dim=${id}`}
            active={dim === id}
          >
            {MUSCLE_GROUP_LABELS[id]}
          </FilterChip>
        ))}
      </nav>

      {timeline.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-base text-slate-200 font-medium">
            No {dim ? MUSCLE_GROUP_LABELS[dim] : "muscle-group"} days yet.
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Complete a Daily Workout to start the timeline.
          </p>
          <Link
            href="/workout"
            className="inline-flex min-h-[44px] items-center mt-4 px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-sm font-medium"
          >
            Go to today&apos;s workout
          </Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Composite over time">
              <CompositeLineChart points={linePoints} />
            </ChartCard>
            <ChartCard title="Reps completed">
              <VolumeBars buckets={volumeBuckets} />
            </ChartCard>
            <ChartCard title="Training time" className="md:col-span-2">
              <TrainingHeatmap points={heatmapPoints} />
            </ChartCard>
          </section>

          <section
            className="flex flex-col gap-2"
            aria-label="Day timeline"
          >
            {timeline.map((row) => (
              <MuscleGroupTimelineRow key={row.dayId} row={row} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "min-h-[44px] min-w-[44px] justify-center px-3 inline-flex items-center rounded-full text-xs font-medium bg-pink-500/20 text-pink-100 border border-pink-400/50 whitespace-nowrap"
          : "min-h-[44px] min-w-[44px] justify-center px-3 inline-flex items-center rounded-full text-xs text-slate-300 border border-slate-700 hover:bg-slate-800 whitespace-nowrap"
      }
    >
      {children}
    </Link>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-xl border border-slate-800 bg-slate-900/40 p-4 " +
        (className ?? "")
      }
    >
      <h2 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}
