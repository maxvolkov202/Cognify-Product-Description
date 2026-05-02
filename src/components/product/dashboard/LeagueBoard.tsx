import { Trophy, ChevronUp, ChevronDown } from "lucide-react";
import {
  TIER_LABELS,
  TIER_COLORS,
  daysRemainingInWeek,
  type Tier,
} from "@/lib/engagement/leagues";
import { cn } from "@/lib/utils/cn";

type Member = {
  userId: string;
  weeklyXp: number;
  /** Anonymous handle for this week (deterministic per user, week). */
  handle: string;
};

type Props = {
  tier: Tier;
  cohort: Member[];
  selfUserId: string;
  className?: string;
};

const PROMOTE_COUNT_RATIO = 0.3;
const RELEGATE_COUNT_RATIO = 0.3;

/**
 * DNA Ch.9b — weekly cohort leaderboard. Sorted by weekly_xp desc.
 * Shows tier label, tier color, days remaining in the week, and a
 * cohort list with the user's row highlighted. Promote / relegate
 * threshold lines mark the rank boundaries so the user can see what
 * effort is required to climb (or what's needed to avoid relegation).
 *
 * Hidden from dashboard when FF_LEAGUES is not enabled — this component
 * only renders when the dashboard layer decides to show it.
 */
export function LeagueBoard({ tier, cohort, selfUserId, className }: Props) {
  const tierColor = TIER_COLORS[tier];
  const tierLabel = TIER_LABELS[tier];
  const daysLeft = daysRemainingInWeek();
  const promoteCount = Math.max(1, Math.floor(cohort.length * PROMOTE_COUNT_RATIO));
  const relegateCount = Math.max(1, Math.floor(cohort.length * RELEGATE_COUNT_RATIO));
  const relegateThresholdRank = cohort.length - relegateCount;

  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      <div className="h-1" style={{ backgroundColor: tierColor }} aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 place-items-center rounded-xl text-white"
            style={{ backgroundColor: tierColor }}
          >
            <Trophy className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
              League · {cohort.length} competitors
            </p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">
              {tierLabel}
            </p>
          </div>
          <p className="text-right text-[12px] tabular-nums text-ink-500">
            <span className="block font-extrabold text-ink-700">
              {daysLeft}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-ink-400">
              day{daysLeft === 1 ? "" : "s"} left
            </span>
          </p>
        </div>

        <ul className="mt-4 space-y-1">
          {cohort.map((m, i) => {
            const rank = i + 1;
            const isSelf = m.userId === selfUserId;
            const inPromoteZone = rank <= promoteCount;
            const inRelegateZone = rank > relegateThresholdRank;
            return (
              <>
                {rank === promoteCount + 1 && (
                  <li
                    key="promote-line"
                    className="flex items-center gap-2 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600"
                  >
                    <ChevronUp className="size-3" strokeWidth={3} aria-hidden="true" />
                    Promote line
                    <span className="ml-1 h-px flex-1 bg-emerald-200" />
                  </li>
                )}
                {rank === relegateThresholdRank + 1 && (
                  <li
                    key="relegate-line"
                    className="flex items-center gap-2 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-600"
                  >
                    <ChevronDown className="size-3" strokeWidth={3} aria-hidden="true" />
                    Relegate line
                    <span className="ml-1 h-px flex-1 bg-rose-200" />
                  </li>
                )}
                <li
                  key={m.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2",
                    isSelf
                      ? "bg-brand-purple/10 ring-1 ring-brand-purple/30"
                      : inPromoteZone
                        ? "bg-emerald-50/60"
                        : inRelegateZone
                          ? "bg-rose-50/40"
                          : "bg-ink-50/40",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 shrink-0 text-right text-[12px] font-extrabold tabular-nums",
                      isSelf ? "text-brand-purple" : "text-ink-500",
                    )}
                  >
                    {rank}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate text-[13px]",
                      isSelf ? "font-extrabold text-ink-900" : "text-ink-700",
                    )}
                  >
                    {isSelf ? `You — ${m.handle}` : m.handle}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[12px] font-extrabold tabular-nums",
                      isSelf ? "text-brand-purple" : "text-ink-700",
                    )}
                  >
                    {m.weeklyXp.toLocaleString()} XP
                  </span>
                </li>
              </>
            );
          })}
        </ul>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
          Top {promoteCount} promote to{" "}
          <span className="font-bold">
            {tierLabel === "Diamond" ? "Diamond (max)" : "next tier"}
          </span>
          . Bottom {relegateCount} relegate to{" "}
          <span className="font-bold">
            {tierLabel === "Bronze" ? "Bronze (floor)" : "lower tier"}
          </span>
          .
        </p>
      </div>
    </section>
  );
}
