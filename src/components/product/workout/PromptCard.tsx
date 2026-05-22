"use client";

// One prompt option inside the picker. Light theme, Cognify-esc.
// Removed vertical tag chips per Max's 2026-05-22 direction — they
// added visual noise without surfacing useful information at the
// picker stage.

import { cn } from "@/lib/utils/cn";
import type { PromptCandidate } from "@/server/actions/prompt-selection";

const DIFFICULTY_LABELS: Record<
  number,
  { label: string; className: string }
> = {
  1: {
    label: "Intro",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  2: {
    label: "Core",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  3: {
    label: "Stretch",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

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
  const diff = DIFFICULTY_LABELS[prompt.difficulty] ?? DIFFICULTY_LABELS[2]!;

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
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-slate-900 leading-snug font-medium",
            compact ? "text-sm" : "text-[15px] sm:text-base",
          )}
        >
          {prompt.text}
        </p>
        <span
          className={cn(
            "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
            diff.className,
          )}
          aria-label={`Difficulty: ${diff.label}`}
        >
          {diff.label}
        </span>
      </div>
    </button>
  );
}
