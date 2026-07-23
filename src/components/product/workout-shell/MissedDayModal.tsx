"use client";

// Phase 10 — missed-day / freeze-consumed / partial-day modal shown
// on app shell mount when there's an unread user_notifications row.
//
// One modal per unread notification of the lifecycle kinds; mark-read
// on dismiss so it doesn't fire again. Keeps mounted state ephemeral.

import { useCallback, useEffect, useState } from "react";
import { Snowflake, X, AlertCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  fetchPendingDayNotification,
  markNotificationRead,
  type PendingDayNotification,
} from "@/server/actions/notifications";

export default function MissedDayModal() {
  const [notif, setNotif] = useState<PendingDayNotification | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPendingDayNotification().then((res) => {
      if (cancelled) return;
      setNotif(res);
      // Mark read the instant it's shown, not on dismiss. The modal must
      // appear exactly once — earlier we only marked read inside the
      // dismiss handler, so exiting Daily Workout (or any navigation)
      // before that async write landed left the row unread and the
      // "Streak reset" modal fired again on the next entry. Marking on
      // display is best-effort and fire-and-forget; the visual stays up
      // until the user dismisses it.
      if (res) void markNotificationRead({ id: res.id });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onClose = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!notif || dismissed) return null;

  const { kind, payload } = notif;
  let icon: React.ReactNode = (
    <AlertCircle className="w-5 h-5 text-pink-300" />
  );
  let title = "Day closed out";
  let body: string | null = null;

  if (kind === "freeze_consumed") {
    icon = <Snowflake className="w-5 h-5 text-sky-300" />;
    title = "Your streak's safe";
    body = `Used 1 freeze. ${payload.dimension ? `${humanizeDim(payload.dimension)} day will rotate back around.` : ""}`;
  } else if (kind === "day_missed") {
    icon = <AlertCircle className="w-5 h-5 text-rose-300" />;
    title = "Streak reset";
    body = "No shame — the work compounds when you show up. Today's a new day.";
  } else if (kind === "day_partial") {
    title = "Showed up";
    body = `Streak still alive. Closed yesterday at ${payload.completedReps ?? 0} reps — try to close all 4 today.`;
  } else if (kind === "day_complete") {
    icon = <Trophy className="w-5 h-5 text-yellow-300" />;
    title = "Day complete";
    body = payload.dimension
      ? `${humanizeDim(payload.dimension)} day closed out. Baseline locked in.`
      : "Day closed out. Baseline locked in.";
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end sm:items-center justify-center",
        "bg-slate-950/70 backdrop-blur-sm p-4",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="missed-day-title"
    >
      <div
        className={cn(
          "relative overflow-hidden w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900",
          "p-5 shadow-2xl",
        )}
      >
        {/* Quiet brand-gradient hairline across the modal top. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-blue via-brand-lavender to-brand-magenta opacity-60"
        />
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <h2
              id="missed-day-title"
              className="text-base font-semibold text-slate-100"
            >
              {title}
            </h2>
            {body && (
              <p className="text-sm text-slate-400 mt-1 leading-snug">
                {body}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 -m-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function humanizeDim(dim: string): string {
  return dim
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
