"use client";

// Phase 9 — end-of-day retrospective panel.
//
// Mounted by RepControls in the `day-complete` phase. Shows: composite
// hero, per-dim delta grid, highlights ("best dim today", "biggest
// jump", "watch:"), mascot reaction frame, CTA → /progress/muscle-groups.
//
// On mobile: full-screen panel. On ≥768px: card modal.

import Link from "next/link";
import { useEffect } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import type { MuscleGroupComparison } from "@/lib/db/queries/muscle-group-progress";

export type DayRetrospectiveProps = {
  dim: MuscleGroupId;
  comparison: MuscleGroupComparison;
};

const DIM_COLORS: Record<MuscleGroupId, string> = {
  clarity: "text-[#6aa3ff]",
  structure: "text-[#b39bff]",
  conciseness: "text-[#e77cf0]",
  thinking_quality: "text-[#b072ff]",
  pacing: "text-[#7fd6c8]",
  tone: "text-[#ffb38a]",
};

export default function DayRetrospective({
  dim,
  comparison,
}: DayRetrospectiveProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "retrospective_opened",
          dim,
          todayComposite: comparison.todayComposite,
          deltaVsLast: comparison.deltaComposite,
        }),
      );
    }
  }, [dim, comparison.todayComposite, comparison.deltaComposite]);

  const composite = comparison.todayComposite;
  const delta = comparison.deltaComposite;
  const isImprovement = delta != null && delta > 0;
  const isRegression = delta != null && delta < 0;

  const highlights = buildHighlights(comparison);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        className={cn(
          "text-xs uppercase tracking-wide",
          DIM_COLORS[dim],
        )}
      >
        {MUSCLE_GROUP_LABELS[dim]} day complete
      </div>

      {/* Composite hero */}
      <div className="flex flex-col items-center">
        <div className="text-5xl font-bold text-slate-100 leading-none">
          {composite != null ? Math.round(composite) : "—"}
        </div>
        <div className="text-xs text-slate-500 mt-1">composite</div>
        {delta != null && (
          <div
            className={cn(
              "mt-3 flex items-center gap-1.5 text-sm font-medium",
              isImprovement && "text-emerald-300",
              isRegression && "text-rose-300",
              !isImprovement && !isRegression && "text-slate-300",
            )}
          >
            {isImprovement && <ArrowUpRight className="w-4 h-4" aria-hidden />}
            {isRegression && <ArrowDownRight className="w-4 h-4" aria-hidden />}
            {!isImprovement && !isRegression && (
              <ArrowRight className="w-4 h-4" aria-hidden />
            )}
            {delta > 0 ? "+" : ""}
            {Math.round(delta)} vs last {MUSCLE_GROUP_LABELS[dim]} day
            {comparison.daysSince != null
              ? ` (${comparison.daysSince}d ago)`
              : ""}
          </div>
        )}
        {delta == null && comparison.lastComposite == null && (
          <div className="mt-3 text-sm text-slate-400">
            First {MUSCLE_GROUP_LABELS[dim]} day — baseline set.
          </div>
        )}
      </div>

      {/* Per-dim delta grid */}
      {Object.keys(comparison.todayPerDim).length > 0 && (
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(comparison.todayPerDim).map(([d, score]) => {
            const ddelta = comparison.deltaPerDim[d];
            return (
              <div
                key={d}
                className="rounded-lg bg-slate-800/50 border border-slate-700 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {d.replace(/_/g, " ")}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-semibold text-slate-100">
                    {Math.round(score ?? 0)}
                  </span>
                  {ddelta != null && (
                    <span
                      className={cn(
                        "text-[11px]",
                        ddelta > 0 && "text-emerald-300",
                        ddelta < 0 && "text-rose-300",
                        ddelta === 0 && "text-slate-500",
                      )}
                    >
                      {ddelta > 0 ? "+" : ""}
                      {Math.round(ddelta)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <ul className="w-full flex flex-col gap-1.5 text-sm text-slate-300">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <Sparkles
                className="w-3.5 h-3.5 text-pink-300 mt-1 shrink-0"
                aria-hidden
              />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* CTA */}
      <Link
        href={`/progress/muscle-groups?dim=${dim}`}
        className={cn(
          "min-h-[44px] px-5 py-2 rounded-xl text-sm font-medium",
          "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400",
        )}
      >
        See {MUSCLE_GROUP_LABELS[dim]} timeline →
      </Link>
    </div>
  );
}

function buildHighlights(comparison: MuscleGroupComparison): string[] {
  const lines: string[] = [];
  const today = comparison.todayPerDim;
  const delta = comparison.deltaPerDim;
  const dims = Object.keys(today);
  if (dims.length === 0) return [];

  // Best dim today
  const best = dims.reduce<{ dim: string; score: number } | null>(
    (acc, d) => {
      const s = today[d] ?? 0;
      return !acc || s > acc.score ? { dim: d, score: s } : acc;
    },
    null,
  );
  if (best) {
    lines.push(
      `Best dim today: ${humanize(best.dim)} at ${Math.round(best.score)}.`,
    );
  }

  // Biggest jump
  const jumps = dims
    .map((d) => ({ dim: d, delta: delta[d] ?? 0 }))
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  if (jumps.length && jumps[0]!.delta >= 3) {
    lines.push(
      `Biggest jump: +${Math.round(jumps[0]!.delta)} in ${humanize(jumps[0]!.dim)}.`,
    );
  }

  // Watch (regression)
  const watches = dims
    .map((d) => ({ dim: d, delta: delta[d] ?? 0 }))
    .filter((x) => x.delta <= -3)
    .sort((a, b) => a.delta - b.delta);
  if (watches.length) {
    lines.push(
      `Watch: ${humanize(watches[0]!.dim)} dropped ${Math.round(Math.abs(watches[0]!.delta))}.`,
    );
  }

  return lines;
}

function humanize(dim: string): string {
  return dim
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
