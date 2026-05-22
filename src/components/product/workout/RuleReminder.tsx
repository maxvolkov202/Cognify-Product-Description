"use client";

// Light-theme eyebrow above the prompt cards reminding the user of the
// exercise's rule. Compact + Cognify-esc.

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
        "w-full rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/70 to-white",
        "px-4 py-3.5 flex items-start gap-3",
      )}
      role="region"
      aria-label={`Rule for ${exerciseName}`}
    >
      <Sparkles
        className="w-4 h-4 text-purple-500 mt-1 shrink-0"
        aria-hidden
        strokeWidth={2.5}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600 mb-0.5">
          {exerciseName}
        </div>
        <div className="text-sm sm:text-base text-slate-900 leading-snug font-semibold">
          {rule}
        </div>
        {why && (
          <div className="text-[11px] text-slate-500 mt-1 leading-tight">
            {why}
          </div>
        )}
      </div>
    </div>
  );
}
