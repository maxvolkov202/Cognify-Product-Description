import { cn } from "@/lib/utils/cn";

type Props = {
  /** 1-based current rep index. */
  current: number;
  /** Total reps in the session. */
  total: number;
  /** Optional kicker label (e.g. "REP 1 OF 4 · SIMPLIFY"). When present,
   *  renders as an uppercase tracking label to the right of the dashes. */
  label?: string;
  className?: string;
};

/**
 * Session progress indicator — the dash strip at the top of the rep
 * flow (mockup #2 "REP 1 OF 4 · SIMPLIFY"). Rendered as thin rectangles
 * rather than dots so the "progress bar" aesthetic carries; completed +
 * current fill with the brand gradient, later reps muted ink-200.
 */
export function ProgressDots({ current, total, label, className }: Props) {
  const clamped = Math.max(1, Math.min(current, total));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1" aria-label="Session progress">
        {Array.from({ length: total }).map((_, i) => {
          const step = i + 1;
          const reached = step <= clamped;
          const isCurrent = step === clamped;
          return (
            <span
              key={i}
              className={cn(
                "h-[3px] w-8 rounded-full transition-colors",
                reached
                  ? isCurrent
                    ? "brand-gradient"
                    : "bg-brand-purple/70"
                  : "bg-ink-200",
              )}
              aria-current={isCurrent ? "step" : undefined}
            />
          );
        })}
      </div>
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-purple">
          {label}
        </p>
      )}
    </div>
  );
}
