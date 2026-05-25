import Link from "next/link";
import { ChevronDown, TrendingDown, TrendingUp, Minus, Sparkles, ArrowRight } from "lucide-react";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  type SkillDimension,
} from "@/types/domain";
import {
  SUB_SKILL_LABELS,
  type SubSkillId,
} from "@/types/sub-skills";
import { DIMENSION_ACCENTS } from "@/lib/skill-lab/mode-theme";
import { DRILLABLE_DIMENSIONS } from "@/lib/ai/prompts/drills";
import type { SubSkillBreakdown } from "@/lib/db/queries/sub-skills";
import { cn } from "@/lib/utils/cn";

type Props = {
  breakdown: SubSkillBreakdown;
  /** Shown above the list — total sub-skill observations across all
   *  dims. Drives the empty / unlock-state copy. */
  totalSampleSize: number;
  className?: string;
};

const MIN_SAMPLES_PER_SUB_SKILL = 5;

/**
 * Ch.12 — per-sub-skill diagnostic surface. Default-collapsed accordion
 * per dimension. Expanding shows that dim's sub-skills as horizontal
 * bars with the running-average score, trend arrow, and a "drill this
 * sub-skill" CTA on drillable dimensions.
 *
 * Empty state copy: "Sub-skill detail unlocks after ~5 reps in a
 * dimension." Per-sub-skill rows with sample size below the floor
 * render a softer "needs N more reps" line in place of a score.
 *
 * Renders nothing entirely when totalSampleSize is 0 — the dashboard
 * shows the original WeakestLinkCard in that case (no FF gate needed
 * inside the component; the caller decides whether to mount it).
 */
export function SubSkillBreakdownCard({
  breakdown,
  totalSampleSize,
  className,
}: Props) {
  if (totalSampleSize === 0) {
    return (
      <section
        className={cn(
          "surface-card p-5 text-sm",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <Sparkles
            className="size-5 shrink-0 text-ink-400 dark:text-ink-500"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <div>
            <p className="text-[13px] font-bold text-ink-800 dark:text-ink-100">
              Sub-skill detail
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
              Unlocks after ~5 reps in a dimension. Each rep contributes
              to per-sub-skill averages — Word Choice, Signposting, Claim
              Support, and 12 more.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "surface-card overflow-hidden",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500">
          Sub-skill breakdown · last 30 reps
        </p>
        <p className="text-[10px] font-medium text-ink-400 dark:text-ink-500">
          Tap a dimension to expand
        </p>
      </div>
      <div className="mt-3 divide-y divide-ink-100 dark:divide-ink-700">
        {SKILL_DIMENSIONS.map((dim) => (
          <DimensionRow
            key={dim}
            dimension={dim}
            bucket={breakdown[dim] ?? null}
          />
        ))}
      </div>
    </section>
  );
}

function DimensionRow({
  dimension,
  bucket,
}: {
  dimension: SkillDimension;
  bucket: SubSkillBreakdown[SkillDimension] | null;
}) {
  const accent = DIMENSION_ACCENTS[dimension];
  const drillable = (DRILLABLE_DIMENSIONS as readonly SkillDimension[]).includes(
    dimension,
  );
  const totalSamples = bucket?.sampleSize ?? 0;
  const weakest = bucket?.weakest ?? null;
  const subSkills = bucket?.subSkills ?? [];

  return (
    <details className="group px-5 py-3.5">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <span className="flex-1 text-[13px] font-bold text-ink-900 dark:text-white">
          {DIMENSION_LABELS[dimension]}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-ink-400 dark:text-ink-500">
          {totalSamples > 0 ? `${totalSamples} obs` : "no data yet"}
        </span>
        {weakest && (
          <span
            className="hidden text-[11px] font-bold sm:inline"
            style={{ color: accent }}
          >
            weakest: {SUB_SKILL_LABELS[weakest.id]}
          </span>
        )}
        <ChevronDown
          className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180 dark:text-ink-500"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </summary>
      <div className="mt-3 space-y-2.5 pl-5">
        {subSkills.length === 0 ? (
          <p className="text-[12px] text-ink-500 dark:text-ink-400">
            No sub-skill data for {DIMENSION_LABELS[dimension]} yet —
            run a few more reps to unlock the breakdown.
          </p>
        ) : (
          <>
            {subSkills.map(({ id, stat }) => (
              <SubSkillRow
                key={id}
                subSkill={id}
                stat={stat}
                accent={accent}
                drillable={drillable}
                dimension={dimension}
              />
            ))}
            {drillable && weakest && (
              <Link
                href={`/skill-lab?focus=${dimension}&subSkill=${weakest.id}`}
                className="mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Drill {SUB_SKILL_LABELS[weakest.id]}
                <ArrowRight className="size-3" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function SubSkillRow({
  subSkill,
  stat,
  accent,
  drillable,
  dimension,
}: {
  subSkill: SubSkillId;
  stat: { avg: number; sampleSize: number; trend: number | null };
  accent: string;
  drillable: boolean;
  dimension: SkillDimension;
}) {
  const ready = stat.sampleSize >= MIN_SAMPLES_PER_SUB_SKILL;
  const fillPct = Math.max(2, Math.min(100, Math.round(stat.avg)));
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[12px] font-semibold text-ink-700 dark:text-ink-200">
          {SUB_SKILL_LABELS[subSkill]}
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          {ready ? (
            <span
              className="block h-full rounded-full transition-[width]"
              style={{ width: `${fillPct}%`, backgroundColor: accent }}
            />
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
        {ready ? (
          <span className="text-[13px] font-extrabold text-ink-800 dark:text-ink-100">
            {Math.round(stat.avg)}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-ink-400 dark:text-ink-500">
            {MIN_SAMPLES_PER_SUB_SKILL - stat.sampleSize} more reps
          </span>
        )}
        <TrendIcon trend={stat.trend} />
        {drillable && ready && (
          <Link
            href={`/skill-lab?focus=${dimension}&subSkill=${subSkill}`}
            className="rounded-full px-2 py-1 text-[10px] font-bold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
            aria-label={`Drill ${SUB_SKILL_LABELS[subSkill]}`}
          >
            drill
          </Link>
        )}
      </span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: number | null }) {
  const cls = "size-3.5";
  if (trend == null) {
    return (
      <Minus
        className={`${cls} text-ink-300 dark:text-ink-600`}
        strokeWidth={2.5}
        aria-label="trend unavailable"
      />
    );
  }
  if (trend >= 2) {
    return (
      <TrendingUp
        className={`${cls} text-emerald-500 dark:text-emerald-400`}
        strokeWidth={2.5}
        aria-label={`improving by ${trend.toFixed(1)} points`}
      />
    );
  }
  if (trend <= -2) {
    return (
      <TrendingDown
        className={`${cls} text-rose-500 dark:text-rose-400`}
        strokeWidth={2.5}
        aria-label={`regressing by ${Math.abs(trend).toFixed(1)} points`}
      />
    );
  }
  return (
    <Minus
      className={`${cls} text-ink-400 dark:text-ink-500`}
      strokeWidth={2.5}
      aria-label="steady"
    />
  );
}
