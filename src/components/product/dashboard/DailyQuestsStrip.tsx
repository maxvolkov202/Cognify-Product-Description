import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import type { Quest } from "@/lib/engagement/quests";
import { cn } from "@/lib/utils/cn";

type Props = {
  quests: Quest[];
  completedIds: ReadonlySet<string>;
  className?: string;
};

/**
 * DNA Ch.9d — daily quests strip on the dashboard. Three quests refresh
 * at 00:00 UTC; each shows title, description, bonus XP. Completed
 * quests render with check icon + struck-through copy + grayscale dot.
 *
 * The strip is informational — quests complete automatically when a rep
 * satisfies them. No "claim" action; XP is granted server-side at rep
 * save time.
 */
export function DailyQuestsStrip({
  quests,
  completedIds,
  className,
}: Props) {
  if (quests.length === 0) return null;

  const totalXp = quests.reduce((s, q) => s + q.bonusXp, 0);
  const earnedXp = quests
    .filter((q) => completedIds.has(q.id))
    .reduce((s, q) => s + q.bonusXp, 0);
  const completedCount = quests.filter((q) => completedIds.has(q.id)).length;

  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-baseline justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
            <Sparkles className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Daily quests
          </p>
          <p className="text-[11px] tabular-nums text-ink-500 dark:text-ink-400">
            {completedCount}/{quests.length} ·{" "}
            <span className="font-extrabold text-ink-700 dark:text-ink-200">
              +{earnedXp}
            </span>
            <span className="text-ink-400 dark:text-ink-500"> / +{totalXp} XP</span>
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          {quests.map((q) => {
            const done = completedIds.has(q.id);
            return (
              <li
                key={q.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                  done
                    ? "border-success/30 bg-success/5"
                    : "border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0",
                    done ? "text-success" : "text-ink-400 dark:text-ink-500",
                  )}
                >
                  {done ? (
                    <CheckCircle2
                      className="size-5"
                      strokeWidth={2.5}
                      aria-label="Complete"
                    />
                  ) : (
                    <Circle
                      className="size-5"
                      strokeWidth={2}
                      aria-label="Incomplete"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[13px] font-extrabold",
                      done
                        ? "text-ink-500 line-through dark:text-ink-400"
                        : "text-ink-900 dark:text-white",
                    )}
                  >
                    {q.title}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[12px] leading-snug",
                      done ? "text-ink-400 dark:text-ink-500" : "text-ink-600 dark:text-ink-300",
                    )}
                  >
                    {q.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                    done
                      ? "bg-success/15 text-success"
                      : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
                  )}
                >
                  +{q.bonusXp} XP
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
