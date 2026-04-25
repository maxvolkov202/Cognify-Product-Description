"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check } from "lucide-react";

type DayActivity = {
  date: string; // YYYY-MM-DD
  count: number;
  composite: number;
};

type Props = {
  activity: DayActivity[];
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * 7-day calendar (V2 Updates: dashboard redesign). Today is ringed in
 * brand-purple so the user always knows where they are; days with reps
 * fill brand-gradient and surface a check; empty days are neutral pills.
 */
export function WeekCalendar({ activity }: Props) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const map = new Map(activity.map((d) => [d.date, d]));
  const cells: DayActivity[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    cells.push(map.get(key) ?? { date: key, count: 0, composite: 0 });
  }

  return (
    <section className="rounded-3xl border border-ink-200 bg-white p-5 md:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
          This week
        </p>
        <Link
          href="/progress"
          className="text-[11px] font-bold text-brand-purple hover:text-brand-magenta"
        >
          Full history →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          const isToday = d.date === todayKey;
          const hasReps = d.count > 0;
          const dow = new Date(d.date + "T00:00:00").getDay();
          const dayNum = new Date(d.date + "T00:00:00").getDate();
          return (
            <motion.div
              key={d.date}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/progress?date=${d.date}` as never}
                className="group flex flex-col items-center gap-1.5"
                aria-label={`${d.date}, ${d.count} reps${
                  hasReps ? `, avg score ${Math.round(d.composite)}` : ""
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  {DOW[dow]}
                </span>
                <span
                  className={[
                    "grid size-11 place-items-center rounded-full text-sm font-extrabold tabular-nums transition-all",
                    hasReps
                      ? "brand-gradient text-white shadow-[0_8px_22px_-8px_rgba(176,114,255,0.5)]"
                      : "border border-ink-200 bg-ink-50 text-ink-500",
                    isToday && "ring-2 ring-brand-purple ring-offset-2",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {hasReps ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    dayNum
                  )}
                </span>
                <span
                  className={[
                    "text-[10px] font-semibold tabular-nums",
                    hasReps ? "text-ink-700" : "text-ink-400",
                  ].join(" ")}
                >
                  {hasReps ? Math.round(d.composite) : "—"}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
