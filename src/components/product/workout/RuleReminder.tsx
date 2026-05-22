"use client";

// Pinned banner above the PromptPicker tabs reminding the user of the
// exercise's rule. Sourced from exercises.description (treated as the
// user-facing "rule" per the catalog seed mapping — see
// scripts/exercise-catalog/README.md).

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type RuleReminderProps = {
  exerciseName: string;
  rule: string;
  why?: string | null;
};

export default function RuleReminder({
  exerciseName,
  rule,
  why,
}: RuleReminderProps) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-slate-700 bg-slate-900/60",
        "px-4 py-3 flex items-start gap-3",
      )}
      role="region"
      aria-label={`Rule for ${exerciseName}`}
    >
      <Sparkles className="w-4 h-4 text-pink-300 mt-1 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">
          {exerciseName}
        </div>
        <div className="text-sm text-slate-100 leading-snug">{rule}</div>
        {why && (
          <div className="text-[11px] text-slate-500 mt-1 leading-tight">
            {why}
          </div>
        )}
      </div>
    </div>
  );
}
