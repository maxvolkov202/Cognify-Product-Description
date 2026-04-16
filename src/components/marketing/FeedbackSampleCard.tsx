import { Check, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const callouts = [
  {
    icon: Check,
    tone: "success" as const,
    title: "Strong opening",
    body: "You clearly stated your main point in the first 10 seconds.",
  },
  {
    icon: Clock,
    tone: "warn" as const,
    title: "Watch your pacing",
    body: "Try slowing down in the middle section to emphasize key points.",
  },
  {
    icon: Target,
    tone: "brand" as const,
    title: "Clear structure",
    body: "Your answer followed a logical flow from problem to solution.",
  },
] as const;

const toneStyles = {
  success: {
    card: "bg-success/5 border-success/25",
    icon: "bg-success text-white",
  },
  warn: {
    card: "bg-brand-purple/5 border-brand-purple/25",
    icon: "bg-brand-purple text-white",
  },
  brand: {
    card: "bg-brand-blue/5 border-brand-blue/25",
    icon: "bg-brand-blue text-white",
  },
} as const;

export function FeedbackSampleCard() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16 md:items-center">
        <div>
          <a
            href="/how-it-works"
            className="text-sm font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            See a sample feedback screen →
          </a>

          <div className="mt-4 space-y-3">
            {callouts.map((callout) => {
              const tone = toneStyles[callout.tone];
              const Icon = callout.icon;
              return (
                <div
                  key={callout.title}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3.5",
                    tone.card,
                  )}
                >
                  <div
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      tone.icon,
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{callout.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-600">
                      {callout.body}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3 text-xs text-ink-500">
              <span>Filler words: 3 instances of &ldquo;um&rdquo; or &ldquo;like&rdquo;</span>
              <span className="tabular-nums">Duration: 1:24 / 1:30</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Get feedback that improves the next rep.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-600">
            Feedback is focused and actionable. You see what landed, what didn&rsquo;t,
            and exactly what to adjust on the next rep. No grades, no scripts — just
            clear signals that help you improve through practice.
          </p>
        </div>
      </div>
    </section>
  );
}
