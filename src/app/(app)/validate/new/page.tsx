import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getRecentReps } from "@/lib/db/queries/progress";
import { ValidationCreator } from "@/components/product/ValidationCreator";
import { GradientButton } from "@/components/shared/GradientButton";

export default async function NewValidationPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const recent = await getRecentReps(userId, 200);

  const byPrompt = new Map<string, typeof recent>();
  for (const rep of recent) {
    const list = byPrompt.get(rep.promptText) ?? [];
    list.push(rep);
    byPrompt.set(rep.promptText, list);
  }

  const topics = Array.from(byPrompt.entries())
    .filter(([, reps]) => reps.length >= 2)
    .map(([prompt, reps]) => ({ prompt, reps }))
    .sort((a, b) => b.reps.length - a.reps.length);

  const selectedTopic = topic ?? topics[0]?.prompt ?? null;
  const selectedReps = selectedTopic ? byPrompt.get(selectedTopic) ?? [] : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link
        href="/validate"
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" /> Back to validations
      </Link>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          New validation
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          Set up a blind ranking.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-600">
          Pick a topic you&rsquo;ve practiced multiple times. Cognify generates a
          shareable link that presents your attempts to a listener in random order, no
          scores shown. When they rank them, you see if your later attempts actually
          landed better.
        </p>
      </div>

      {topics.length === 0 ? (
        <div className="mt-12 surface-card p-10 text-center">
          <h2 className="text-2xl font-extrabold text-ink-900">
            You need repeat attempts to validate.
          </h2>
          <p className="mt-3 text-sm text-ink-600">
            Run the same prompt 2–5 times, then come back here to create a ranking
            link.
          </p>
          <div className="mt-8">
            <GradientButton href="/workout" size="lg">
              Start a workout
            </GradientButton>
          </div>
        </div>
      ) : (
        <div className="mt-10">
          <ValidationCreator
            topics={topics.map((t) => ({
              prompt: t.prompt,
              reps: t.reps.map((r) => ({
                id: r.id,
                compositeScore: r.compositeScore,
                createdAt: r.createdAt.toISOString(),
                durationMs: r.durationMs,
              })),
            }))}
            initialTopic={selectedTopic}
            initialRepIds={selectedReps.map((r) => r.id)}
          />
        </div>
      )}
    </div>
  );
}
