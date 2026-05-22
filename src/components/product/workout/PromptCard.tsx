"use client";

// One prompt option inside the picker. Renders the prompt text, a
// difficulty chip, and tag chips. Becomes the rep's prompt when the
// user picks it.

import { cn } from "@/lib/utils/cn";
import type { PromptCandidate } from "@/server/actions/prompt-selection";

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "intro", color: "bg-emerald-500/20 text-emerald-200" },
  2: { label: "core", color: "bg-sky-500/20 text-sky-200" },
  3: { label: "stretch", color: "bg-orange-500/20 text-orange-200" },
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
        "w-full text-left rounded-xl border transition-colors",
        "min-h-[44px]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        compact ? "p-3" : "p-4",
        selected
          ? "border-pink-400 bg-pink-500/10"
          : "border-slate-700 bg-slate-900/70 hover:bg-slate-800/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-slate-100 leading-snug",
            compact ? "text-sm" : "text-base",
          )}
        >
          {prompt.text}
        </p>
        <span
          className={cn(
            "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
            diff.color,
          )}
          aria-label={`Difficulty: ${diff.label}`}
        >
          {diff.label}
        </span>
      </div>
      {prompt.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
