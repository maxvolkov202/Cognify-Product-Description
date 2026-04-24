"use client";

import { useState } from "react";
import { Flame, ChevronDown } from "lucide-react";
import type { PressureArchetype } from "@/lib/ai/pressure-archetypes";
import { cn } from "@/lib/utils/cn";

type Props = {
  archetype: PressureArchetype;
  className?: string;
};

/**
 * Pre-start indicator for pressure reps.
 *
 * Rendered above the prompt list on the Daily Workout prompt-select
 * screen when the current rep is a pressure rep (`WorkoutRepSlot.pressureArchetype`
 * is set). The intent is calm + informative — the pressure comes from
 * the prompt content, not from the UI.
 *
 * Uses the archetype's accentColor token (amber / orange / rose) for a
 * warm tint that reads as "heads up" without clashing with the brand
 * purple gradient elsewhere on the page.
 *
 * Accessibility:
 *   - Outer region is `role="status"` + `aria-live="polite"` so screen
 *     readers announce the pressure mechanism when it mounts.
 *   - The "What to expect" expander is a native `<button>` with
 *     `aria-expanded` so keyboard + screen-reader users can toggle.
 */
export function PressureRepIndicator({ archetype, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  const accent = ACCENT_STYLES[archetype.accentColor];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "overflow-hidden rounded-2xl border",
        accent.border,
        accent.bg,
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            accent.iconBg,
          )}
          aria-hidden="true"
        >
          <Flame className={cn("size-4", accent.iconColor)} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-extrabold uppercase tracking-[0.18em]",
              accent.headingColor,
            )}
          >
            Pressure rep · {archetype.name}
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold leading-snug",
              accent.textColor,
            )}
          >
            {archetype.tagline}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={`pressure-expander-${archetype.id}`}
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold",
              accent.linkColor,
              "hover:underline underline-offset-2",
            )}
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden="true"
            />
            {expanded ? "Hide" : "What to expect"}
          </button>
        </div>
      </div>
      {expanded && (
        <div
          id={`pressure-expander-${archetype.id}`}
          className={cn(
            "border-t px-4 py-3 text-xs leading-relaxed",
            accent.border,
            accent.expandedBg,
            accent.textColor,
          )}
        >
          {archetype.whatToExpect}
        </div>
      )}
    </div>
  );
}

/**
 * Accent color tokens. Three warm palettes keyed by archetype.accentColor.
 * Tailwind classes are enumerated (not interpolated) so the JIT compiler
 * doesn't tree-shake them away.
 */
const ACCENT_STYLES = {
  amber: {
    border: "border-amber-300",
    bg: "bg-gradient-to-br from-amber-50 via-amber-50/70 to-amber-100/40",
    expandedBg: "bg-amber-50/60",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    headingColor: "text-amber-800",
    textColor: "text-amber-950",
    linkColor: "text-amber-700",
  },
  orange: {
    border: "border-orange-300",
    bg: "bg-gradient-to-br from-orange-50 via-orange-50/70 to-orange-100/40",
    expandedBg: "bg-orange-50/60",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
    headingColor: "text-orange-800",
    textColor: "text-orange-950",
    linkColor: "text-orange-700",
  },
  rose: {
    border: "border-rose-300",
    bg: "bg-gradient-to-br from-rose-50 via-rose-50/70 to-rose-100/40",
    expandedBg: "bg-rose-50/60",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    headingColor: "text-rose-800",
    textColor: "text-rose-950",
    linkColor: "text-rose-700",
  },
} as const;
