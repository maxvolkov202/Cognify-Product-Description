import { Mic } from "lucide-react";

const audienceOptions = ["Executive", "Team", "Client", "Stakeholder"];
const frameworkNodes = ["Context", "Decision", "Impact"];
const timeOptions = ["30s", "60s", "90s"];

export function PracticeLoopMock() {
  return (
    <figure className="relative w-full max-w-md" aria-label="A sample Cognify training session">
      <figcaption className="mb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
        The Structured Practice Loop
      </figcaption>
      <p className="mb-5 ml-auto max-w-[280px] text-right text-xs leading-relaxed text-ink-500">
        Every session follows a tight sequence designed to build clarity and confidence
        under pressure.
      </p>

      <div className="surface-card grid gap-5 p-5 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div>
            <Label>Scenario</Label>
            <div className="mt-1.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm font-semibold text-ink-900">
              Explain a technical decision
            </div>
          </div>

          <div>
            <Label>Step 1 · Audience</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {audienceOptions.map((option, i) => (
                <Pill key={option} active={i === 1}>
                  {option}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <Label>Step 2 · Framework</Label>
            <div className="mt-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-800">
              Context → Decision → Impact
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {frameworkNodes.map((node) => (
                <div
                  key={node}
                  className="rounded-md border border-ink-200 bg-white px-2 py-1 text-center text-[11px] font-medium text-ink-600"
                >
                  {node}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Step 3 · Time</Label>
            <div className="mt-1.5 flex gap-1.5">
              {timeOptions.map((t, i) => (
                <Pill key={t} active={i === 1}>
                  {t}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 border-l border-ink-200/70 pl-5">
          <div className="brand-gradient-text text-5xl font-extrabold tracking-tight tabular-nums">
            00:47
          </div>
          <div className="text-[11px] font-medium text-ink-500">47 of 60 seconds</div>
          <div className="brand-gradient mt-2 grid size-14 place-items-center rounded-full shadow-[0_10px_32px_-8px_rgba(151,136,255,0.6)]">
            <Mic className="size-6 text-white" />
          </div>
          <div className="text-[11px] text-ink-500">Recording in progress</div>
        </div>
      </div>
    </figure>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
      {children}
    </div>
  );
}

function Pill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={
        active
          ? "brand-gradient rounded-md px-2 py-1.5 text-center text-[11px] font-semibold text-white"
          : "rounded-md border border-ink-200 bg-white px-2 py-1.5 text-center text-[11px] font-medium text-ink-600"
      }
    >
      {children}
    </div>
  );
}
