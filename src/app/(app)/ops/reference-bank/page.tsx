import { notFound } from "next/navigation";
import { CheckCircle2, MicOff } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  loadReferenceBank,
  listReferenceRepAudio,
  type ReferenceRep,
} from "@/lib/calibration/reference-bank";
import { ReferenceRepUploader } from "./uploader";

export const metadata = {
  title: "Reference bank · Ops · Cognify",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Ch.D3 — Reference rep audio surface.
 *
 * Operator-only listing of the full calibration reference bank. Each
 * rep shows: id, kind, prompt-type tag, expected scores (band reps) or
 * pair-spanning assertions (independence reps), audio-status badge,
 * and an upload form when audio is missing.
 *
 * The audio bank lights up Ch.S5 prosody calibration: without ground-
 * truth audio for ≥12 reps, Tone scoring cannot be honestly verified.
 */
export default async function ReferenceBankOpsPage() {
  const me = await currentUser();
  if (!me) notFound();
  const profile = await getUserProfile(me.id);
  if (!profile?.isOperator) notFound();

  const bank = loadReferenceBank();
  const audioMap = await listReferenceRepAudio();

  const totalReps = bank.reps.length;
  const repsWithAudio = bank.reps.filter((r) => audioMap.has(r.id)).length;
  const audioCoverage =
    totalReps > 0 ? Math.round((repsWithAudio / totalReps) * 100) : 0;

  const bandReps = bank.reps.filter((r) => r.kind === "band");
  const indepReps = bank.reps.filter((r) => r.kind === "independence");

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Internal · Operators only
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Reference bank
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-600">
          Calibration reference reps. Upload audio per rep to enable Ch.S5
          prosody calibration; without audio, Tone scoring cannot be
          honestly verified against ground truth.
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Stat label="Total reps" value={String(totalReps)} />
        <Stat
          label="With audio"
          value={`${repsWithAudio} / ${totalReps}`}
          sub={`${audioCoverage}% coverage`}
        />
        <Stat
          label="Rubric version"
          value={bank.rubricVersion}
          sub={bank.notes ? "see notes in JSON" : undefined}
        />
      </div>

      <Section
        title="Band reps"
        subtitle={`${bandReps.length} reps · score-band coverage across all 6 dims`}
      >
        <RepTable reps={bandReps} audioMap={audioMap} />
      </Section>

      <Section
        title="Independence reps"
        subtitle={`${indepReps.length} reps · inter-skill independence assertions across the 6 DNA pairs`}
      >
        <RepTable reps={indepReps} audioMap={audioMap} />
      </Section>

      <p className="mt-12 text-[11px] text-ink-400">
        Audio uploads persist to Supabase storage at
        <code className="mx-1 rounded bg-ink-50 px-1 py-0.5 font-mono">
          rep-audio/reference-reps/&lt;id&gt;.&lt;ext&gt;
        </code>
        . Re-running the calibration harness with audio attached lights up
        the prosody worker (FF_PROSODY_WORKER) for Tone signal extraction.
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
        {title}
      </h2>
      <p className="mt-1 text-xs text-ink-500">{subtitle}</p>
      <div className="mt-4 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="overflow-x-auto">{children}</div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-ink-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
    </div>
  );
}

function RepTable({
  reps,
  audioMap,
}: {
  reps: ReferenceRep[];
  audioMap: Map<string, { signedUrl: string | null }>;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-ink-100 bg-ink-50/60 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        <tr>
          <th className="px-3 py-2 text-left">Rep</th>
          <th className="px-3 py-2 text-left">Prompt</th>
          <th className="px-3 py-2 text-left">Expected / assertions</th>
          <th className="px-3 py-2 text-left">Audio</th>
          <th className="px-3 py-2 text-left">Upload</th>
        </tr>
      </thead>
      <tbody>
        {reps.map((r) => {
          const audio = audioMap.get(r.id);
          return (
            <tr key={r.id} className="border-t border-ink-100 align-top">
              <td className="px-3 py-3 font-mono text-[11px] text-ink-700">
                {r.id}
              </td>
              <td className="px-3 py-3 text-[12px] text-ink-700">
                <p className="font-semibold">{truncate(r.promptText, 80)}</p>
                <p className="mt-1 text-[11px] text-ink-500">
                  {truncate(r.transcript, 140)}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
                  {Math.round(r.durationMs / 1000)}s
                </p>
              </td>
              <td className="px-3 py-3 text-[12px] text-ink-700">
                {r.kind === "band" && r.expected ? (
                  <BandExpected exp={r.expected} />
                ) : (
                  <IndependenceAssertions
                    assertions={r.assertions ?? []}
                  />
                )}
              </td>
              <td className="px-3 py-3">
                {audio?.signedUrl ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 text-success"
                      aria-label="audio uploaded"
                    />
                    <span className="text-[11px] font-semibold text-success">
                      Uploaded
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MicOff
                      className="size-4 text-ink-400"
                      aria-label="no audio"
                    />
                    <span className="text-[11px] text-ink-500">Missing</span>
                  </div>
                )}
                {audio?.signedUrl && (
                  <audio
                    controls
                    src={audio.signedUrl}
                    className="mt-2 h-8 w-44"
                  />
                )}
              </td>
              <td className="px-3 py-3">
                <ReferenceRepUploader repId={r.id} hasAudio={!!audio} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BandExpected({
  exp,
}: {
  exp: NonNullable<ReferenceRep["expected"]>;
}) {
  return (
    <div className="space-y-1">
      <p>
        <span className="font-semibold">Composite:</span> {exp.composite} (
        <span className="capitalize">{exp.band.replace("_", " ")}</span>)
      </p>
      <p className="font-mono text-[10px] text-ink-500">
        C:{exp.dimensions.clarity} S:{exp.dimensions.structure} Cn:
        {exp.dimensions.conciseness} T:{exp.dimensions.thinking_quality} D:
        {exp.dimensions.delivery} Tn:{exp.dimensions.tone}
      </p>
      {exp.untestableDimensions && exp.untestableDimensions.length > 0 && (
        <p className="text-[10px] text-amber-700">
          untestable: {exp.untestableDimensions.join(", ")}
        </p>
      )}
    </div>
  );
}

function IndependenceAssertions({
  assertions,
}: {
  assertions: NonNullable<ReferenceRep["assertions"]>;
}) {
  if (assertions.length === 0) {
    return <span className="text-[11px] text-ink-400">no assertions</span>;
  }
  return (
    <ul className="space-y-1">
      {assertions.map((a, i) => (
        <li key={i} className="font-mono text-[10px] text-ink-600">
          {a.dimension}{" "}
          {a.kind === "minScore" ? `≥${a.min}` : `≤${a.max}`}
        </li>
      ))}
    </ul>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
