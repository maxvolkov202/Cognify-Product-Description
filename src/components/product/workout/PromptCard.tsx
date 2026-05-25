"use client";

// One prompt option inside the picker. Light theme, Cognify-esc.
// Removed vertical tag chips + difficulty chips per Max's 2026-05-22
// feedback — they added visual noise. The `difficulty` field stays on
// the data model for prompt-selection bias (preferEasier when recent
// dim composite is low) but is no longer rendered.

import { cn } from "@/lib/utils/cn";
import type { PromptCandidate } from "@/server/actions/prompt-selection";

export type PromptCardProps = {
  prompt: PromptCandidate;
  selected?: boolean;
  onPick: (promptId: string) => void;
  /** When set, makes the card more compact for the All-prompts list. */
  compact?: boolean;
};

export default function PromptCard({
  prompt,
  selected,
  onPick,
  compact,
}: PromptCardProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(prompt.id)}
      aria-pressed={selected}
      className={cn(
        "group w-full text-left rounded-xl border bg-white dark:bg-ink-900 transition-all",
        "min-h-[56px] shadow-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50 dark:focus-visible:ring-offset-ink-900",
        compact ? "p-3" : "p-4",
        selected
          ? "border-purple-400 dark:border-brand-purple ring-2 ring-purple-200 dark:ring-brand-purple/40 bg-purple-50/50 dark:bg-purple-500/15"
          : "border-slate-200 dark:border-ink-700 hover:border-purple-300 dark:hover:border-brand-purple/60 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <p
        className={cn(
          "text-slate-900 dark:text-white leading-snug font-medium",
          compact ? "text-sm" : "text-[15px] sm:text-base",
        )}
      >
        {prompt.text}
      </p>
    </button>
  );
}
