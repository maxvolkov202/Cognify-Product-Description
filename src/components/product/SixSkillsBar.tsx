"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
} from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * The six-skills bar (Direction.md CRITICAL UI element).
 *
 * Fixed to the bottom of the (app) layout. Always visible. Shows all
 * six trainable dimensions so the user never loses sight of what the
 * system is measuring — even when they're deep in a rep, their
 * feedback grounds in these six names.
 *
 * Three compacting levels:
 *   - Expanded (default): Full chip row, 6 dims with labels + scores
 *   - Collapsed: Just 6 colored dots with tooltips
 *   - Hidden: Deliberately off (e.g. marketing + auth screens)
 *
 * Active dims: the component pulls its data from the user's current
 * scores; for workout pages, a sibling component (WorkoutSession) can
 * layer emphasis via the `data-session-focus` attribute on the body
 * (follow-up — this MVP just shows current scores everywhere in (app)).
 *
 * The bar respects: (a) users who want to collapse it for rep focus
 * (localStorage persisted), (b) mobile viewport (horizontal scroll
 * with primary pinned left).
 */

type Props = {
  /** Current per-dimension scores (latest rep per dim). Null dimensions
   *  show as un-scored. */
  scores?: Partial<Record<SkillDimension, number | null>>;
};

const STORAGE_KEY = "cognify_six_skills_bar_collapsed_v1";

// Hide on these route prefixes. Everything else in (app) shows the bar.
const HIDDEN_ROUTES: readonly string[] = [
  "/onboarding",
  "/tutorial",
];

/**
 * Per-dimension color tokens. Chosen to be distinguishable on white,
 * accessible on white, and complementary to the brand purple gradient.
 * Stable across the codebase — dimension badges, trend chart legend,
 * and the six-skills bar all use these same tokens.
 */
const DIM_COLOR: Record<SkillDimension, { bg: string; text: string; dot: string }> = {
  clarity: {
    bg: "bg-sky-100",
    text: "text-sky-900",
    dot: "bg-sky-500",
  },
  structure: {
    bg: "bg-violet-100",
    text: "text-violet-900",
    dot: "bg-violet-500",
  },
  relevance: {
    bg: "bg-amber-100",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  confidence: {
    bg: "bg-emerald-100",
    text: "text-emerald-900",
    dot: "bg-emerald-500",
  },
  pacing: {
    bg: "bg-rose-100",
    text: "text-rose-900",
    dot: "bg-rose-500",
  },
  tone: {
    bg: "bg-orange-100",
    text: "text-orange-900",
    dot: "bg-orange-500",
  },
};

export function SixSkillsBar({ scores = {} }: Props) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      // noop
    }
  }, []);

  // Hidden on certain routes (onboarding / tutorial keep focus)
  const hidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
  if (hidden) return null;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // noop
    }
  }

  // Server-side render + first client render show expanded; flip to
  // user preference after hydration. This avoids layout shift when
  // the user's preference was collapsed.
  const effectiveCollapsed = hydrated && collapsed;

  return (
    <div
      aria-label="Six communication skills"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur-sm",
        "shadow-[0_-4px_20px_-8px_rgb(10_10_15_/_0.08)]",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 md:px-6">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!effectiveCollapsed}
          aria-label={effectiveCollapsed ? "Expand skills bar" : "Collapse skills bar"}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
        >
          {effectiveCollapsed ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>

        <p
          className={cn(
            "shrink-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-500",
            "hidden md:block",
          )}
        >
          Six skills
        </p>

        <div
          className={cn(
            "flex flex-1 items-center gap-2 overflow-x-auto",
            effectiveCollapsed ? "py-0" : "py-1.5",
          )}
        >
          {SKILL_DIMENSIONS.map((dim) => {
            const score = scores[dim];
            const hasScore = typeof score === "number";
            const colors = DIM_COLOR[dim];

            if (effectiveCollapsed) {
              return (
                <Link
                  key={dim}
                  href="/progress"
                  title={`${DIMENSION_LABELS[dim]}${
                    hasScore ? ` · ${score}` : " · no data yet"
                  }`}
                  aria-label={`${DIMENSION_LABELS[dim]} current score ${
                    hasScore ? score : "unavailable"
                  }`}
                  className="inline-flex shrink-0"
                >
                  <span
                    className={cn(
                      "size-3 rounded-full transition-transform hover:scale-125",
                      hasScore ? colors.dot : "bg-ink-300",
                    )}
                    aria-hidden="true"
                  />
                </Link>
              );
            }
            return (
              <Link
                key={dim}
                href="/progress"
                className={cn(
                  "group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold transition",
                  hasScore
                    ? "hover:border-ink-300 hover:shadow-sm"
                    : "text-ink-400",
                )}
                title={`${DIMENSION_LABELS[dim]}${
                  hasScore ? ` · ${score}/100` : " · no data yet"
                }${isContentDim(dim) ? " · Content" : " · Delivery"}`}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    hasScore ? colors.dot : "bg-ink-300",
                  )}
                  aria-hidden="true"
                />
                <span className={cn("text-ink-700")}>
                  {DIMENSION_LABELS[dim]}
                </span>
                {hasScore && (
                  <span
                    className={cn(
                      "rounded-md px-1 font-mono tabular-nums",
                      colors.bg,
                      colors.text,
                    )}
                  >
                    {score}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function isContentDim(dim: SkillDimension): boolean {
  return (SKILL_DIMENSION_GROUPS.content as readonly SkillDimension[]).includes(
    dim,
  );
}
