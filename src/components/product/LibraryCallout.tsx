"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Trophy } from "lucide-react";

/**
 * Library callout for the dashboard. Light-mode card — brand-gradient mark
 * stays the dominant accent against a white surface so it sits alongside
 * the other dashboard cards instead of standing out as a dark island.
 *
 * The dark gradient version of this component is the canonical reference
 * for Cognify dark mode — see docs/dark-palette.md. When the dark theme
 * lands, this surface flips back to that aesthetic via `.dark` overrides.
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
        className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-brand-lavender/5 to-brand-magenta/5 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-purple/30 hover:shadow-[0_18px_50px_-22px_rgba(176,114,255,0.45)] md:p-6 dark:border-ink-700 dark:from-ink-900 dark:via-brand-lavender/10 dark:to-brand-magenta/10"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-purple/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-8 size-44 rounded-full bg-brand-magenta/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-1 items-center gap-4">
          <div className="brand-gradient grid size-11 shrink-0 place-items-center rounded-2xl shadow-[0_8px_24px_-8px_rgba(176,114,255,0.55)]">
            <BookOpen className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
              Cognify Library
            </p>
            <p className="mt-0.5 text-sm font-bold text-ink-900 md:text-base dark:text-white">
              Watch what good looks like.
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-600 dark:text-ink-300">
              Curated talks, stories, and guides. Build the taste, then run a rep.
            </p>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-purple/30 bg-brand-purple/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-purple dark:bg-brand-purple/15 dark:text-brand-lavender">
              <Trophy className="size-3" strokeWidth={2.5} />
              Curated
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-purple dark:text-brand-lavender">
              Open
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.5}
              />
            </span>
          </div>
          <ArrowRight
            className="size-4 shrink-0 text-brand-purple transition-transform group-hover:translate-x-0.5 md:hidden dark:text-brand-lavender"
            strokeWidth={2.5}
          />
        </div>
      </Link>
    </motion.div>
  );
}
