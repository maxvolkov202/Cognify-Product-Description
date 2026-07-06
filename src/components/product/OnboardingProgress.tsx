import { cn } from "@/lib/utils/cn";

type Props = {
  step: 1 | 2 | 3 | 4 | 5;
  total?: 3 | 4 | 5;
};

/**
 * Consistent progress-bar header for the onboarding flow. Matches the
 * visual language of the tutorial's progressbar so the user sees the
 * same "how far am I" affordance throughout first-run.
 *
 * 3-step default covers vertical → personas → goals. 4-step variant
 * includes the baseline rep.
 */
export function OnboardingProgress({ step, total = 4 }: Props) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div
      className="mb-10"
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Onboarding step ${step} of ${total}`}
    >
      <div className="flex gap-1.5">
        {steps.map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition",
              i <= step ? "brand-gradient" : "bg-ink-200",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        Step {step} of {total}
      </p>
    </div>
  );
}
