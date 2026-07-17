"use client";

// PRD v3 Phase 5 — Build a Rep v2 home: conversational intake (PRD §7.3)
// + the user's active prep events. "The goal is to get users practicing
// as quickly as possible" — one description, one button.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Loader2, Sparkles, Target } from "lucide-react";
import { createPrepEvent } from "@/server/actions/prep-events";

const EXAMPLES = [
  "SDR interview at Salesforce next Thursday",
  "10-minute investor pitch for our seed round",
  "Best-man toast at my brother's wedding",
  "Quarterly business review with my VP",
];

export type PrepEventListItem = {
  id: string;
  title: string;
  eventType: string;
  readinessScore: number | null;
  momentCount: number;
  createdAt: string;
};

/** Readiness chip tint tiers with the score instead of always-emerald:
 *  <50 rose (not ready), 50-74 amber (getting there), ≥75 emerald. */
function readinessChipClass(score: number): string {
  if (score < 50)
    return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300";
  if (score < 75)
    return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300";
  return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
}

export default function PrepHome({
  initialEvents,
}: {
  initialEvents: PrepEventListItem[];
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (description.trim().length < 3 || creating) return;
    setCreating(true);
    setError(null);
    const res = await createPrepEvent({ description });
    if (res.ok) {
      router.push(`/build-a-rep/${res.eventId}`);
      return;
    }
    setError(
      res.reason === "premium_required"
        ? "Build a Rep event prep is a premium feature."
        : "Couldn't build your prep. Try again.",
    );
    setCreating(false);
  };

  return (
    <div className="isolate space-y-8">
      <header className="relative">
        {/* Brand glow behind the hero — matches the Skill Lab hub's ambient
            accent (see app/(app)/skill-lab/page.tsx). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-12 -z-10 h-72 bg-[radial-gradient(60%_100%_at_30%_0%,color-mix(in_srgb,var(--color-brand-lavender)_14%,transparent),transparent_70%)]"
        />
        <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-600 dark:text-brand-lavender">
          <CalendarClock className="size-3.5" />
          Build a Rep
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Get ready for the moment in front of you
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-ink-300">
          Describe the interview, presentation, pitch, or toast you&apos;re
          preparing for. Cognify builds your preparation plan. You practice.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-5 shadow-sm">
        <label
          htmlFor="prep-description"
          className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-ink-500"
        >
          What are you preparing for?
        </label>
        <textarea
          id="prep-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Final-round product manager interview at Stripe, panel of 4, next Friday"
          className="mt-2 w-full rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setDescription(ex)}
              className="min-h-[44px] rounded-full border border-slate-200 dark:border-ink-700 px-3 py-2 text-sm text-slate-500 dark:text-ink-400 hover:border-purple-300 hover:text-purple-600 dark:hover:text-brand-lavender"
            >
              {ex}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={creating || description.trim().length < 3}
          onClick={() => void create()}
          className="mt-4 min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-400 px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Building your preparation plan…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Build my prep
            </>
          )}
        </button>
        <p className="mt-2 text-[11px] text-slate-400 dark:text-ink-500">
          You can add context (resume, job description, deck outline) on the
          next screen (optional, but it makes the plan sharper).
        </p>
      </section>

      {initialEvents.length > 0 && (
        <section>
          {/* Edit #9 — clearer section header for the events list. */}
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Events you&apos;re preparing for
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {initialEvents.map((e) => (
              <Link
                key={e.id}
                href={`/build-a-rep/${e.id}`}
                className="group rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 shadow-sm transition hover:border-purple-300 dark:hover:border-brand-lavender/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {e.title}
                  </span>
                  {e.readinessScore != null && (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${readinessChipClass(e.readinessScore)}`}
                    >
                      <Target className="w-3 h-3" />
                      {Math.round(e.readinessScore)}
                    </span>
                  )}
                </div>
                {/* Edit #9 — never show "0 Critical Moments": a fresh or
                    still-generating plan reads as an invitation, not a
                    zero. */}
                <p className="mt-1 text-xs text-slate-500 dark:text-ink-400">
                  {e.momentCount > 0
                    ? `${e.momentCount} Critical Moment${e.momentCount === 1 ? "" : "s"} to practice`
                    : "Plan ready to build"}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-brand-lavender">
                  Continue preparing
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
