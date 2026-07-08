/**
 * DayDotsPreview — 7-dot row shown on the new-user empty state to preview
 * the streak runway before the user has trained. Day 1 is filled with the
 * brand gradient and pulses; days 2–7 are hollow muted ring-dots.
 *
 * Once the user reps for the first time, the empty-state card unmounts and
 * the live StreakChip on DashboardHero takes over — same eye position, real
 * data underneath.
 */
export function DayDotsPreview({
  activeIndex = 0,
  className,
}: {
  /** Index of the dot to render as "today" (0 = Day 1). */
  activeIndex?: number;
  className?: string;
}) {
  const dots = Array.from({ length: 7 }, (_, i) => i);

  return (
    <div
      className={["flex flex-col items-center", className ?? ""].join(" ")}
      role="img"
      aria-label="Your first 7 days of training. Day 1 starts today."
    >
      <div className="flex items-center gap-3 md:gap-4">
        {dots.map((i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <div key={i} className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={[
                  "size-3 rounded-full transition-all",
                  isActive
                    ? "brand-gradient ring-4 ring-brand-purple/20 motion-safe:animate-pulse"
                    : isPast
                    ? "bg-brand-purple/40"
                    : "border border-ink-300 bg-transparent dark:border-ink-600",
                ].join(" ")}
                title={`Day ${i + 1}${isActive ? " — today" : ""}`}
              />
              <span
                className={[
                  "mt-2 text-[10px] font-semibold uppercase tracking-wider tabular-nums",
                  isActive ? "text-brand-purple dark:text-brand-lavender" : "text-ink-400 dark:text-ink-500",
                ].join(" ")}
              >
                {isActive ? "today" : `D${i + 1}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
