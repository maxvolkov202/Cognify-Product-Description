import { TrendingUp } from "lucide-react";
import { pickStats } from "@/lib/copy/dna-stats";
import type { SkillDimension } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Stable seed so SSR + hydration render the same rotation. The
   *  caller usually passes today's date or the userId. */
  seed?: string;
  /** Bias toward stats tagged for this dimension. Used by the dashboard
   *  empty state (no preference) and by the post-rep "why this dim
   *  matters" surface (Ch.18 follow-up — when wired, will pass the
   *  user's weakest dim). */
  preferDimension?: SkillDimension;
  /** How many stats to render. Default 3 — the master plan's spec. */
  count?: number;
  className?: string;
  /** Headline copy above the strip. Defaults to "Why this matters." */
  heading?: string;
};

/**
 * Cognify Ch.17 — DNA stats motivator strip.
 *
 * Renders 3 (configurable) rotating stats from the catalog. Used in:
 *   - /onboarding/done (between vertical-pick and first-rep) so users
 *     see the gap they're closing before they record their baseline.
 *   - Dashboard empty state (new user, 0 reps) so the value prop is
 *     reinforced even before the first rep lands.
 *
 * Pure server component — no client JS. Stable seed makes the
 * rotation deterministic per render so the SSR HTML matches what
 * eventually hydrates.
 */
export function DnaStatsStrip({
  seed,
  preferDimension,
  count = 3,
  className,
  heading = "Why this matters",
}: Props) {
  const opts: Parameters<typeof pickStats>[0] = { n: count };
  if (seed != null) opts.seed = seed;
  if (preferDimension != null) opts.preferDimension = preferDimension;
  const stats = pickStats(opts);
  if (stats.length === 0) return null;
  return (
    <section className={cn("space-y-3", className)}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
        {heading}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <article
            key={s.id}
            className="flex flex-col gap-2 rounded-2xl border border-ink-200 bg-white p-4"
          >
            <TrendingUp
              className="size-4 text-brand-purple"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <p className="text-[13px] font-bold leading-snug text-ink-900">
              {s.stat}
            </p>
            <p className="text-[12px] leading-relaxed text-ink-600">
              {s.implication}
            </p>
            <p className="mt-auto text-[10px] font-medium text-ink-400">
              {s.source}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
