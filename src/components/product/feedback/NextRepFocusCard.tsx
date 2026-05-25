"use client";

import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { NextRepFocusItem } from "@/types/domain";

type Props = {
  /** Phase 2 rich items — preferred. Each may include an exampleLine
   *  (speakable model line) and grounding (quote/timestamps) that the
   *  card surfaces underneath the prescriptive bullet text. */
  items?: NextRepFocusItem[];
  /** Phase 1 fallback — derived client-side from callouts. */
  fallbackBullets?: string[];
  /** Phase 3 enables this. Phase 1 leaves the link visible-but-disabled
   *  with a "Coming soon" tooltip so the layout reads complete. */
  onSeeExample?: () => void;
};

export function NextRepFocusCard({
  items,
  fallbackBullets,
  onSeeExample,
}: Props) {
  const usingRich = items !== undefined;
  const richList = items ?? [];
  const fallbackList = fallbackBullets ?? [];
  if (usingRich && richList.length === 0) return null;
  if (!usingRich && fallbackList.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-[1.5px]"
      style={{
        backgroundImage:
          "linear-gradient(110deg, var(--color-brand-blue), var(--color-brand-lavender), var(--color-brand-purple), var(--color-brand-magenta))",
      }}
    >
      <div className="rounded-[14px] bg-white dark:bg-ink-900 p-5">
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 18,
              delay: 0.1,
            }}
            className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl shadow-[var(--shadow-glow)]"
          >
            <Sparkles
              className="size-4 text-white"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </motion.span>
          <h3 className="flex-1 text-[15px] font-extrabold text-ink-900 dark:text-white">
            Next Rep Focus
          </h3>
          {onSeeExample ? (
            <button
              type="button"
              onClick={onSeeExample}
              className="text-xs font-semibold text-brand-purple dark:text-brand-lavender transition-colors hover:opacity-80"
            >
              See example
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Coming soon — exemplar responses ship in v1.1"
              className="cursor-not-allowed text-xs font-semibold text-ink-300 dark:text-ink-600"
            >
              See example
            </button>
          )}
        </div>
        <ul className="mt-3 space-y-3">
          {usingRich
            ? richList.map((item, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className="brand-gradient mt-1.5 size-1.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-relaxed text-ink-800 dark:text-ink-100">
                      {item.text}
                    </p>
                    {item.exampleLine && (
                      <p className="mt-1.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1.5 text-[12px] italic leading-relaxed text-ink-700 dark:text-ink-200">
                        Try: &ldquo;{item.exampleLine}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              ))
            : fallbackList.map((b, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[13px] leading-relaxed text-ink-800 dark:text-ink-100"
                >
                  <span
                    className="brand-gradient mt-1.5 size-1.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <span>{b}</span>
                </li>
              ))}
        </ul>
      </div>
    </div>
  );
}
