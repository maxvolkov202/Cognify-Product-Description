import Link from "next/link";
import { Activity, ArrowRight, UserPlus } from "lucide-react";
import type { ActivityRow } from "@/lib/db/queries/activity";
import { ActivityFeedRow } from "@/components/product/friends/ActivityFeedRow";

/**
 * Dashboard "Friends activity" card (Phase 4, task 4.1). Mounts the shared
 * `ActivityFeedRow` on the dashboard, fed by `getActivityFeedForUser`. Hard
 * caps at 10 rows and links out to /friends for the full feed (the "Show more"
 * pagination lives there). Empty state is a "Find friends" CTA.
 *
 * Gated by FF_DASHBOARD_SOCIAL at the call site.
 */
export function DashboardFriendsActivity({ rows }: { rows: ActivityRow[] }) {
  const shown = rows.slice(0, 10);

  return (
    <section className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-white">
            <Activity
              className="size-4 text-brand-purple dark:text-brand-lavender"
              aria-hidden="true"
            />
            Friends activity
          </h2>
          <Link
            href="/friends"
            className="flex items-center gap-1 text-xs font-semibold text-brand-purple hover:underline dark:text-brand-lavender"
          >
            See all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {shown.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center dark:border-ink-700">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              Your crew&rsquo;s reps show up here. Add a friend to get started.
            </p>
            <Link
              href="/friends"
              className="brand-gradient mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Find friends
            </Link>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            {shown.map((a) => (
              <ActivityFeedRow key={a.id} row={a} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
