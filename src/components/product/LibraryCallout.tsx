"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Trophy } from "lucide-react";

/**
 * Library callout for the dashboard. Distinct from the three training
 * mode cards above it — this is content (taste-building), not a rep
 * mode, so it lives in its own slimmer surface and reads as a paired
 * resource rather than a fourth peer of Daily Workout / Skill Lab /
 * Build a Rep. Brand-gradient mark stays dominant so the row still
 * feels Cognify; the slate background gives Library its own ink-heavy
 * identity (scholarship, not training).
 */
export function LibraryCallout() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Link
        href="/library"
        className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 p-5 text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-22px_rgba(20,20,40,0.6)] md:p-6"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-blue/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-8 size-44 rounded-full bg-brand-magenta/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-1 items-center gap-4">
          <div className="brand-gradient grid size-11 shrink-0 place-items-center rounded-2xl shadow-[0_8px_24px_-8px_rgba(176,114,255,0.6)]">
            <BookOpen className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-lavender">
              Cognify Library
            </p>
            <p className="mt-0.5 text-sm font-bold text-white md:text-base">
              Watch what good looks like.
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-white/70">
              Curated talks, stories, and guides. Build the taste, then run a rep.
            </p>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
              <Trophy className="size-3" strokeWidth={2.5} />
              Curated
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-white">
              Open
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.5}
              />
            </span>
          </div>
          <ArrowRight
            className="size-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 md:hidden"
            strokeWidth={2.5}
          />
        </div>
      </Link>
    </motion.div>
  );
}
