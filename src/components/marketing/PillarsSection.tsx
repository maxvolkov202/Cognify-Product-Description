import { Mic, Repeat, TrendingUp } from "lucide-react";

const pillars = [
  { icon: Mic, text: "You train by speaking, not watching" },
  { icon: Repeat, text: "You improve through repetition, not scripts" },
  { icon: TrendingUp, text: "You build confidence by becoming capable" },
] as const;

export function PillarsSection() {
  return (
    <section className="brand-gradient-soft border-y border-ink-200/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Built for practice, not performance.
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-10 md:grid-cols-3">
          {pillars.map(({ icon: Icon, text }) => (
            <div key={text} className="flex flex-col items-center">
              <div className="brand-gradient mb-4 grid size-12 place-items-center rounded-xl shadow-[0_10px_28px_-8px_rgba(151,136,255,0.5)]">
                <Icon className="size-5 text-white" aria-hidden="true" />
              </div>
              <p className="max-w-[200px] text-sm font-medium leading-relaxed text-ink-700">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
