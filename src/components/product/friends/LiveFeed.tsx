"use client";

import { useState } from "react";
import type { ActivityRow } from "@/lib/db/queries/activity";
import { ActivityFeedRow } from "@/components/product/friends/ActivityFeedRow";

const PAGE_SIZE = 10;

/**
 * Live feed on /friends — renders the first 10 events, then a ghost
 * "Show more" that reveals the next page (client-side, no refetch). The
 * server hands down more rows than the initial cap so there's something to
 * reveal (Phase 4, task 4.4).
 *
 * Rows lay out in a responsive multi-column grid so a full-width feed fills
 * its horizontal space and stays short — no internal scrollbar, no dead
 * whitespace beside a short neighbouring section. The dashboard card uses the
 * shared `ActivityFeedRow` directly (single column) with a hard cap of 10.
 */
export function LiveFeed({ rows }: { rows: ActivityRow[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = rows.slice(0, visible);
  const hasMore = visible < rows.length;

  return (
    <div>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => (
          <ActivityFeedRow key={a.id} row={a} />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 transition-colors hover:border-brand-purple hover:text-brand-purple dark:border-ink-700 dark:text-ink-300 dark:hover:border-brand-lavender dark:hover:text-brand-lavender"
        >
          Show more
        </button>
      )}
    </div>
  );
}
