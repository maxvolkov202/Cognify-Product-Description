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
        "group w-full text-left rounded-xl border bg-white transition-all",
        "min-h-[56px] shadow-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50",
        compact ? "p-3" : "p-4",
        selected
          ? "border-purple-400 ring-2 ring-purple-200 bg-purple-50/50"
          : "border-slate-200 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <p
        className={cn(
          "text-slate-900 leading-snug font-medium",
          compact ? "text-sm" : "text-[15px] sm:text-base",
        )}
      >
        {prompt.text}
      </p>
    </button>
  );
}
