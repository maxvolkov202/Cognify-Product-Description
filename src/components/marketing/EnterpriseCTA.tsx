import { GradientButton } from "@/components/shared/GradientButton";
import { Building2, LineChart, Users } from "lucide-react";

const points = [
  {
    icon: Users,
    title: "Per-seat licensing",
    body: "Price scales with your team. Free pilot for qualified orgs.",
  },
  {
    icon: LineChart,
    title: "Progress reporting",
    body: "Exportable PDFs that hold up to CFO scrutiny. Measurable brain productivity per seat.",
  },
  {
    icon: Building2,
    title: "Admin dashboard",
    body: "Roster, scores, assigned scenarios, calibration sessions.",
  },
] as const;

export function EnterpriseCTA() {
  return (
    <section
      id="career-centers"
      className="mx-auto w-full max-w-6xl px-6 py-24 scroll-mt-24"
    >
      <div className="surface-card overflow-hidden">
        <div className="grid gap-10 p-10 md:grid-cols-[1.2fr_1fr] md:p-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Corporate Health, Performance &amp; career centers
            </p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
              The system your communication training was missing.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
              Courses teach theory. Analysis tools polish delivery. Roleplay platforms simulate one-off conversations. Cognify is the first communication gym to train the underlying skills and muscles of strong communication and prove it with measurable progress. No one taught us how to communicate. We built the system that finally does.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <GradientButton href="/for-teams" size="lg">
                Bring Cognify to your organization
              </GradientButton>
              <GradientButton href="/how-it-works" variant="outline" size="lg">
                See the methodology
              </GradientButton>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-5">
            {points.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
                  <Icon className="size-5 text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-ink-900">{title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
