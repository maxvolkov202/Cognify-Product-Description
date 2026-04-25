import { Sparkles } from "lucide-react";

const skills = [
  { name: "Structure", score: 84, group: "content" as const },
  { name: "Clarity", score: 78, group: "content" as const },
  { name: "Conciseness", score: 81, group: "content" as const },
  { name: "Thinking Quality", score: 72, group: "delivery" as const },
  { name: "Delivery", score: 68, group: "delivery" as const },
  { name: "Adaptability", score: 79, group: "delivery" as const },
] as const;

export function FeedbackSampleCard() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16 md:items-center">
        <div className="surface-card p-6 md:p-7">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
              Rep feedback
            </p>
            <p className="brand-gradient-text text-3xl font-extrabold tabular-nums tracking-tight">
              77
            </p>
          </div>
          <div className="mt-5 grid gap-2.5">
            {skills.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span
                  className={
                    s.group === "content"
                      ? "inline-flex size-1.5 shrink-0 rounded-full bg-brand-blue"
                      : "inline-flex size-1.5 shrink-0 rounded-full bg-brand-magenta"
                  }
                  aria-hidden="true"
                />
                <span className="w-32 text-xs font-semibold text-ink-700">
                  {s.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="brand-gradient h-full rounded-full"
                    style={{ width: `${s.score}%` }}
                    role="progressbar"
                    aria-label={`${s.name} score`}
                    aria-valuenow={s.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="w-8 text-right text-xs font-bold tabular-nums text-ink-700">
                  {s.score}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border-l-2 border-brand-purple/40 bg-brand-purple/5 p-4">
            <div className="flex items-center gap-1.5 text-brand-purple">
              <Sparkles className="size-3.5" strokeWidth={2.5} />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                One thing to improve next rep
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
              Lead with the result. Open with the headline number, context second, so the audience locks onto the takeaway in the first beat.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Get feedback that improves the next rep.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-600">
            Feedback is focused and actionable. You see what landed, what did not, and exactly what to adjust on the next rep. No scripts, just clear frameworks that guide your thinking and clear signals that help you improve through practice.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500">
            After every rep you see exactly how you performed across the six core communication skills. One focused improvement for the next rep. No noise, just progress.
          </p>
        </div>
      </div>
    </section>
  );
}
