"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, X } from "lucide-react";
import { loadPauseState, clearPauseState } from "@/lib/workout/pause";

/**
 * Dashboard resume banner — renders only when a paused workout exists
 * in localStorage and hasn't expired (24h). Click "Resume" to jump to
 * /workout where the session state will be re-hydrated. Click dismiss
 * to clear the pause and start fresh.
 *
 * Client-only by necessity (localStorage), so this is a small island
 * above the server-rendered dashboard body. Renders nothing on SSR and
 * for users with no paused session.
 */
export function ResumeBanner() {
  const [paused, setPaused] = useState<{
    repCount: number;
    completed: number;
    pausedAt: number;
  } | null>(null);

  useEffect(() => {
    const state = loadPauseState();
    if (!state) return;
    setPaused({
      repCount: state.plan.reps.length,
      completed: state.currentRepIndex,
      pausedAt: state.pausedAt,
    });
  }, []);

  if (!paused) return null;

  const pausedAt = new Date(paused.pausedAt);
  const elapsedMin = Math.round((Date.now() - paused.pausedAt) / 60_000);
  const elapsedLabel =
    elapsedMin < 1
      ? "just now"
      : elapsedMin < 60
        ? `${elapsedMin} min ago`
        : elapsedMin < 60 * 24
          ? `${Math.round(elapsedMin / 60)}h ago`
          : pausedAt.toLocaleDateString();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-purple/15 text-brand-purple">
        <Play className="size-4 translate-x-0.5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
          Paused workout · {elapsedLabel}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-ink-900">
          You completed {paused.completed} of {paused.repCount} reps. Pick
          up where you left off — your scores carry over.
        </p>
      </div>
      <Link
        href="/workout"
        className="brand-gradient shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm"
      >
        Resume
      </Link>
      <button
        type="button"
        onClick={() => {
          clearPauseState();
          setPaused(null);
        }}
        aria-label="Dismiss paused workout"
        className="grid size-8 shrink-0 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-900"
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
