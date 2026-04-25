"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import type { CalendarHistory, CalendarDay } from "@/lib/db/queries/calendar-history";

type Props = {
  /** Slot for the trigger button — click opens the modal. */
  trigger: ReactNode;
  /** Server action wrapper that returns CalendarHistory or null. The
   *  modal calls this on first open and caches the result for 5 minutes. */
  loadHistory: () => Promise<CalendarHistory | null>;
};

/**
 * Cognify-themed history calendar modal — opens from any "Full history"
 * trigger on the dashboard. Anchored at the user's signup date, grows
 * naturally month by month as time passes.
 */
export function HistoryCalendarModal({ trigger, loadHistory }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CalendarHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number>(0);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    const stale = !history || Date.now() - fetchedAt > 5 * 60 * 1000;
    if (stale && !loading) {
      setLoading(true);
      try {
        const data = await loadHistory();
        setHistory(data);
        setFetchedAt(Date.now());
      } finally {
        setLoading(false);
      }
    }
  }, [history, fetchedAt, loading, loadHistory]);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, handleClose]);

  return (
    <>
      <span onClick={handleOpen} className="contents">
        {trigger}
      </span>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-900/40 p-3 backdrop-blur-sm md:items-center md:p-6"
            onClick={handleClose}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-calendar-title"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-[0_24px_80px_-30px_rgba(20,20,40,0.45)]"
            >
              {/* Brand gradient header. Title ties to the Day-1 framing
               *  used on the empty-state card, so a returning user reads
               *  "your communication arc" as the same story arc they
               *  saw on their first day. */}
              <div className="relative overflow-hidden">
                <div className="brand-gradient absolute inset-0" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-3 p-6 text-white md:p-7">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/80">
                      Your communication arc
                    </p>
                    <h2
                      id="history-calendar-title"
                      className="mt-1.5 text-3xl font-extrabold tracking-tight md:text-4xl"
                    >
                      {history
                        ? `Day ${history.daysSinceSignup}`
                        : loading
                          ? "Loading…"
                          : "Day 1"}
                    </h2>
                    <p className="mt-1 text-[13px] text-white/85">
                      {history
                        ? `Started ${formatLongDate(history.signupAt)}.`
                        : "Started today."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="grid size-9 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                    aria-label="Close"
                  >
                    <X className="size-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 md:p-7">
                {loading && !history && <CalendarLoading />}
                {!loading && !history && <CalendarEmpty />}
                {history && <CalendarBody history={history} />}
              </div>

              <div className="border-t border-ink-200 bg-ink-50/60 px-5 py-3 md:px-7">
                <Link
                  href="/progress"
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-purple hover:text-brand-magenta"
                >
                  Open full progress dashboard
                  <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CalendarBody({ history }: { history: CalendarHistory }) {
  // Group days into months for vertical scrolling blocks.
  const monthGroups = useMemo(() => groupByMonth(history.days), [history.days]);

  return (
    <div>
      <StatsRow history={history} />
      <div className="mt-6 space-y-6">
        {monthGroups.map((g) => (
          <MonthBlock
            key={g.key}
            label={g.label}
            days={g.days}
            signupDate={history.signupDate}
            todayDate={history.todayDate}
          />
        ))}
      </div>
      <Legend />
    </div>
  );
}

function StatsRow({ history }: { history: CalendarHistory }) {
  const stats = [
    { label: "Total days", value: history.daysSinceSignup },
    { label: "Active days", value: history.activeDays },
    { label: "Total reps", value: history.totalReps },
    { label: "Longest streak", value: history.longestStreak },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-ink-200 bg-white p-3 text-center"
        >
          <p className="brand-gradient-text text-2xl font-extrabold tabular-nums leading-none">
            {s.value.toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function MonthBlock({
  label,
  days,
  signupDate,
  todayDate,
}: {
  label: string;
  days: CalendarDay[];
  signupDate: string;
  todayDate: string;
}) {
  // Build a 7×N grid: pad leading weekday gap so days align to the day-of-week header.
  const first = new Date(`${days[0]!.date}T00:00:00Z`);
  const leadingPad = first.getUTCDay(); // 0 = Sun
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: leadingPad }, () => null),
    ...days,
  ];

  const dowLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-500">
        {label}
      </h3>
      <div className="mb-2 grid grid-cols-7 gap-1.5 px-1">
        {dowLabels.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-300"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) =>
          c ? (
            <DayCell
              key={c.date}
              day={c}
              isSignup={c.date === signupDate}
              isToday={c.date === todayDate}
            />
          ) : (
            <span key={`pad-${i}`} className="aspect-square" aria-hidden="true" />
          ),
        )}
      </div>
    </section>
  );
}

