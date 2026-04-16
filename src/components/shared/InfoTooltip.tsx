"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";

type Props = {
  content: string;
  /** Optional custom aria-label. Defaults to the content string. */
  label?: string;
};

/**
 * Small `ⓘ` affordance that opens a Radix tooltip with a short definition.
 * Used for surface-level jargon explainers (composite score, rubric version,
 * skill dimensions, etc.) without cluttering labels with parentheses.
 *
 * Hover/focus on desktop; tap-and-hold on touch devices.
 */
export function InfoTooltip({ content, label }: Props) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={label ?? content}
            className="inline-flex size-3.5 items-center justify-center rounded-full text-ink-400 transition-colors hover:text-brand-purple focus:text-brand-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-1"
          >
            <Info className="size-3.5" strokeWidth={2} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs leading-relaxed text-ink-700 shadow-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
          >
            {content}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
