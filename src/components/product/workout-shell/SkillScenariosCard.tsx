"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  SKILL_SCENARIOS,
  scenariosSeenKey,
  type SkillScenario,
} from "@/content/skill-scenarios";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Phase E (#12) — Why-this-skill-matters card.
 *
 * Shown on the workout start screen as a collapsed link the user can
 * tap to expand. First-time visitors see "Why {dim} matters — quick
 * read" as a soft nudge; once they've opened-and-dismissed (or hit X /
 * "Got it"), the label switches to "Why train {dim}?" so it doesn't
 * keep asking the same question.
 *
 * Tracked via localStorage (cognify.scenarios-seen.<dim>) for the
 * label switch only — the card never auto-expands.
 *
 * No-op when the dim has no scenarios authored.
 */

type Props = {
  dim: MuscleGroupId;
};

export default function SkillScenariosCard({ dim }: Props) {
  const scenarios = SKILL_SCENARIOS[dim] ?? [];
  const dimLabel = MUSCLE_GROUP_LABELS[dim];
  // Always start collapsed — the card is opt-in regardless of whether
  // the user has seen it before. localStorage only controls the label
  // copy (first-time nudge vs. familiar phrasing).
  const [open, setOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(scenariosSeenKey(dim));
      setHasSeen(seen != null);
    } catch {
      /* storage disabled — assume seen */
    }
  }, [dim]);

  function markSeen() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(scenariosSeenKey(dim), "1");
    } catch {
      /* ignore */
    }
    setHasSeen(true);
  }

  function dismiss() {
    markSeen();
    setOpen(false);
  }

  function toggle() {
    if (open) {
      dismiss();
    } else {
      setOpen(true);
    }
  }

  if (scenarios.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-full min-h-[44px] items-center gap-2 rounded-2xl border px-4 py-2.5 text-left transition-colors",
          open
            ? "border-brand-purple/40 bg-brand-purple/5 dark:border-brand-purple/50 dark:bg-brand-purple/15"
            : "border-ink-200 bg-white hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600",
        )}
        aria-expanded={open}
      >
        <Sparkles
          className="size-4 text-brand-purple dark:text-brand-lavender"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm font-semibold text-ink-800 dark:text-ink-100">
          {hasSeen
            ? `Why train ${dimLabel}?`
            : `Why ${dimLabel} matters — quick read`}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-ink-500" strokeWidth={2.5} />
        ) : (
          <ChevronDown className="size-4 text-ink-500" strokeWidth={2.5} />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="scenarios-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
              <div className="flex items-start gap-3">
                <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl">
                  <Sparkles
                    className="size-4 text-white"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
                    Real moments {dimLabel.toLowerCase()} shows up
                  </p>
                  <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                    These are the situations you&rsquo;re training for. Scroll a
                    few, then start your reps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="shrink-0 rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                  aria-label="Got it — dismiss"
                  title="Got it — dismiss"
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>

              <ol className="mt-4 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {scenarios.map((s, i) => (
                  <ScenarioRow key={i} index={i + 1} scenario={s} />
                ))}
              </ol>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-full bg-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScenarioRow({
  index,
  scenario,
}: {
  index: number;
  scenario: SkillScenario;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3 dark:border-ink-800 dark:bg-ink-800/40">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-purple/10 text-[10px] font-bold tabular-nums text-brand-purple dark:bg-brand-purple/20 dark:text-brand-lavender">
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink-900 dark:text-white">
          {scenario.title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-ink-600 dark:text-ink-300">
          {scenario.body}
        </p>
      </div>
    </li>
  );
}
