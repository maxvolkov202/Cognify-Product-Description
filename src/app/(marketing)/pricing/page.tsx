import type { Metadata } from "next";
import { Check } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Freemium for individuals. Per-seat licensing for teams. Start training free or book a pilot.",
};

const individualPlans = [
  {
    name: "Free",
    price: "Always free",
    tagline: "Enough to build the habit and feel the value.",
    features: [
      "3 reps per day across all modes",
      "All six skill dimensions",
      "Basic progress tracking",
      "Streak counter",
    ],
    cta: { label: "Start training free", href: "/signup" },
    variant: "outline" as const,
  },
  {
    name: "Pro",
    price: "$12 / mo",
    priceSub: "or $99 / year",
    tagline: "Unlimited reps, all modes, deeper feedback.",
    features: [
      "Unlimited daily reps",
      "Both modes unlocked (Daily Workout + Build a Rep)",
      "Longitudinal progress dashboard",
      "Rep-to-rep comparison",
      "External validation flow",
      "Priority feedback model",
    ],
    cta: { label: "Start Pro trial", href: "/signup?plan=pro" },
    variant: "primary" as const,
    featured: true,
  },
] as const;

const teamPlans = [
  {
    name: "Career Centers",
    tagline:
      "Universities preparing students for interviews, presentations, and professional communication.",
    features: [
      "Per-seat licensing",
      "Cohort dashboards",
      "Progress exports for academic reporting",
      "Career-center branded onboarding",
    ],
  },
  {
    name: "Companies",
    tagline: "L&D teams investing in employee communication performance and growth.",
    features: [
      "Per-seat licensing",
      "Admin dashboard with team-wide scores",
      "Calibration sessions and assigned scenarios",
      "Exportable PDF progress reports",
      "Pilot program available",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-soft" />
        <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-24 text-center md:pt-32">
          <h1 className="text-5xl font-extrabold tracking-[-0.03em] text-ink-900 md:text-[60px]">
            Simple, <span className="brand-gradient-text">scalable model.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-600">
            Individual adoption. Institutional scale. Freemium entry for individuals,
            per-seat licensing for teams and career centers.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Individual — B2C
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {individualPlans.map((plan) => {
            const isFeatured = "featured" in plan && plan.featured === true;
            return (
            <div
              key={plan.name}
              className={`surface-card flex flex-col p-8 ${
                isFeatured ? "ring-2 ring-brand-lavender" : ""
              }`}
            >
              <h3 className="text-2xl font-extrabold text-ink-900">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="brand-gradient-text text-4xl font-extrabold tracking-tight">
                  {plan.price}
                </span>
              </div>
              {"priceSub" in plan && plan.priceSub && (
                <p className="mt-1 text-sm text-ink-500">{plan.priceSub}</p>
              )}
              <p className="mt-3 text-sm text-ink-600">{plan.tagline}</p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-brand-purple" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <GradientButton
                  href={plan.cta.href}
                  variant={plan.variant}
                  size="md"
                  className="w-full"
                >
                  {plan.cta.label}
                </GradientButton>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Institutional — B2B
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {teamPlans.map((plan) => (
            <div key={plan.name} className="surface-card p-8">
              <h3 className="text-2xl font-extrabold text-ink-900">{plan.name}</h3>
              <p className="mt-3 text-sm text-ink-600">{plan.tagline}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-brand-purple" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <GradientButton href="/for-teams#contact" variant="outline" className="w-full">
                  Book a pilot
                </GradientButton>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
