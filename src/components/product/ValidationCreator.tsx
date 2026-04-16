"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";
import { cn } from "@/lib/utils/cn";
import { createValidation } from "@/server/actions/validation";

type RepSummary = {
  id: string;
  compositeScore: number;
  createdAt: string;
  durationMs: number;
};

type Topic = {
  prompt: string;
  reps: RepSummary[];
};

type Props = {
  topics: Topic[];
  initialTopic: string | null;
  initialRepIds: string[];
};

export function ValidationCreator({ topics, initialTopic, initialRepIds }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState<string | null>(initialTopic);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialRepIds));
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTopic = topics.find((t) => t.prompt === topic) ?? topics[0] ?? null;

  const toggleRep = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!topic) {
      setError("Pick a topic first.");
      return;
    }
    if (selectedIds.size < 2) {
      setError("Select at least two reps to rank.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createValidation({
        topic,
        repIds: Array.from(selectedIds),
      });
      const url = `${window.location.origin}/validate/${result.token}`;
      setCreated({ token: result.token, url });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create validation.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (created) {
    return (
      <div className="surface-card p-10 text-center">
        <div className="brand-gradient mx-auto grid size-14 place-items-center rounded-2xl shadow-[0_16px_48px_-12px_rgba(151,136,255,0.65)]">
          <Check className="size-7 text-white" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
          Your blind-ranking link is ready.
        </h2>
        <p className="mt-3 text-sm text-ink-600">
          Share it with someone who hasn&rsquo;t heard you speak on this topic. They rank
          your reps without seeing scores. Results land on your dashboard.
        </p>
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
          <code className="flex-1 truncate text-left text-sm text-ink-800">{created.url}</code>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm hover:bg-ink-100"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-8">
          <GradientButton href="/validate" size="md">
            Back to validations
          </GradientButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Topic
        </label>
        <div className="mt-2 space-y-2">
          {topics.map((t) => (
            <button
              key={t.prompt}
              type="button"
              onClick={() => {
                setTopic(t.prompt);
                setSelectedIds(new Set(t.reps.map((r) => r.id)));
              }}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-all",
                topic === t.prompt
                  ? "border-brand-lavender bg-brand-lavender/5 ring-2 ring-brand-lavender/30"
                  : "border-ink-200 bg-white hover:border-ink-300",
              )}
            >
              <p className="text-sm font-bold text-ink-900">{t.prompt}</p>
              <p className="mt-1 text-xs text-ink-500">{t.reps.length} attempts</p>
            </button>
          ))}
        </div>
      </div>

      {activeTopic && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Reps to include ({selectedIds.size} selected)
          </label>
          <div className="mt-2 space-y-2">
            {activeTopic.reps.map((rep, i) => {
              const active = selectedIds.has(rep.id);
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => toggleRep(rep.id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                    active
                      ? "border-brand-lavender bg-brand-lavender/5"
                      : "border-ink-200 bg-white hover:border-ink-300",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
                      active
                        ? "border-brand-lavender bg-brand-lavender text-white"
                        : "border-ink-300 bg-white",
                    )}
                  >
                    {active && <Check className="size-3.5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-ink-800">Attempt {i + 1}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {new Date(rep.createdAt).toLocaleString()} ·{" "}
                      {(rep.durationMs / 1000).toFixed(0)}s
                    </p>
                  </div>
                  <span className="brand-gradient-text text-xl font-extrabold tabular-nums">
                    {Math.round(rep.compositeScore)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">
          Listeners will hear the reps in random order. No names, no scores shown.
        </p>
        <GradientButton onClick={handleCreate} size="lg">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Generate ranking link"
          )}
        </GradientButton>
      </div>
    </div>
  );
}
