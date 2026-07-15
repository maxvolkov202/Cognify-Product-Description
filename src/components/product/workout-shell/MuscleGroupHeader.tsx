"use client";

// Header for the workout shell + Phase 9 day-start progression banner.
//
// Four banner variants:
//   firstEver       — "First {dim} day. Set the baseline."
//   previousExists  — "Last {dim} day ({days} days ago): composite N. Beat it."
//   previousStrong  — "Last {dim} day: composite N — strong. Don't slip."
//   previousWeak    — "Last {dim} day: composite N — let's climb."
//
// Variant selection: strong > 75, weak < 55, otherwise normal.

import { useEffect } from "react";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import { DIM_THEMES } from "@/lib/workout/dim-theme";
import { cn } from "@/lib/utils/cn";
import { dayComparisonTemplates } from "@/content/banners/day-comparison";
import { formatVoice } from "@/content/mascot/pick";

export type BannerLastDay = {
  lastComposite: number | null;
  daysSince: number;
};

export type MuscleGroupHeaderProps = {
  dim: MuscleGroupId | null;
  rationale: string | null;
  /** Phase 9 — full prior-day comparison. When provided, supersedes the
   *  legacy `previousDayComposite` prop and drives the banner variant. */
  lastDay?: BannerLastDay | null;
  /** Legacy prop from Phase 5; kept for backward compat. Used as a
   *  fallback when lastDay isn't passed. */
  previousDayComposite?: number | null;
  /** Phase 10 — streak count + freezes balance for the engagement pill. */
  streakDays?: number | null;
  streakFreezes?: number | null;
};

type BannerVariant =
  | { kind: "firstEver" }
  | { kind: "previousExists"; composite: number; days: number }
  | { kind: "previousStrong"; composite: number; days: number }
  | { kind: "previousWeak"; composite: number; days: number }
  | { kind: "none" };

function pickVariant(
  lastDay: BannerLastDay | null | undefined,
  fallbackComposite: number | null | undefined,
): BannerVariant {
  const composite = lastDay?.lastComposite ?? fallbackComposite ?? null;
  const daysSince = lastDay?.daysSince ?? 0;
  if (composite == null) {
    // No prior day at all — first-ever path.
    if (lastDay === null || (lastDay === undefined && fallbackComposite == null)) {
      return { kind: "firstEver" };
    }
    return { kind: "none" };
  }
  if (composite >= 75) {
    return { kind: "previousStrong", composite, days: daysSince };
  }
  if (composite < 55) {
    return { kind: "previousWeak", composite, days: daysSince };
  }
  return { kind: "previousExists", composite, days: daysSince };
}

function bannerCopy(
  variant: BannerVariant,
  dim: MuscleGroupId,
): string | null {
  const label = MUSCLE_GROUP_LABELS[dim];
  const slots: Record<string, string | number> =
    "composite" in variant
      ? {
          dim: label,
          days: variant.days,
          composite: Math.round(variant.composite),
        }
      : { dim: label };
  switch (variant.kind) {
    case "firstEver":
      return formatVoice(dayComparisonTemplates.firstEver, slots);
    case "previousExists":
      return formatVoice(dayComparisonTemplates.previousExists, slots);
    case "previousStrong":
      return formatVoice(dayComparisonTemplates.previousStrong, slots);
    case "previousWeak":
      return formatVoice(dayComparisonTemplates.previousWeak, slots);
    case "none":
      return null;
  }
}

export default function MuscleGroupHeader({
  dim,
  rationale,
  lastDay,
  previousDayComposite,
  streakDays,
  streakFreezes,
}: MuscleGroupHeaderProps) {
  const variant = dim ? pickVariant(lastDay, previousDayComposite) : { kind: "none" as const };
  const banner = dim ? bannerCopy(variant, dim) : null;

  // Telemetry — fire once per mount when a banner is shown.
  useEffect(() => {
    if (!dim || variant.kind === "none") return;
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "progression_banner_shown",
          dim,
          variant: variant.kind,
          daysSince: "days" in variant ? variant.days : null,
          lastComposite:
            "composite" in variant ? Math.round(variant.composite) : null,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim, variant.kind]);

  return (
    <header className="flex flex-col items-center gap-2 pt-6 pb-2 px-4 text-center">
      {dim && (
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium uppercase tracking-wide",
            DIM_THEMES[dim].chip,
          )}
        >
          <span aria-hidden>●</span>
          Today&apos;s muscle
        </div>
      )}
      <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100">
        {dim ? (
          <>
            Today:{" "}
            {/* Dim-gradient headline accent — the one gradient text on
                this screen (Cognify treatment). */}
            <span
              className={cn(
                "bg-gradient-to-r bg-clip-text text-transparent",
                DIM_THEMES[dim].tile,
              )}
            >
              {MUSCLE_GROUP_LABELS[dim]}
            </span>
          </>
        ) : (
          "Daily Workout"
        )}
      </h1>
      {rationale && (
        <p className="text-sm text-slate-400 max-w-md">{rationale}</p>
      )}
      {banner && <p className="text-xs text-slate-300">{banner}</p>}
      {(streakDays != null || streakFreezes != null) && (
        <div className="flex items-center gap-2 mt-1">
          {streakDays != null && streakDays > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-200 border border-orange-400/30 text-[11px] font-medium">
              <span aria-hidden>🔥</span>
              {streakDays}d streak
            </span>
          )}
          {streakFreezes != null && streakFreezes > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-200 border border-sky-400/30 text-[11px] font-medium">
              <span aria-hidden>❄</span>
              {streakFreezes} freeze{streakFreezes === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
