const rows = [
  {
    platform: "Yoodli",
    focus: "How you sound",
    limit: "Happens after speaking",
  },
  {
    platform: "Speeko",
    focus: "Delivery presence",
    limit: "No structure training",
  },
  {
    platform: "Orai",
    focus: "Speaking habits",
    limit: "Polishes speech, not thinking",
  },
  {
    platform: "Hyperbound",
    focus: "Conversation handling",
    limit: "Scenario-specific, not foundational",
  },
  {
    platform: "SecondNature",
    focus: "Objection handling",
    limit: "Scripted, narrow use case",
  },
  {
    platform: "Mindtickle",
    focus: "Knowledge",
    limit: "Not habit-based, slow",
  },
] as const;

export function CompetitorTable() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
        Everything today analyzes or simulates.{" "}
        <span className="brand-gradient-text">Nothing trains.</span>
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-600">
        Grammarly fixes your writing after you write it. It does not teach you to write better. Every speech tool in this space works the same way. They analyze how you sounded after you spoke. Cognify is built differently. Duolingo does not grade your Spanish after a trip to Mexico. It builds the skill through daily practice so you are ready before you get there. That is what Cognify does for communication.
      </p>

      <div className="mt-10 overflow-x-auto rounded-2xl border border-ink-200">
        <table className="min-w-[600px] w-full text-left">
          <thead>
            <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-6 py-4">Platform</th>
              <th className="px-6 py-4">What it improves</th>
              <th className="px-6 py-4">Limitation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.platform} className="border-t border-ink-200 text-sm">
                <td className="px-6 py-4 font-semibold text-ink-900">{row.platform}</td>
                <td className="px-6 py-4 text-ink-700">{row.focus}</td>
                <td className="px-6 py-4 italic text-ink-500">{row.limit}</td>
              </tr>
            ))}
            <tr className="brand-gradient-soft border-t border-ink-200 text-sm">
              <td className="px-6 py-4 font-extrabold">
                <span className="brand-gradient-text">Cognify</span>
              </td>
              <td className="px-6 py-4 font-semibold text-ink-900">Communication ability</td>
              <td className="px-6 py-4 font-semibold text-ink-900">
                Builds skill through daily reps
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
