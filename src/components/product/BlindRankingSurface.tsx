"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2 } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";
import { cn } from "@/lib/utils/cn";
import { submitRanking } from "@/server/actions/validation";

type Props = {
  token: string;
  repIds: string[];
  reps: Array<{ id: string; durationMs: number }>;
};

export function BlindRankingSurface({ token, repIds, reps }: Props) {
  const [order, setOrder] = useState<string[]>(repIds);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (index: number, direction: -1 | 1) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitRanking({ token, ranking: order });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit ranking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="surface-card p-10 text-center">
        <div className="brand-gradient mx-auto grid size-14 place-items-center rounded-2xl">
          <Check className="size-7 text-white" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
          Thanks. Your ranking was saved.
        </h2>
        <p className="mt-3 max-w-md text-sm text-ink-600 mx-auto">
          The person you listened to will see aggregated rankings — never who submitted
          them. Your feedback helps prove whether their training is actually working.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {order.map((id, i) => {
          const rep = reps.find((r) => r.id === id);
          return (
            <li key={id} className="surface-card flex items-center gap-4 p-5">
              <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-full text-base font-extrabold text-white">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink-900">
                  Attempt {String.fromCharCode(65 + order.indexOf(id))}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {rep ? `${(rep.durationMs / 1000).toFixed(0)}s` : ""}
                </p>
                <audio
                  src={`/api/validate/audio/${id}`}
                  controls
                  className="mt-3 w-full"
                  preload="metadata"
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className={cn(
                    "grid size-8 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900",
                    i === 0 && "opacity-30 pointer-events-none",
                  )}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className={cn(
                    "grid size-8 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900",
                    i === order.length - 1 && "opacity-30 pointer-events-none",
                  )}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="text-xs text-ink-500">
        Rank from clearest at the top to least clear at the bottom.
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <GradientButton onClick={handleSubmit} size="lg">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Submitting
            </>
          ) : (
            "Submit ranking"
          )}
        </GradientButton>
      </div>
    </div>
  );
}
