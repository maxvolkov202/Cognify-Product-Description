import {
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Sparkles,
  Minus,
} from "lucide-react";
import type { NarrativeInsight } from "@/lib/insights/narrative";
import { cn } from "@/lib/utils/cn";

type Props = {
  insights: NarrativeInsight[];
};

const ICON_BY_KIND = {
  improvement: { Icon: ArrowUpRight, tint: "text-success" },
  regression: { Icon: ArrowDownRight, tint: "text-danger" },
  strength: { Icon: Sparkles, tint: "text-brand-purple" },
  opportunity: { Icon: Target, tint: "text-brand-purple" },
  steady: { Icon: Minus, tint: "text-ink-500" },
} as const;

/**
 * Narrative story card for the dashboard. Renders 3-4 sentences derived
 * from recent score data — no LLM, pure math. Meant to give the user a
 * quick "story" of where their training is right now.
 */
export function ThisWeekCard({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          This week
        </p>
      </div>
      <ul className="divide-y divide-ink-100">
        {insights.map((ins, i) => {
          const { Icon, tint } = ICON_BY_KIND[ins.kind];
          return (
            <li
              key={i}
              className="flex items-start gap-3 px-5 py-3"
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full bg-white ring-1 ring-ink-100",
                  tint,
                )}
              >
                <Icon className="size-4" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-ink-800">
                {ins.text}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