function DayCell({
  day,
  isSignup,
  isToday,
}: {
  day: CalendarDay;
  isSignup: boolean;
  isToday: boolean;
}) {
  const intensity = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count === 2 ? 2 : 3;
  const dayNum = new Date(`${day.date}T00:00:00Z`).getUTCDate();
  const tooltip = `${formatShortDate(new Date(`${day.date}T00:00:00Z`))} · ${
    day.count === 0 ? "no reps" : `${day.count} rep${day.count === 1 ? "" : "s"}`
  }${day.count > 0 ? ` · avg ${Math.round(day.composite)}` : ""}${
    day.hasPressure ? " · pressure" : ""
  }`;

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={[
        "group relative grid aspect-square place-items-center rounded-md text-[10px] font-extrabold tabular-nums transition-transform hover:scale-105",
        intensity === 0 && "bg-ink-100 text-ink-400",
        intensity === 1 && "bg-brand-blue/30 text-ink-700",
        intensity === 2 && "bg-brand-lavender/60 text-white",
        intensity === 3 && "brand-gradient text-white",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Signup-day glow ring — anchors the entire view as a story.  */}
      {isSignup && (
        <span
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-brand-magenta ring-offset-1 ring-offset-white motion-safe:animate-pulse"
          aria-hidden="true"
        />
      )}
      {/* Today ring */}
      {isToday && !isSignup && (
        <span
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-brand-purple ring-offset-1 ring-offset-white"
          aria-hidden="true"
        />
      )}
      <span className="relative">{dayNum}</span>
      {day.hasPressure && (
        <span
          className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500"
          aria-hidden="true"
        />
      )}
      {isSignup && (
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-extrabold uppercase tracking-wider text-brand-magenta">
          Day 1
        </span>
      )}
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-[10px] font-semibold text-ink-500">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded bg-ink-100" />
        No reps
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded bg-brand-blue/30" />
        1 rep
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded bg-brand-lavender/60" />
        2 reps
      </span>
      <span className="flex items-center gap-1.5">
        <span className="brand-gradient size-2.5 rounded" />
        3+ reps
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Pressure that day
      </span>
    </div>
  );
}

function CalendarLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="size-8 animate-spin rounded-full border-2 border-brand-purple/30 border-t-brand-purple" />
      <p className="text-sm text-ink-500">Pulling your arc…</p>
    </div>
  );
}

function CalendarEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Sparkles className="size-8 text-brand-purple" strokeWidth={2} />
      <p className="text-sm font-semibold text-ink-700">
        Your arc starts with your first rep.
      </p>
      <p className="max-w-sm text-xs text-ink-500">
        Once you complete one rep, this view fills with your training history
        and grows day by day.
      </p>
    </div>
  );
}

function groupByMonth(days: CalendarDay[]) {
  const groups = new Map<string, CalendarDay[]>();
  for (const d of days) {
    const key = d.date.slice(0, 7); // YYYY-MM
    const arr = groups.get(key) ?? [];
    arr.push(d);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).map(([key, ds]) => ({
    key,
    label: formatMonthLabel(`${key}-01T00:00:00Z`),
    days: ds,
  }));
}

function formatMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

