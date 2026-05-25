"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, X } from "lucide-react";

type Props = {
  /** Server-computed: today's date in YYYY-MM-DD, used as the dismissal
   *  key so the notification reappears tomorrow without storage leakage. */
  todayISO: string;
};

/**
 * Phase D — dismissible rest-day notification.
 *
 * Surfaces on /dashboard above the hero when today isn't in the user's
 * committed_days schedule. Acts like a soft notification, not a hard
 * banner: user can dismiss with the X. Dismissal persists for today
 * only (localStorage `cognify.rest-day-dismissed.<YYYY-MM-DD>`),
 * so tomorrow's rest day (if any) surfaces fresh.
 *
 * Copy: rest day acknowledgement + voluntary-rep XP incentive. Tapping
 * the "Train anyway" CTA navigates to /workout where the XP bonus
 * applies automatically server-side.
 */
export function RestDayNotification({ todayISO }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `cognify.rest-day-dismissed.${todayISO}`;
      const dismissed = window.localStorage.getItem(key);
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [todayISO]);

  function dismiss() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `cognify.rest-day-dismissed.${todayISO}`,
        "1",
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          className="mb-4"
        >
          <div className="brand-gradient relative flex items-start gap-3 rounded-2xl p-4 text-white shadow-[0_8px_24px_-10px_rgba(151,136,255,0.5)] sm:p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 text-lg">
              <span aria-hidden="true">💪</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold sm:text-base">
                Today&rsquo;s a rest day.
              </p>
              <p className="mt-0.5 text-xs leading-snug text-white/90 sm:text-sm">
                You don&rsquo;t owe a workout today.{" "}
                <span className="font-bold">Train anyway</span> for{" "}
                <span className="font-bold">+50% XP</span> on every rep, or
                come back tomorrow.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/workout"
                  className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold text-brand-purple shadow-sm transition hover:bg-white"
                >
                  Train anyway
                  <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </Link>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:text-white"
                >
                  Maybe tomorrow
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
