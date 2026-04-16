import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SkillRadar } from "@/components/product/SkillRadar";
import { GradientButton } from "@/components/shared/GradientButton";

const MOCK_MEMBERS = [
  { id: "m1", name: "Sarah K.", email: "sarah@acme.com", composite: 87, reps: 42 },
  { id: "m2", name: "James L.", email: "james@acme.com", composite: 79, reps: 28 },
  { id: "m3", name: "Priya R.", email: "priya@acme.com", composite: 74, reps: 35 },
  { id: "m4", name: "Marcus T.", email: "marcus@acme.com", composite: 69, reps: 21 },
  { id: "m5", name: "Elena V.", email: "elena@acme.com", composite: 62, reps: 14 },
] as const;

const TEAM_RADAR = {
  clarity: 78,
  structure: 72,
  conciseness: 69,
  thinking_on_the_spot: 65,
  handling_pressure: 71,
  adaptability: 73,
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/admin/teams"
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" /> Back to teams
      </Link>

      <div className="mt-6 flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Team · {teamId}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Acme Sales
        </h1>
        <p className="mt-1 text-lg text-ink-600">24 seats · 19 active this week</p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.5fr]">
        <div className="surface-card p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
            Team shape
          </h2>
          <div className="mt-4 flex justify-center">
            <SkillRadar scores={TEAM_RADAR} size={280} />
          </div>
        </div>

        <div className="surface-card p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Team roster
            </h2>
            <GradientButton size="sm">Assign scenario</GradientButton>
          </div>
          <ul className="mt-4 divide-y divide-ink-100">
            {MOCK_MEMBERS.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold text-ink-900">{member.name}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {member.email} · {member.reps} reps
                  </p>
                </div>
                <div className="text-right">
                  <p className="brand-gradient-text text-2xl font-extrabold tabular-nums">
                    {member.composite}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    composite
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 surface-card p-8">
        <h2 className="text-xl font-extrabold text-ink-900">Export progress report</h2>
        <p className="mt-2 text-sm text-ink-600">
          Generate a PDF report showing the team&rsquo;s progress over the last 30 days.
          Ready to hand to your CFO to justify the training spend.
        </p>
        <div className="mt-6 flex gap-3">
          <GradientButton size="md">Download PDF</GradientButton>
          <button
            type="button"
            className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300"
          >
            Configure report
          </button>
        </div>
      </div>
    </div>
  );
}
