const stats = [
  { value: "#1", label: "Most in-demand skill globally" },
  { value: "91%", label: "Say their managers lack communication skills" },
  { value: "86%", label: "Cite communication as the main workplace failure" },
  { value: "75%", label: "Fear public speaking" },
] as const;

export function StatsBar() {
  return (
    <section className="border-y border-ink-200/70 bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="brand-gradient-text text-5xl font-extrabold tracking-tight">
              {stat.value}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
