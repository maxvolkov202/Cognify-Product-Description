import { Briefcase, MessageSquare, Presentation, Sparkles } from "lucide-react";

const useCases = [
  {
    icon: MessageSquare,
    title: "Interview Prep",
    body: "Practice answering tough questions with structure and clarity.",
  },
  {
    icon: Presentation,
    title: "Pitch Training",
    body: "Explain ideas clearly in sixty to ninety seconds.",
  },
  {
    icon: Briefcase,
    title: "Meeting Presence",
    body: "Think clearly and speak with confidence in high-stakes conversations.",
  },
  {
    icon: Sparkles,
    title: "Feedback Delivery",
    body: "Deliver clear, constructive feedback without rambling or hesitation.",
  },
] as const;

export function ModesSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Practice real conversations, not theory.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-600">
            Cognify trains the moments that actually define careers. You practice
            explaining ideas without preparation, under time pressure, and in realistic
            scenarios. Each rep builds clarity through repetition, not memorization.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {useCases.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="surface-card p-6 transition-shadow hover:shadow-[var(--shadow-glow)]"
            >
              <div className="brand-gradient mb-4 grid size-9 place-items-center rounded-lg shadow-sm">
                <Icon className="size-4.5 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-[17px] font-bold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
