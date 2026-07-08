import { Beaker, Briefcase, Flame } from "lucide-react";

const modes = [
  {
    icon: Flame,
    title: "Daily Workout",
    body: "The core habit. Four to five short reps every day targeting the six core communication skills. Fast, structured and frictionless. This is where the foundation gets built.",
  },
  {
    icon: Beaker,
    title: "Skill Lab",
    body: "Targeted practice. Choose a specific skill you want to sharpen and drill it with focused exercises until it clicks.",
  },
  {
    icon: Briefcase,
    title: "Build a Rep",
    body: "Applied practice. Take what you have built and apply it to the exact real world situations you face. Vertically specific structure and feedback for your industry and role.",
  },
] as const;

export function ModesSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Three modes. One system. Built to make you a better communicator.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-600">
            Cognify trains communication the way a gym trains fitness. Every day you build the foundation, sharpen what needs work, and apply it to the real situations you actually face.
          </p>
        </div>

        <div className="grid gap-4">
          {modes.map(({ icon: Icon, title, body }) => (
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
