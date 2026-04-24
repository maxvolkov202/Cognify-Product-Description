"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Flame, X } from "lucide-react";
import type { DayActivity } from "@/lib/db/queries/progress";
import { cn } from "@/lib/utils/cn";

type Props = {
  activity: DayActivity[];
  days?: number;
};

type DayCell = {
  date: string;
  iso: string;
  dayOfMonth: number;
  weekday: string;
  count: number;
  composite: number;
  inStreak: boolean;
  isToday: boolean;
};

/**
 * Duolingo-style horizontal 30-day (or N-day) calendar strip for the
 * dashboard. Each day is a colored circle:
 *   - empty gray: no reps
 *   - yellow: composite 0-60 (warmup-quality rep)
 *   - green: 60-80 (solid rep)
 *   - bright green: 80+ (peak)
 *
 * Flame overlay appears on consecutive streak days. Tapping a day opens
 * a modal with that day's rep list.
 */
export function CalendarStrip({ activity, days = 30 }: Props) {
  const cells = useMemo(() => buildCells(activity, days), [activity, days]);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedCell = cells.find((c) => c.iso === selected);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Last {days} days
        </p>
        <Link
          href="/progress"
          className="text-[11px] font-semibold text-brand-purple hover:underline"
        >
          Full history →
        </Link>
      </div>

      <div className="overflow-x-auto px-5 py-5">
        <div className="flex min-w-max items-end gap-2 md:gap-2.5">
          {cells.map((cell) => (
            <button
              key={cell.iso}
              type="button"
              onClick={() => cell.count > 0 && setSelected(cell.iso)}
              className={cn(
                "group relative flex min-w-[44px] flex-col items-center gap-1.5",
                cell.count === 0 && "cursor-default",
              )}
              title={
                cell.count > 0
                  ? `${cell.date} · ${cell.count} rep${cell.count === 1 ? "" : "s"} · avg ${Math.round(cell.composite)}`
                  : `${cell.date} — no reps`
              }
            >
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  cell.isToday ? "text-brand-purple" : "text-ink-400",
                )}
              >
                {cell.weekday}
              </span>
              <DayCircle cell={cell} />
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  cell.isToday ? "text-brand-purple" : "text-ink-500",
                )}
              >
                {cell.dayOfMonth}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && selectedCell && (
        <DayDetailModal
          cell={selectedCell}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function DayCircle({ cell }: { cell: DayCell }) {
  if (cell.count === 0) {
    return (
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full border-2 border-dashed border-ink-200 bg-white",
          cell.isToday && "border-brand-purple/60 bg-brand-purple/5",
        )}
      />
    );
  }

  const bg =
    cell.composite >= 80
      ? "bg-success text-white"
      : cell.composite >= 60
        ? "bg-success/70 text-white"
        : "bg-amber-400 text-ink-900";

  return (
    <span
      className={cn(
        "relative grid size-11 place-items-center rounded-full text-sm font-extrabold tabular-nums shadow-sm transition-transform group-hover:scale-110",
        bg,
        cell.isToday && "ring-2 ring-brand-purple/70 ring-offset-2",
      )}
    >
      {Math.round(cell.composite)}
      {cell.inStreak && cell.count > 0 && (
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-white shadow-sm">
          <Flame
            className="size-2.5 text-amber-500"
            fill="currentColor"
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}

function DayDetailModal({
  cell,
  onClose,
}: {
  cell: DayCell;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="surface-card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {cell.date}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">
              {cell.count} rep{cell.count === 1 ? "" : "s"} · avg{" "}
              {Math.round(cell.composite)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="border-t border-ink-100 p-5 text-sm text-ink-600">
          <p>
            View the full rep history in{" "}
            <Link
              href="/progress"
              className="font-semibold text-brand-purple hover:underline"
            >
              progress
            </Link>{" "}
            — each day&rsquo;s reps, scores, and transcripts are searchable
            there.
          </p>
        </div>
      </div>
    </div>
  );
}

function buildCells(activity: DayActivity[], days: number): DayCell[] {
  const map = new Map<string, DayActivity>();
  for (const a of activity) map.set(a.date, a);

  const today = new Date();
  const todayIso = toISO(today);
  const out: DayCell[] = [];

  // Build the list of dates oldest → newest so the strip reads L→R as time forward.
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = toISO(d);
    const match = map.get(iso);
    out.push({
      date: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      iso,
      dayOfMonth: d.getDate(),
      weekday: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      count: match?.count ?? 0,
      composite: match?.composite ?? 0,
      inStreak: false,
      isToday: iso === todayIso,
    });
  }

  // Mark streak days — consecutive run ending today or yesterday with count > 0.
  for (let i = out.length - 1; i >= 0; i--) {
    const cell = out[i]!;
    if (cell.count === 0) {
      if (cell.isToday) continue; // tolerate today-has-no-rep without breaking streak
      break;
    }
    cell.inStreak = true;
  }

  return out;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
