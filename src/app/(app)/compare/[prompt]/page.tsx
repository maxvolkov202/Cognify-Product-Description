import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getRecentReps } from "@/lib/db/queries/progress";
import { GradientButton } from "@/components/shared/GradientButton";

export default async function ComparePromptPage({
  params,
}: {
  params: Promise<{ prompt: string }>;
}) {
  const { prompt: encoded } = await params;
  const prompt = decodeURIComponent(encoded);
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const recent = await getRecentReps(userId, 100);
  const attempts = recent
    .filter((r) => r.promptText === prompt)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (attempts.length < 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link
          href="/compare"
          className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="size-4" /> Back to comparisons
        </Link>
        <h1 className="mt-6 text-3xl font-extrabold text-ink-900">
          Not enough attempts yet
        </h1>
        <p className="mt-2 text-ink-600">
          You need at least two attempts on the same prompt to see a comparison.
        </p>
        <div className="mt-6">
          <GradientButton href="/workout" size="lg">
            Run another
          </GradientButton>
        </div>
      </div>
    );
  }

  const first = attempts[0]!;
  const last = attempts[attempts.length - 1]!;
  const delta = last.compositeScore - first.compositeScore;
  const pct = first.compositeScore > 0 ? (delta / first.compositeScore) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/compare"
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" /> Back to comparisons
      </Link>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          {attempts.length} attempts
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          {prompt}
        </h1>
      </div>

      <div className="mt-10 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="grid gap-8 p-8 md:grid-cols-3">
          <SummaryStat label="First attempt" value={Math.round(first.compositeScore)} />
          <SummaryStat label="Latest attempt" value={Math.round(last.compositeScore)} gradient />
          <SummaryStat
            label="Improvement"
            value={`${delta >= 0 ? "+" : ""}${Math.round(delta)}`}
            suffix={`${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
            tone={delta >= 0 ? "success" : "danger"}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Attempt timeline
        </h2>
        <div className="mt-4 space-y-3">
          {attempts.map((attempt, i) => (
            <div
              key={attempt.id}
              className="surface-card flex items-center gap-5 p-5"
            >
              <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-xs text-ink-400">
                  {new Date(attempt.createdAt).toLocaleString()}
                </p>
                <p className="text-sm font-medium text-ink-700">
                  {(attempt.durationMs / 1000).toFixed(0)}s rep
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="brand-gradient-text text-2xl font-extrabold tabular-nums">
                  {Math.round(attempt.compositeScore)}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  composite
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 surface-card p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          External validation
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-ink-900">
          Want unbiased listeners to confirm this?
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          Create a blind ranking link. Unbiased listeners rank your {attempts.length} attempts in
          random order, without seeing scores. You get the ranking receipt as proof of
          improvement.
        </p>
        <div className="mt-6">
          <GradientButton
            href={`/validate/new?topic=${encodeURIComponent(prompt)}`}
            size="lg"
          >
            Set up a blind ranking
          </GradientButton>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  suffix,
  tone,
  gradient,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: "success" | "danger";
  gradient?: boolean;
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink-900";
  const valueClass = gradient ? "brand-gradient-text" : toneClass;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className={`mt-2 text-5xl font-extrabold tabular-nums ${valueClass}`}>{value}</p>
      {suffix && <p className="mt-1 text-xs text-ink-500">{suffix}</p>}
    </div>
  );
}
