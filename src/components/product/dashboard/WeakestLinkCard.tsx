import Link from "next/link";
import { ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import type { SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
import { DIMENSION_ACCENTS } from "@/lib/skill-lab/mode-theme";
import { DRILLABLE_DIMENSIONS } from "@/lib/ai/prompts/drills";
import { cn } from "@/lib/utils/cn";

type Props = {
  weakest: {
    dimension: SkillDimension;
    averageScore: number;
    sampleSize: number;
  } | null;
  /** Total reps the user has completed; drives the "training in progress"
   *  empty state copy when sample size is too small for the weakest-link
   *  signal to be reliable. */
  totalReps: number;
  className?: string;
};

/**
 * DNA Ch.8 — diagnostic AND prescriptive. Surfaces the user's weakest
 * dimension based on their last 30 reps and routes them straight into
 * a focus drill on it. When sample size is too small (<10 reps in the
 * dimension) renders a calm empty state instead of pretending to know.
 *
 * The CTA only fires for dimensions that have a dedicated drill bank
 * (Ch.6b: thinking_quality / delivery / tone). For
 * clarity / structure / conciseness, surfaces the weakness as
 * information without a drill CTA — those dimensions drill via the
 * existing rep-type routing in the workout flow.
 */
export function WeakestLinkCard({ weakest, totalReps, className }: Props) {
  if (!weakest) {
    return (
      <section
        className={cn(
          "surface-card flex items-start gap-3 p-5 text-sm",
          className,
        )}
      >
        <AlertCircle
          className="size-5 shrink-0 text-ink-400"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <div>
          <p className="text-[13px] font-bold text-ink-800">
            Training in progress
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
            {totalReps === 0
              ? "Run your first rep to start building a per-dimension picture."
              : `Need at least 10 reps in a dimension before we can call out a weakness. You have ${totalReps} total so far — keep going.`}
          </p>
        </div>
      </section>
    );
  }

  const { dimension, averageScore } = weakest;
  const accent = DIMENSION_ACCENTS[dimension];
  const drillable = (DRILLABLE_DIMENSIONS as readonly SkillDimension[]).includes(
    dimension,
  );

  return (
    <section
      className={cn("surface-card overflow-hidden", className)}
      style={{
        borderColor: accent + "40",
      }}
    >
      <div className="flex items-start gap-4 p-5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl text-white"
          style={{ backgroundColor: accent }}
        >
          <Sparkles className="size-4" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
            Weakest link · last 30 reps
          </p>
          <p className="mt-1 text-[15px] font-extrabold text-ink-900">
            {DIMENSION_LABELS[dimension]} —{" "}
            <span className="tabular-nums text-ink-700">
              {averageScore.toFixed(0)}/100 avg
            </span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
            {drillable
              ? `Drill ${DIMENSION_LABELS[dimension]} directly — fastest way to move the line.`
              : `Workouts will bias toward ${DIMENSION_LABELS[dimension]} until the average lifts.`}
          </p>
        </div>
        {drillable && (
          <Link
            href={`/skill-lab?focus=${dimension}`}
            className="inline-flex shrink-0 items-center gap-1 self-center rounded-full px-3 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Drill now
            <ArrowRight className="size-3" strokeWidth={2.5} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
