"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, Calendar } from "lucide-react";

type DayActivity = {
  date: string; // YYYY-MM-DD
  count: number;
  composite: number;
};

type Props = {
  activity: DayActivity[];
  days?: number;
};

/**
 * 30-day activity ribbon. Each day is a rounded pill whose height encodes
 * average composite score and whose fill encodes presence-of-reps. Today
 * gets a soft brand ring. Tapping a day navigates to /progress with a
 * date filter (parity with the old CalendarStrip behavior).
 */
export function ActivityRibbon({ activity, days = 30 }: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Pad the activity list so we always render `days` cells even on a
  // brand-new account.
  const todayKey = new Date().toISOString().slice(0, 10);
  const map = new Map(activity.map((d) => [d.date, d]));
  const cells: DayActivity[] = [];
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    cells.push(map.get(key) ?? { date: key, count: 0, composite: 0 });
  }

  const hovered = hoveredDate
    ? cells.find((c) => c.date === hoveredDate)
    : null;

  // Best in-window composite, used to scale heights so a low-activity user
  // still sees variation in the ribbon.
  const bestComposite = Math.max(...cells.map((c) => c.composite), 60);

  return (
    <section className="rounded-3xl border border-ink-200 bg-white p-5 md:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-brand-purple" strokeWidth={2.5} />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
            Last {days} days
          </p>
          <p className="hidden text-[11px] font-medium text-ink-400 md:block">
            {hovered
              ? `${formatDate(hovered.date)} · ${hovered.count} rep${hovered.count === 1 ? "" : "s"}${
                  hovered.count > 0
                    ? ` · avg ${Math.round(hovered.composite)}`
                    : ""
                }`
              : "Hover any day for detail"}
          </p>
        </div>
        <Link
          href="/progress"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-purple hover:text-brand-magenta"
        >
          Full history
          <ArrowRight className="size-3" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="flex h-20 items-end gap-[3px]">
        {cells.map((d, i) => {
          const isToday = d.date === todayKey;
          const hasReps = d.count > 0;
          const heightPct = hasReps
            ? Math.max(20, (d.composite / bestComposite) * 100)
            : 16;
          return (
            <Link
              key={d.date}
              href={`/progress?date=${d.date}` as never}
              onMouseEnter={() => setHoveredDate(d.date)}
              onMouseLeave={() => setHoveredDate(null)}
              onFocus={() => setHoveredDate(d.date)}
              onBlur={() => setHoveredDate(null)}
              className="relative flex h-full flex-1 items-end"
              aria-label={`${d.date}, ${d.count} reps${hasReps ? `, avg score ${Math.round(d.composite)}` : ""}`}
            >
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: `${heightPct}%`,
                  opacity: 1,
                }}
                transition={{ duration: 0.4, delay: i * 0.012, ease: "easeOut" }}
                className={`w-full rounded-full transition-transform group-hover:scale-y-105 ${
                  hasReps
                    ? isToday
                      ? "brand-gradient ring-2 ring-brand-purple/30 ring-offset-2"
                      : "brand-gradient"
                    : isToday
                      ? "bg-ink-100 ring-2 ring-brand-purple/30 ring-offset-2"
                      : "bg-ink-100"
                } ${hoveredDate === d.date ? "scale-y-110" : ""}`}
                style={{
                  // Brighten newer days slightly so the eye walks left-to-right.
                  filter: hasReps ? "saturate(1)" : undefined,
                }}
              />
            </Link>
          );
        })}
      </div>

      {/* Mobile-friendly inline hover detail */}
      <div className="mt-3 text-[11px] font-medium text-ink-500 md:hidden">
        {hovered
          ? `${formatDate(hovered.date)} · ${hovered.count} rep${hovered.count === 1 ? "" : "s"}${
              hovered.count > 0 ? ` · avg ${Math.round(hovered.composite)}` : ""
            }`
          : "Tap any day for detail"}
      </div>
    </section>
  );
}

function formatDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  if (!y || !m || !d) return yyyymmdd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
