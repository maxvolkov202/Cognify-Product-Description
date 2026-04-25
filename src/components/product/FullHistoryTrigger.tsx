"use client";

import { ArrowRight } from "lucide-react";
import { HistoryCalendarModal } from "./HistoryCalendarModal";
import { loadCalendarHistory } from "@/app/(app)/dashboard/calendar-actions";

type Variant = "compact" | "calendar" | "ribbon";

/**
 * Single client component that drops into every "Full history" entry point
 * on the dashboard (WeekCalendar / CalendarStrip / ActivityRibbon). Each
 * variant matches the original anchor's typography so we don't change the
 * ambient feel of the surrounding card — only the click behavior.
 */
export function FullHistoryTrigger({
  variant = "compact",
}: {
  variant?: Variant;
}) {
  const className =
    variant === "ribbon"
      ? "inline-flex items-center gap-1 text-[11px] font-bold text-brand-purple hover:text-brand-magenta"
      : "text-[11px] font-bold text-brand-purple hover:text-brand-magenta";

  const trigger = (
    <button type="button" className={className}>
      Full history
      {variant === "ribbon" ? (
        <ArrowRight className="size-3" strokeWidth={2.5} />
      ) : (
        " →"
      )}
    </button>
  );

  return (
    <HistoryCalendarModal
      trigger={trigger}
      loadHistory={() => loadCalendarHistory()}
    />
  );
}
