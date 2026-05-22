"use client";

// Header for the workout shell. Shows the current muscle group +
// rationale + Phase 9's "last time you trained ___" banner.

import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const DIM_BADGE_BG: Record<MuscleGroupId, string> = {
  clarity: "bg-[#6aa3ff]/15 text-[#a5c8ff] border-[#6aa3ff]/40",
  structure: "bg-[#b39bff]/15 text-[#d5c4ff] border-[#b39bff]/40",
  conciseness: "bg-[#e77cf0]/15 text-[#f3b9f6] border-[#e77cf0]/40",
  thinking_quality: "bg-[#b072ff]/15 text-[#d5b1ff] border-[#b072ff]/40",
  pacing: "bg-[#7fd6c8]/15 text-[#a8e8de] border-[#7fd6c8]/40",
  tone: "bg-[#ffb38a]/15 text-[#ffd1b8] border-[#ffb38a]/40",
};

export type MuscleGroupHeaderProps = {
  dim: MuscleGroupId | null;
  rationale: string | null;
  previousDayComposite: number | null;
};

export default function MuscleGroupHeader({
  dim,
  rationale,
  previousDayComposite,
}: MuscleGroupHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-2 pt-6 pb-2 px-4 text-center">
      {dim && (
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium uppercase tracking-wide",
            DIM_BADGE_BG[dim],
          )}
        >
          <span aria-hidden>●</span>
          Today&apos;s muscle
        </div>
      )}
      <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100">
        {dim ? `Today: ${MUSCLE_GROUP_LABELS[dim]}` : "Daily Workout"}
      </h1>
      {rationale && (
        <p className="text-sm text-slate-400 max-w-md">{rationale}</p>
      )}
      {previousDayComposite != null && dim && (
        <p className="text-xs text-slate-500">
          Last {MUSCLE_GROUP_LABELS[dim]} day: composite{" "}
          <span className="text-slate-300 font-semibold">
            {Math.round(previousDayComposite)}
          </span>{" "}
          — beat it.
        </p>
      )}
    </header>
  );
}
