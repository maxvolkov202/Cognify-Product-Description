const skills = [
  { name: "Clarity", score: 87 },
  { name: "Structure", score: 92 },
  { name: "Confidence", score: 78 },
] as const;

const weeklyStreak = [24, 7, 12] as const;

export function ProgressChartMock() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="grid gap-14 md:grid-cols-[1fr_1.15fr] md:items-center md:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Progress you can see over time
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Build confidence through repetition.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-600">
            Communication improves through reps. As you train, clarity, structure, and
            confidence compound naturally — and every improvement is measurable.
          </p>
        </div>

        <div className="surface-card p-8">
          <div className="space-y-6">
            {skills.map((skill) => (
              <div key={skill.name}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink-800">{skill.name}</span>
                  <span className="brand-gradient-text text-xl font-extrabold tabular-nums">
                    {skill.score}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="brand-gradient h-full rounded-full transition-[width]"
                    style={{ width: `${skill.score}%` }}
                    role="progressbar"
                    aria-label={`${skill.name} score`}
                    aria-valuenow={skill.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-3 border-t border-ink-200 pt-6 text-center">
            {weeklyStreak.map((n, i) => (
              <div key={i}>
                <div className="brand-gradient-text text-3xl font-extrabold tabular-nums">
                  {n}
                </div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-ink-400">
                  {i === 0 ? "Day streak" : i === 1 ? "Reps today" : "Sessions"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
